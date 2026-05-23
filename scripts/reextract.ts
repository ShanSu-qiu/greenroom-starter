import { extractAndStore } from "../lib/extraction/pipeline";

async function main() {
  const deals = ["deal_show_coastal_spell_dispute", "deal_show_0007"];
  for (const dealId of deals) {
    console.log(`\n=== ${dealId} ===`);
    const t0 = Date.now();
    const result = await extractAndStore(dealId);
    console.log(`Flags: ${result.ambiguityCount}`);
    console.log(`Duration: ${Date.now() - t0}ms`);

    // Read back from db to get full ambiguity rows
    const { db } = await import("../db");
    const { dealAmbiguities } = await import("../db/schema-canonical");
    const { eq } = await import("drizzle-orm");
    const rows = await db.select().from(dealAmbiguities).where(eq(dealAmbiguities.canonicalDealId, result.canonicalDeal.id));
    for (const a of rows) {
      const readings = JSON.parse(a.possibleReadingsJson || "[]");
      console.log(`  [${a.severity}] ${a.type}: ${a.summary}`);
      for (const r of readings) {
        console.log(`    - ${r.label}: ${r.reading}`);
        console.log(`      → ${r.implication}`);
      }
    }
  }
}

main().catch(console.error).finally(() => process.exit(0));
