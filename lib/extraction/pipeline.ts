/**
 * Slice B — Extraction pipeline.
 *
 * Single entry point: given a Deal row, produce a canonical_deals row plus
 * any number of deal_ambiguities rows. Transactional — either all writes
 * succeed or none do.
 *
 * Read paths fall back to deals.* when no canonical exists, so this is
 * safe to call lazily (e.g. on first navigation to a deal-review page).
 */

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { deals, type Deal } from "@/db/schema";
import {
  canonicalDeals,
  dealAmbiguities,
  dealShareTokens,
  type CanonicalDeal,
} from "@/db/schema-canonical";
import { extractDealFromProse, type LlmDetectedAmbiguity } from "./extract";
import { detectStructuralDrift, type DriftFlag } from "./drift-detect";

export type PipelineResult = {
  canonicalDeal: CanonicalDeal;
  ambiguityCount: number;
  llmAmbiguityCount: number;
  driftAmbiguityCount: number;
  durationMs: number;
};

export async function extractAndStore(dealId: string): Promise<PipelineResult> {
  const startedAt = Date.now();

  // 1. Load the deal
  const [deal] = await db.select().from(deals).where(eq(deals.id, dealId));
  if (!deal) throw new Error(`Deal not found: ${dealId}`);
  if (!deal.dealNotesFreetext || deal.dealNotesFreetext.trim() === "") {
    throw new Error(
      `Deal ${dealId} has no prose to extract from (dealNotesFreetext is empty)`,
    );
  }

  const prose = deal.dealNotesFreetext;

  // 2. LLM extraction (A1, A3, A4, A5, A6)
  const llmResult = await extractDealFromProse(prose);

  // 3. Drift detection (A2) — pure code, no token cost
  const driftFlags = detectStructuralDrift(llmResult.extracted, deal);

  // 4. Persist — transaction
  const canonicalId = `cd_${dealId}`;
  const now = new Date();

  await db.transaction(async (tx) => {
    // Upsert canonical deal — delete children first (FK constraints), then parent
    await tx
      .delete(dealAmbiguities)
      .where(eq(dealAmbiguities.canonicalDealId, canonicalId));
    await tx
      .delete(dealShareTokens)
      .where(eq(dealShareTokens.canonicalDealId, canonicalId));
    await tx
      .delete(canonicalDeals)
      .where(eq(canonicalDeals.dealId, dealId));

    await tx.insert(canonicalDeals).values({
      id: canonicalId,
      dealId,
      proseSnapshot: prose,
      dealType: llmResult.extracted.dealType,
      guaranteeAmount: llmResult.extracted.guaranteeAmount,
      percentage: llmResult.extracted.percentage,
      percentageBasis: llmResult.extracted.percentageBasis,
      expenseCap: llmResult.extracted.expenseCap,
      hospitalityCap: llmResult.extracted.hospitalityCap,
      bonusesJson:
        llmResult.extracted.bonuses.length > 0
          ? JSON.stringify(llmResult.extracted.bonuses)
          : null,
      recoupExpectationsJson:
        llmResult.extracted.recoupExpectations.length > 0
          ? JSON.stringify(
              llmResult.extracted.recoupExpectations.map((r, i) => ({
                id: `re_${canonicalId}_${i}`,
                ...r,
              })),
            )
          : null,
      fieldConfidenceJson: JSON.stringify(llmResult.fieldConfidence),
      status: "draft",
      reviewedByUserId: null,
      reviewedAt: null,
      createdAt: now,
      updatedAt: now,
    });

    // LLM-detected ambiguities (A1, A3, A4, A5, A6)
    for (const [i, amb] of llmResult.ambiguities.entries()) {
      const span = findProseSpan(prose, amb.proseSpanText);
      await tx.insert(dealAmbiguities).values({
        id: `amb_${canonicalId}_llm_${i}`,
        canonicalDealId: canonicalId,
        type: amb.type,
        severity: amb.severity,
        proseSpanStart: span?.start ?? null,
        proseSpanEnd: span?.end ?? null,
        summary: amb.summary,
        possibleReadingsJson: JSON.stringify(amb.possibleReadings),
        suggestedActionsJson: JSON.stringify(amb.suggestedActions),
        status: "open",
        createdAt: now,
      });
    }

    // Drift-detected ambiguities (A2)
    for (const [i, drift] of driftFlags.entries()) {
      await tx.insert(dealAmbiguities).values({
        id: `amb_${canonicalId}_drift_${i}`,
        canonicalDealId: canonicalId,
        type: drift.type,
        severity: drift.severity,
        proseSpanStart: null,    // drift anchors to a field, not a span
        proseSpanEnd: null,
        summary: drift.summary,
        possibleReadingsJson: JSON.stringify(drift.possibleReadings),
        suggestedActionsJson: JSON.stringify([
          { kind: "confirm_reading", label: "Adopt prose value" },
          { kind: "confirm_reading", label: "Keep structured value" },
          { kind: "defer_to_agent", label: "Email agent to confirm" },
        ]),
        status: "open",
        createdAt: now,
      });
    }
  });

  const [stored] = await db
    .select()
    .from(canonicalDeals)
    .where(eq(canonicalDeals.id, canonicalId));

  return {
    canonicalDeal: stored!,
    ambiguityCount: llmResult.ambiguities.length + driftFlags.length,
    llmAmbiguityCount: llmResult.ambiguities.length,
    driftAmbiguityCount: driftFlags.length,
    durationMs: Date.now() - startedAt,
  };
}

/**
 * Locate the LLM-reported proseSpanText as a substring of the actual prose.
 * If not found verbatim (LLM hallucination), return null and the UI will
 * fall back to displaying the flag without inline highlight.
 */
function findProseSpan(
  prose: string,
  span: string,
): { start: number; end: number } | null {
  if (!span) return null;
  const idx = prose.indexOf(span);
  if (idx === -1) return null;
  return { start: idx, end: idx + span.length };
}
