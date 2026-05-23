/**
 * Backfill extraction for all deals with meaningful prose.
 *
 * Run: npx tsx -r dotenv/config scripts/backfill-extraction.ts dotenv_config_path=.env.local
 *
 * Prerequisites:
 *   - ANTHROPIC_API_KEY set in .env.local
 *   - DEFAULT_MODEL in lib/extraction/extract.ts should be claude-sonnet-4-5
 */

import { db } from "../db";
import { deals } from "../db/schema";
import { canonicalDeals, dealAmbiguities } from "../db/schema-canonical";
import { extractAndStore } from "../lib/extraction/pipeline";
import { eq } from "drizzle-orm";
import { readFile } from "fs/promises";

async function main() {
  // Log model warning
  const extractSource = await readFile(
    "lib/extraction/extract.ts",
    "utf-8",
  );
  const modelMatch = extractSource.match(/DEFAULT_MODEL\s*=\s*"([^"]+)"/);
  const currentModel = modelMatch?.[1] ?? "unknown";
  console.log(`Using model: ${currentModel}`);
  if (currentModel !== "claude-sonnet-4-5") {
    console.error(
      `\n⚠ DEFAULT_MODEL is "${currentModel}", not "claude-sonnet-4-5".`,
    );
    console.error(
      "Switch it back in lib/extraction/extract.ts before running backfill.\n",
    );
    process.exit(1);
  }

  // 1. Find candidates: deals with prose > 50 chars
  const allDeals = await db.select().from(deals);
  const proseDeals = allDeals.filter(
    (d) => d.dealNotesFreetext && d.dealNotesFreetext.length > 50,
  );

  // Also grab up to 3 flat deals with short/no prose as negative examples
  const flatNegatives = allDeals
    .filter(
      (d) =>
        d.dealType === "flat" &&
        (!d.dealNotesFreetext || d.dealNotesFreetext.length <= 50),
    )
    .slice(0, 3);

  const candidates = [...proseDeals, ...flatNegatives];
  const total = candidates.length;

  console.log(
    `\nCandidates: ${proseDeals.length} with prose + ${flatNegatives.length} flat negatives = ${total} total\n`,
  );

  // 2. Process each
  let skipped = 0;
  let extracted = 0;
  let failed = 0;
  const failedDeals: { id: string; error: string }[] = [];
  const flagCounts: Record<string, number> = {
    scope_ambiguity: 0,
    structural_prose_drift: 0,
    missing_specification: 0,
    temporal_amendment: 0,
    undefined_terminology: 0,
    calculation_order: 0,
  };
  let zeroFlags = 0;
  let oneToTwoFlags = 0;
  let threePlusFlags = 0;

  for (let i = 0; i < candidates.length; i++) {
    const deal = candidates[i];
    const label = `[${i + 1}/${total}] ${deal.id}`;

    // Check if already extracted
    const [existing] = await db
      .select()
      .from(canonicalDeals)
      .where(eq(canonicalDeals.dealId, deal.id));

    if (existing) {
      console.log(`${label} → [skip] already extracted`);
      skipped++;
      continue;
    }

    // Skip deals with no prose (flat negatives)
    if (!deal.dealNotesFreetext || deal.dealNotesFreetext.trim() === "") {
      console.log(`${label} → [skip] no prose`);
      skipped++;
      continue;
    }

    try {
      const result = await extractAndStore(deal.id);
      const flagCount = result.ambiguityCount;

      // Count flag types
      const ambiguityRows = await db
        .select()
        .from(dealAmbiguities)
        .where(eq(dealAmbiguities.canonicalDealId, result.canonicalDeal.id));
      for (const row of ambiguityRows) {
        if (row.type in flagCounts) {
          flagCounts[row.type]++;
        }
      }

      if (flagCount === 0) zeroFlags++;
      else if (flagCount <= 2) oneToTwoFlags++;
      else threePlusFlags++;

      console.log(
        `${label} → ${flagCount} flags (${result.durationMs}ms)`,
      );
      extracted++;
    } catch (e) {
      const msg = (e as Error).message;
      console.error(`${label} → [ERROR] ${msg}`);
      failedDeals.push({ id: deal.id, error: msg });
      failed++;
    }
  }

  // 3. Summary
  console.log(`
── Backfill summary ──
Total candidates: ${total}
Skipped (already extracted): ${skipped}
Newly extracted: ${extracted}
Failed: ${failed}

Flag distribution by type:
  scope_ambiguity: ${flagCounts.scope_ambiguity}
  structural_prose_drift: ${flagCounts.structural_prose_drift}
  missing_specification: ${flagCounts.missing_specification}
  temporal_amendment: ${flagCounts.temporal_amendment}
  undefined_terminology: ${flagCounts.undefined_terminology}
  calculation_order: ${flagCounts.calculation_order}

Deals with zero flags (clean): ${zeroFlags}
Deals with 1-2 flags: ${oneToTwoFlags}
Deals with 3+ flags: ${threePlusFlags}

Failed deals: ${failedDeals.length === 0 ? "(none)" : failedDeals.map((d) => `${d.id}: ${d.error}`).join("\n  ")}
`);

  process.exit(failed > 0 ? 1 : 0);
}

main();
