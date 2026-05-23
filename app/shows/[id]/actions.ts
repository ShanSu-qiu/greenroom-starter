"use server";
import { eq, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { canonicalDeals, dealAmbiguities, dealShareTokens } from "@/db/schema-canonical";
import { extractAndStore } from "@/lib/extraction/pipeline";

export async function extractDealAction(dealId: string, showId: string) {
  const result = await extractAndStore(dealId);
  revalidatePath(`/shows/${showId}`);
  return {
    ambiguityCount: result.ambiguityCount,
    llmAmbiguityCount: result.llmAmbiguityCount,
    driftAmbiguityCount: result.driftAmbiguityCount,
    durationMs: result.durationMs,
  };
}

export async function saveCanonicalDealAction(
  canonicalDealId: string,
  showId: string,
) {
  const now = new Date();
  await db
    .update(canonicalDeals)
    .set({ status: "reviewed_by_venue", reviewedAt: now, updatedAt: now })
    .where(eq(canonicalDeals.id, canonicalDealId));
  revalidatePath(`/shows/${showId}`);
  return { ok: true };
}

export async function reopenCanonicalDealAction(
  canonicalDealId: string,
  showId: string,
) {
  const now = new Date();
  await db
    .update(canonicalDeals)
    .set({ status: "draft", reviewedAt: null, updatedAt: now })
    .where(eq(canonicalDeals.id, canonicalDealId));
  revalidatePath(`/shows/${showId}`);
  return { ok: true };
}

export async function createShareTokenAction(
  canonicalDealId: string,
): Promise<{ token: string; url: string }> {
  const id = crypto.randomUUID();
  const token = crypto.randomUUID();
  await db.insert(dealShareTokens).values({
    id,
    canonicalDealId,
    token,
    createdAt: new Date(),
  });
  return { token, url: `/agent-review/${token}` };
}

export async function venueConfirmReadingAction(
  ambiguityId: string,
  showId: string,
  readingId: string,
) {
  const now = new Date();

  // Load the ambiguity row
  const [amb] = await db
    .select()
    .from(dealAmbiguities)
    .where(eq(dealAmbiguities.id, ambiguityId));
  if (!amb) return { ok: false, error: "Ambiguity not found" };

  // Write venueConfirmedReadingId
  const updates: Record<string, unknown> = {
    venueConfirmedReadingId: readingId,
  };

  // Look up agent response for this ambiguity
  const tokens = await db
    .select()
    .from(dealShareTokens)
    .where(eq(dealShareTokens.canonicalDealId, amb.canonicalDealId))
    .orderBy(desc(dealShareTokens.createdAt))
    .limit(1);

  const latest = tokens[0];
  let agentResponse: { action: string; readingId?: string } | undefined;
  if (latest?.agentResponseJson) {
    try {
      const parsed = JSON.parse(latest.agentResponseJson);
      agentResponse = parsed[ambiguityId];
    } catch {
      // ignore
    }
  }

  if (agentResponse) {
    if (
      agentResponse.action === "confirm" &&
      agentResponse.readingId === readingId
    ) {
      updates.status = "resolved_by_confirm_reading";
      updates.resolvedAt = now;
      updates.resolutionNote = "dual-confirmed";
    } else if (
      agentResponse.action === "confirm" &&
      agentResponse.readingId !== readingId
    ) {
      updates.status = "disputed";
    } else if (agentResponse.action === "flag") {
      updates.status = "disputed";
    }
  } else {
    updates.status = "venue_confirmed";
  }

  await db
    .update(dealAmbiguities)
    .set(updates)
    .where(eq(dealAmbiguities.id, ambiguityId));

  revalidatePath(`/shows/${showId}`);
  return { ok: true };
}
