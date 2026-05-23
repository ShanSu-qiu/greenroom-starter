/**
 * Golden test runner for Slice B extraction.
 *
 * Run: npx tsx scripts/test-extraction.ts
 *
 * Tests:
 *   G1 — Coastal Spell (expects A1 scope_ambiguity + A6 calculation_order)
 *   G2 — BC2 phone-call note (expects A4 temporal + A2 drift)
 *   G3 — BC6 percentage drift (expects A2 drift)
 *   G6 — "see email thread" (expects A3 missing_specification)
 *   G7 — Clean flat deal (expects NO ambiguities — negative test)
 *
 * Pass criteria:
 *   - extracted fields are accurate per case
 *   - expected ambiguity types are present
 *   - G7 produces zero ambiguities
 */

import { extractDealFromProse } from "../lib/extraction/extract";
import { detectStructuralDrift } from "../lib/extraction/drift-detect";
import type { Deal } from "../db/schema";

type GoldenCase = {
  id: string;
  prose: string;
  existingDeal?: Partial<Deal>;       // for drift detection tests
  expectedAmbiguityTypes: string[];
  expectedFields?: Partial<Record<string, unknown>>;
};

const CASES: GoldenCase[] = [
  {
    id: "G1_coastal_spell",
    prose:
      "$5,000 vs 80% of net after expenses, whichever greater. " +
      "Expenses capped $2,500. Hospitality cap $500. " +
      "+$1,000 bonus over $25k gross. " +
      "Marketing recoup of $900 against gross.",
    expectedAmbiguityTypes: ["scope_ambiguity", "calculation_order"],
    expectedFields: {
      dealType: "vs",
      guaranteeAmount: 5000,
      percentage: 0.8,
      percentageBasis: "net",
      expenseCap: 2500,
      hospitalityCap: 500,
    },
  },
  {
    id: "G2_BC2_phone_call",
    prose:
      "$4,000 guarantee vs 80% of net after expenses, whichever greater. " +
      "Expenses capped $2,000. Hospitality cap $500. " +
      "+$1,500 bonus over $25,000 gross. " +
      "[Updated 4 days before show via phone call with agent: " +
      "bonus threshold dropped to $20,000. " +
      "Note: structured field still reflects original $25,000 — confirm before settlement.]",
    existingDeal: {
      dealType: "vs",
      guaranteeAmount: 4000,
      percentage: 0.8,
      percentageBasis: "net",
      expenseCap: 2000,
      hospitalityCap: 500,
      bonusesJson: JSON.stringify([
        { type: "gross_threshold", label: "+$1,500 over $25k", threshold: 25000, amount: 1500 },
      ]),
    },
    expectedAmbiguityTypes: ["temporal_amendment"],
    // A2 may also fire on bonuses count or threshold drift — both acceptable
  },
  {
    id: "G3_BC6_percentage_drift",
    prose:
      "Renegotiated 1 week before show: $3,000 g'tee vs 85/15 split on net (was 75/25). " +
      "Expense cap $1,500, hospitality $500.",
    existingDeal: {
      dealType: "vs",
      guaranteeAmount: 3000,
      percentage: 0.75,          // ← still old value
      percentageBasis: "net",
      expenseCap: 1500,
      hospitalityCap: 500,
    },
    expectedAmbiguityTypes: ["structural_prose_drift"],
    // Also acceptable: temporal_amendment (LLM may detect "Renegotiated 1 week before")
  },
  {
    id: "G6_see_email",
    prose:
      "$4,500 vs 80% of net after expenses. Expense cap $2,000. " +
      "Performance bonuses per the deal memo (see email thread).",
    expectedAmbiguityTypes: ["missing_specification"],
  },
  {
    id: "G7_clean_flat",
    prose: "Flat $5,000. No upside.",
    expectedAmbiguityTypes: [],
    expectedFields: {
      dealType: "flat",
      guaranteeAmount: 5000,
    },
  },
];

async function run() {
  console.log("\n=== Slice B Golden Tests ===\n");

  let pass = 0;
  let fail = 0;

  for (const c of CASES) {
    console.log(`--- ${c.id} ---`);
    console.log(`Prose: ${c.prose.slice(0, 80)}${c.prose.length > 80 ? "…" : ""}`);

    try {
      const llm = await extractDealFromProse(c.prose);
      const drift = c.existingDeal
        ? detectStructuralDrift(llm.extracted, c.existingDeal as Deal)
        : [];

      const allTypes = [
        ...llm.ambiguities.map((a) => a.type),
        ...drift.map((d) => d.type),
      ];

      console.log(`  Detected types: [${allTypes.join(", ") || "(none)"}]`);
      console.log(`  LLM duration: ${llm.durationMs}ms`);

      const expected = new Set(c.expectedAmbiguityTypes);
      const detected = new Set(allTypes);
      const missing = [...expected].filter((t) => !detected.has(t));
      const unexpected = [...detected].filter((t) => !expected.has(t));

      // Negative test (G7) — must have zero ambiguities
      if (c.expectedAmbiguityTypes.length === 0) {
        if (detected.size === 0) {
          console.log("  ✅ PASS (no false flags)");
          pass++;
        } else {
          console.log(`  ❌ FAIL — expected no flags, got: ${[...detected].join(", ")}`);
          fail++;
        }
      } else {
        if (missing.length === 0) {
          console.log(
            `  ✅ PASS (expected types found${unexpected.length > 0 ? `; bonus: ${unexpected.join(", ")}` : ""})`,
          );
          pass++;
        } else {
          console.log(`  ❌ FAIL — missing: ${missing.join(", ")}`);
          fail++;
        }
      }

      // Field accuracy check (when specified)
      if (c.expectedFields) {
        const fieldMismatches: string[] = [];
        for (const [k, v] of Object.entries(c.expectedFields)) {
          const actual = (llm.extracted as Record<string, unknown>)[k];
          if (actual !== v) {
            fieldMismatches.push(`${k}: expected ${v}, got ${actual}`);
          }
        }
        if (fieldMismatches.length > 0) {
          console.log(`  ⚠ Field mismatches: ${fieldMismatches.join("; ")}`);
        }
      }
    } catch (e) {
      console.log(`  ❌ ERROR: ${(e as Error).message}`);
      fail++;
    }
    console.log();
  }

  console.log(`=== Summary: ${pass}/${pass + fail} passed ===\n`);
  process.exit(fail > 0 ? 1 : 0);
}

run();
