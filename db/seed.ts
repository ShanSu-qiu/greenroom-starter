/**
 * Greenroom 18-month synthetic seed.
 *
 * Generates ~370 shows across 18 months at The Crescent, with realistic:
 *   - artist tiers (draw size distributions)
 *   - deal type mix (flat 25%, vs 50%, percentage_of_net 15%, door 5%, percentage_of_gross 5%)
 *   - sell-through variance
 *   - expense breakdowns
 *   - past settlements with deal-aware math
 *
 * Specific narrative shows are injected by hand:
 *   - The Coastal Spell / WME dispute (March 14, 2025) referenced in
 *     data/dispute-thread.md
 *
 * Run via: npm run db:seed
 */

import { db, client } from "./index";
import {
  users,
  venues,
  agencies,
  agents,
  artists,
  shows,
  deals,
  ticketSales,
  expenses,
  settlements,
} from "./schema";

// -------- Deterministic RNG --------
function makeRng(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = makeRng(42);
const rnd = () => rng();
const rndInt = (min: number, max: number) =>
  Math.floor(rnd() * (max - min + 1)) + min;
const choose = <T>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)];
const weighted = <T>(items: { value: T; weight: number }[]): T => {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = rnd() * total;
  for (const i of items) {
    r -= i.weight;
    if (r <= 0) return i.value;
  }
  return items[items.length - 1].value;
};

// -------- Constants --------
const VENUE_ID = "venue_crescent";
const VENUE_CAPACITY = 650;
const MARIANA_ID = "user_mariana";
const MARCUS_ID = "user_marcus";
const TODAY = new Date("2026-02-01");

interface ArtistDef {
  id: string;
  name: string;
  genre: string;
  tier: "A" | "B" | "C" | "D";
  recurrence: number;
}

const ARTIST_DEFS: ArtistDef[] = [
  { id: "art_pale_lake", name: "Pale Lake", genre: "indie rock", tier: "A", recurrence: 3 },
  { id: "art_coastal_spell", name: "Coastal Spell", genre: "shoegaze", tier: "A", recurrence: 2 },
  { id: "art_the_quiet_houses", name: "The Quiet Houses", genre: "indie rock", tier: "A", recurrence: 2 },
  { id: "art_orenda", name: "Orenda", genre: "art rock", tier: "A", recurrence: 2 },
  { id: "art_jenny_hardwick", name: "Jenny Hardwick", genre: "songwriter", tier: "A", recurrence: 2 },
  { id: "art_summer_bonanza", name: "Summer Bonanza", genre: "garage rock", tier: "A", recurrence: 2 },
  { id: "art_lemonglow", name: "Lemonglow", genre: "dream pop", tier: "A", recurrence: 1 },
  { id: "art_mariners_wake", name: "Mariner's Wake", genre: "folk rock", tier: "A", recurrence: 2 },
  { id: "art_nevada_sundown", name: "Nevada Sundown", genre: "americana", tier: "B", recurrence: 4 },
  { id: "art_courier", name: "Courier", genre: "alt country", tier: "B", recurrence: 3 },
  { id: "art_cold_comfort", name: "Cold Comfort", genre: "indie pop", tier: "B", recurrence: 3 },
  { id: "art_briar_road", name: "Briar Road", genre: "americana", tier: "B", recurrence: 2 },
  { id: "art_telegraph_avenue", name: "Telegraph Avenue", genre: "soul", tier: "B", recurrence: 3 },
  { id: "art_the_first_light", name: "The First Light", genre: "indie rock", tier: "B", recurrence: 2 },
  { id: "art_minor_holiday", name: "Minor Holiday", genre: "indie pop", tier: "B", recurrence: 3 },
  { id: "art_grand_central", name: "Grand Central", genre: "rock", tier: "B", recurrence: 2 },
  { id: "art_winter_circle", name: "Winter Circle", genre: "indie folk", tier: "B", recurrence: 2 },
  { id: "art_august_haze", name: "August Haze", genre: "psych rock", tier: "B", recurrence: 3 },
  { id: "art_milk_route", name: "Milk Route", genre: "indie rock", tier: "B", recurrence: 2 },
  { id: "art_drive_north", name: "Drive North", genre: "alt country", tier: "B", recurrence: 2 },
  { id: "art_rookie_dive", name: "Rookie Dive", genre: "indie pop", tier: "C", recurrence: 4 },
  { id: "art_hollow_branch", name: "Hollow Branch", genre: "post rock", tier: "C", recurrence: 3 },
  { id: "art_low_rooms", name: "Low Rooms", genre: "indie rock", tier: "C", recurrence: 4 },
  { id: "art_navarro", name: "Navarro", genre: "songwriter", tier: "C", recurrence: 3 },
  { id: "art_stoneflower", name: "Stoneflower", genre: "indie folk", tier: "C", recurrence: 3 },
  { id: "art_wax_paper", name: "Wax Paper", genre: "indie pop", tier: "C", recurrence: 3 },
  { id: "art_rivers_end", name: "Rivers End", genre: "americana", tier: "C", recurrence: 4 },
  { id: "art_blue_dial", name: "Blue Dial", genre: "indie rock", tier: "C", recurrence: 3 },
  { id: "art_gentle_riot", name: "Gentle Riot", genre: "garage rock", tier: "C", recurrence: 3 },
  { id: "art_park_avenue", name: "Park Avenue", genre: "indie pop", tier: "C", recurrence: 3 },
  { id: "art_ferns", name: "Ferns", genre: "ambient", tier: "C", recurrence: 2 },
  { id: "art_sunday_drivers", name: "Sunday Drivers", genre: "alt country", tier: "C", recurrence: 3 },
  { id: "art_post_hill", name: "Post Hill", genre: "indie rock", tier: "C", recurrence: 3 },
  { id: "art_lonesome_west", name: "Lonesome West", genre: "americana", tier: "C", recurrence: 2 },
  { id: "art_north_blue", name: "North Blue", genre: "indie folk", tier: "C", recurrence: 3 },
  { id: "art_overcoats", name: "Overcoats", genre: "indie pop", tier: "C", recurrence: 2 },
  { id: "art_radio_tower", name: "Radio Tower", genre: "indie rock", tier: "C", recurrence: 3 },
  { id: "art_low_country", name: "Low Country", genre: "americana", tier: "C", recurrence: 4 },
  { id: "art_wet_cement", name: "Wet Cement", genre: "garage rock", tier: "D", recurrence: 6 },
  { id: "art_red_letter", name: "Red Letter", genre: "indie rock", tier: "D", recurrence: 5 },
  { id: "art_evening_wear", name: "Evening Wear", genre: "indie pop", tier: "D", recurrence: 4 },
  { id: "art_simple_machines", name: "Simple Machines", genre: "punk", tier: "D", recurrence: 5 },
  { id: "art_two_lanes", name: "Two Lanes", genre: "alt country", tier: "D", recurrence: 4 },
  { id: "art_atlas_atlas", name: "Atlas Atlas", genre: "indie rock", tier: "D", recurrence: 3 },
  { id: "art_kerosene_kid", name: "Kerosene Kid", genre: "blues rock", tier: "D", recurrence: 4 },
  { id: "art_stay_dry", name: "Stay Dry", genre: "indie pop", tier: "D", recurrence: 3 },
  { id: "art_basement_window", name: "Basement Window", genre: "indie rock", tier: "D", recurrence: 4 },
  { id: "art_warm_milk", name: "Warm Milk", genre: "shoegaze", tier: "D", recurrence: 3 },
  { id: "art_dust_off", name: "Dust Off", genre: "garage rock", tier: "D", recurrence: 5 },
  { id: "art_pen_pal", name: "Pen Pal", genre: "indie pop", tier: "D", recurrence: 3 },
  { id: "art_safe_houses", name: "Safe Houses", genre: "indie rock", tier: "D", recurrence: 4 },
  { id: "art_lake_effect", name: "Lake Effect", genre: "ambient", tier: "D", recurrence: 3 },
  { id: "art_tin_signal", name: "Tin Signal", genre: "post rock", tier: "D", recurrence: 4 },
  { id: "art_hospital_corners", name: "Hospital Corners", genre: "punk", tier: "D", recurrence: 3 },
  { id: "art_glass_bottle", name: "Glass Bottle", genre: "indie folk", tier: "D", recurrence: 4 },
  { id: "art_freight_class", name: "Freight Class", genre: "rock", tier: "D", recurrence: 3 },
  { id: "art_ledger", name: "Ledger", genre: "indie pop", tier: "D", recurrence: 3 },
  { id: "art_deck_chairs", name: "Deck Chairs", genre: "americana", tier: "D", recurrence: 4 },
  { id: "art_house_of_lights", name: "House of Lights", genre: "indie rock", tier: "D", recurrence: 3 },
];

const AGENCIES = [
  { id: "agcy_wme", name: "WME" },
  { id: "agcy_caa", name: "CAA" },
  { id: "agcy_wasserman", name: "Wasserman" },
  { id: "agcy_paradigm", name: "Paradigm" },
  { id: "agcy_independent", name: "Independent" },
];

const AGENT_DEFS = [
  { id: "agent_sarah_kim", name: "Sarah Kim", agencyId: "agcy_wme", email: "skim@wme.com", preferencesNotes: "One of the easier WME agents. Reads settlements carefully but fairly. Pet peeve: 'Miscellaneous' line items in expenses without itemization." },
  { id: "agent_daniel_hwang", name: "Daniel Hwang", agencyId: "agcy_wme", email: "dhwang@wme.com", preferencesNotes: "Pushes back hard. Wrote the email thread on the Coastal Spell dispute (March 2025). Tends to ambiguity in deal emails — worth pre-negotiating clarifications." },
  { id: "agent_andrea_pelletier", name: "Andrea Pelletier", agencyId: "agcy_wme", email: "apelletier@wme.com", preferencesNotes: "Negotiates the deals; her colleagues handle settlement." },
  { id: "agent_danny_ortiz", name: "Danny Ortiz", agencyId: "agcy_caa", email: "dortiz@caa.com", preferencesNotes: "Easygoing. Trusts Mariana. Quick to sign off." },
  { id: "agent_meera_patel", name: "Meera Patel", agencyId: "agcy_caa", email: "mpatel@caa.com", preferencesNotes: "New at CAA, took over a roster from a departing agent. Still learning our venue." },
  { id: "agent_chris_lockhart", name: "Chris Lockhart", agencyId: "agcy_caa", email: "clockhart@caa.com", preferencesNotes: null },
  { id: "agent_pat_cho", name: "Pat Cho", agencyId: "agcy_independent", email: "pat@patcho.co", preferencesNotes: "Books smaller indie bands. Often the artist's manager too." },
  { id: "agent_rosa_jimenez", name: "Rosa Jimenez", agencyId: "agcy_wasserman", email: "rjimenez@wasserman.com", preferencesNotes: null },
  { id: "agent_tom_neary", name: "Tom Neary", agencyId: "agcy_wasserman", email: "tneary@wasserman.com", preferencesNotes: "Has his own settlement template he wants filled in. Annoying but he renews the relationship." },
  { id: "agent_kev_park", name: "Kev Park", agencyId: "agcy_paradigm", email: "kpark@paradigmagency.com", preferencesNotes: null },
  { id: "agent_naomi_brand", name: "Naomi Brand", agencyId: "agcy_paradigm", email: "nbrand@paradigmagency.com", preferencesNotes: null },
  { id: "agent_maya_okafor", name: "Maya Okafor", agencyId: "agcy_independent", email: "maya@mayaokafor.com", preferencesNotes: null },
  { id: "agent_jordan_wells", name: "Jordan Wells", agencyId: "agcy_independent", email: "jordan@wellstalent.com", preferencesNotes: null },
  { id: "agent_cass_burke", name: "Cass Burke", agencyId: "agcy_independent", email: "cass@burkebooking.com", preferencesNotes: null },
];

const TIER_AGENCY_WEIGHTS: Record<ArtistDef["tier"], { value: string; weight: number }[]> = {
  A: [
    { value: "agcy_wme", weight: 4 },
    { value: "agcy_caa", weight: 3 },
    { value: "agcy_wasserman", weight: 2 },
    { value: "agcy_paradigm", weight: 1 },
  ],
  B: [
    { value: "agcy_wme", weight: 2 },
    { value: "agcy_caa", weight: 3 },
    { value: "agcy_wasserman", weight: 3 },
    { value: "agcy_paradigm", weight: 2 },
    { value: "agcy_independent", weight: 1 },
  ],
  C: [
    { value: "agcy_caa", weight: 1 },
    { value: "agcy_wasserman", weight: 2 },
    { value: "agcy_paradigm", weight: 3 },
    { value: "agcy_independent", weight: 4 },
  ],
  D: [
    { value: "agcy_independent", weight: 8 },
    { value: "agcy_paradigm", weight: 1 },
  ],
};

function pickAgentForArtist(tier: ArtistDef["tier"]): string {
  const agencyId = weighted(TIER_AGENCY_WEIGHTS[tier]);
  const agentsAtAgency = AGENT_DEFS.filter((a) => a.agencyId === agencyId);
  return choose(agentsAtAgency).id;
}

interface GeneratedDeal {
  type: "flat" | "percentage_of_gross" | "percentage_of_net" | "vs" | "door";
  guaranteeAmount: number | null;
  percentage: number | null;
  percentageBasis: "gross" | "net" | null;
  expenseCap: number | null;
  hospitalityCap: number | null;
  bonuses: { thresholdGross: number; amount: number; stacks: boolean }[] | null;
  notes: string;
}

function generateDeal(tier: ArtistDef["tier"]): GeneratedDeal {
  const dealType = weighted<GeneratedDeal["type"]>([
    { value: "flat", weight: tier === "D" ? 8 : tier === "C" ? 4 : 2 },
    { value: "vs", weight: tier === "A" ? 7 : tier === "B" ? 6 : tier === "C" ? 4 : 1 },
    { value: "percentage_of_net", weight: 2 },
    { value: "door", weight: tier === "D" ? 1 : 0.5 },
    { value: "percentage_of_gross", weight: 0.5 },
  ]);

  const baseGuarantee = {
    A: rndInt(4500, 9000),
    B: rndInt(2500, 5500),
    C: rndInt(1000, 2800),
    D: rndInt(400, 1500),
  }[tier];

  switch (dealType) {
    case "flat":
      return {
        type: "flat",
        guaranteeAmount: baseGuarantee,
        percentage: null,
        percentageBasis: null,
        expenseCap: null,
        hospitalityCap: null,
        bonuses: null,
        notes: rnd() < 0.5
          ? `Flat $${baseGuarantee}. No upside.`
          : `Flat guarantee $${baseGuarantee}. ${choose(["Weeknight slot.", "Tour routing fill, no expenses.", "Local/regional act.", "Buyout deal."])}`,
      };
    case "vs": {
      const pct = choose([0.7, 0.75, 0.8, 0.85, 0.85, 0.85, 0.9]);
      const expenseCap = Math.round((baseGuarantee * 0.5) / 50) * 50;
      const hospitalityCap = choose([300, 400, 500, 600]);
      const hasBonus = rnd() < (tier === "A" ? 0.6 : tier === "B" ? 0.3 : 0.1);
      const bonuses = hasBonus
        ? [
            {
              thresholdGross: Math.round((baseGuarantee * 4) / 1000) * 1000,
              amount: Math.round((baseGuarantee * 0.15) / 50) * 50,
              stacks: rnd() < 0.7,
            },
            ...(rnd() < 0.5
              ? [{ thresholdGross: Math.round((baseGuarantee * 5.5) / 1000) * 1000, amount: Math.round((baseGuarantee * 0.15) / 50) * 50, stacks: true }]
              : []),
          ]
        : null;
      return {
        type: "vs",
        guaranteeAmount: baseGuarantee,
        percentage: pct,
        percentageBasis: "net",
        expenseCap,
        hospitalityCap,
        bonuses,
        notes: generateVsDealNotes(baseGuarantee, pct, expenseCap, hospitalityCap, bonuses),
      };
    }
    case "percentage_of_net": {
      const pct = choose([0.8, 0.85, 0.85, 0.9]);
      const expenseCap = Math.round((baseGuarantee * 0.6) / 50) * 50;
      return {
        type: "percentage_of_net",
        guaranteeAmount: null,
        percentage: pct,
        percentageBasis: "net",
        expenseCap,
        hospitalityCap: choose([300, 400, 500]),
        bonuses: null,
        notes: `${(pct * 100).toFixed(0)}% of net after expenses. Expenses capped $${expenseCap}. No guarantee.`,
      };
    }
    case "door": {
      const expenseCap = Math.round((baseGuarantee * 0.4) / 50) * 50;
      return {
        type: "door",
        guaranteeAmount: null,
        percentage: null,
        percentageBasis: null,
        expenseCap,
        hospitalityCap: choose([200, 300]),
        bonuses: null,
        notes: `Door deal. Artist gets ticket revenue minus expenses (capped $${expenseCap}). DIY/experimental tour.`,
      };
    }
    case "percentage_of_gross": {
      const pct = choose([0.7, 0.75, 0.8]);
      return {
        type: "percentage_of_gross",
        guaranteeAmount: null,
        percentage: pct,
        percentageBasis: "gross",
        expenseCap: null,
        hospitalityCap: null,
        bonuses: null,
        notes: `${(pct * 100).toFixed(0)}% of gross. No expense deductions. Simple split deal.`,
      };
    }
  }
}

function generateVsDealNotes(
  guarantee: number,
  pct: number,
  expenseCap: number,
  hospitalityCap: number,
  bonuses: { thresholdGross: number; amount: number; stacks: boolean }[] | null,
): string {
  const variants = [
    () =>
      `$${guarantee} guarantee vs ${(pct * 100).toFixed(0)}% of net after expenses, whichever greater. Expenses capped $${expenseCap}. Hospitality cap $${hospitalityCap}.${
        bonuses
          ? ` Bonus: +$${bonuses[0].amount} if gross > $${bonuses[0].thresholdGross}${
              bonuses.length > 1
                ? `, additional +$${bonuses[1].amount} if gross > $${bonuses[1].thresholdGross}`
                : ""
            }${bonuses[0].stacks ? ". Bonuses stack." : ""}`
          : ""
      }`,
    () =>
      `Deal: $${guarantee} vs ${(pct * 100).toFixed(0)}/${((1 - pct) * 100).toFixed(0)} after expenses. Expense cap ${expenseCap}, hospitality cap ${hospitalityCap}.${
        bonuses ? ` Hits at ${bonuses[0].thresholdGross} gross trigger +${bonuses[0].amount}.` : ""
      }`,
    () =>
      `${guarantee} g'tee vs ${(pct * 100).toFixed(0)}% of net. Expenses to ${expenseCap}. Hospitality $${hospitalityCap}.${
        bonuses ? ` Performance escalators per the deal memo${bonuses[0].stacks ? " (stacking)" : ""}.` : ""
      }`,
  ];
  return choose(variants)();
}

function generateSellThrough(tier: ArtistDef["tier"]): number {
  const base = { A: 0.85, B: 0.65, C: 0.45, D: 0.25 }[tier];
  const variance = (rnd() - 0.5) * 0.4;
  return Math.max(0.05, Math.min(1.0, base + variance));
}

function generateExpenses(showId: string) {
  type ExpenseRow = typeof expenses.$inferInsert;
  const result: ExpenseRow[] = [];
  let i = 0;
  const add = (
    category: ExpenseRow["category"],
    amount: number,
    description: string | null = null,
    absorbed = false,
  ) => {
    result.push({
      id: `exp_${showId}_${i++}`,
      showId,
      category,
      amount: Math.round(amount * 100) / 100,
      description,
      approved: true,
      absorbedByVenue: absorbed,
      enteredByUserId: MARIANA_ID,
      enteredAt: new Date(),
    });
  };

  add("sound", rndInt(280, 450));
  add("lights", rndInt(150, 250));
  add("production", rndInt(180, 350));
  add("hospitality", rndInt(180, 480));
  if (rnd() < 0.7) add("marketing", rndInt(150, 600), choose(["Spotify ad", "Instagram boost", "Local radio spot"]));
  if (rnd() < 0.4) add("backline", rndInt(120, 280), "Backline rental");
  if (rnd() < 0.3) add("security", rndInt(80, 200));
  if (rnd() < 0.15) add("hospitality", rndInt(50, 120), "Hospitality overage", true);
  return result;
}

function computeSettlement(
  deal: GeneratedDeal,
  gross: number,
  fees: number,
  passThruExpenses: number,
): number {
  const net = gross - fees;
  switch (deal.type) {
    case "flat":
      return deal.guaranteeAmount ?? 0;
    case "percentage_of_gross":
      return gross * (deal.percentage ?? 0);
    case "percentage_of_net": {
      const cappedExpenses = Math.min(passThruExpenses, deal.expenseCap ?? Infinity);
      return Math.max(0, (net - cappedExpenses) * (deal.percentage ?? 0));
    }
    case "vs": {
      const cappedExpenses = Math.min(passThruExpenses, deal.expenseCap ?? Infinity);
      const netAfterExpenses = Math.max(0, net - cappedExpenses);
      const pctPayout = netAfterExpenses * (deal.percentage ?? 0);
      const guarantee = deal.guaranteeAmount ?? 0;
      const base = Math.max(guarantee, pctPayout);
      const bonusPayout = deal.bonuses?.filter((b) => gross >= b.thresholdGross).reduce((s, b) => s + b.amount, 0) ?? 0;
      const bonusesApply = pctPayout >= guarantee || (deal.bonuses?.[0]?.stacks ?? false);
      return base + (bonusesApply ? bonusPayout : 0);
    }
    case "door": {
      const cappedExpenses = Math.min(passThruExpenses, deal.expenseCap ?? Infinity);
      return Math.max(0, gross - cappedExpenses);
    }
  }
}

function dateOffset(days: number): string {
  const d = new Date(TODAY);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

async function main() {
  console.log("🌱 Seeding 18-month Greenroom dataset…");

  await db.delete(settlements);
  await db.delete(expenses);
  await db.delete(ticketSales);
  await db.delete(deals);
  await db.delete(shows);
  await db.delete(artists);
  await db.delete(agents);
  await db.delete(agencies);
  await db.delete(users);
  await db.delete(venues);

  await db.insert(venues).values({ id: VENUE_ID, name: "The Crescent", capacity: VENUE_CAPACITY, city: "Nashville", state: "TN" });
  await db.insert(users).values([
    { id: MARIANA_ID, name: "Mariana Reyes", email: "mariana@thecrescentnashville.com", role: "booker", venueId: VENUE_ID },
    { id: MARCUS_ID, name: "Marcus Holland", email: "marcus@thecrescentnashville.com", role: "gm", venueId: VENUE_ID },
  ]);
  await db.insert(agencies).values(AGENCIES);
  await db.insert(agents).values(AGENT_DEFS);

  const artistAgentMap = new Map<string, string>();
  for (const a of ARTIST_DEFS) artistAgentMap.set(a.id, pickAgentForArtist(a.tier));

  await db.insert(artists).values(
    ARTIST_DEFS.map((a) => ({
      id: a.id,
      name: a.name,
      agentId: artistAgentMap.get(a.id) ?? null,
      genre: a.genre,
      priorShowCount: rndInt(0, a.recurrence + 2),
    })),
  );

  // Build show calendar
  const showsToInsert: (typeof shows.$inferInsert)[] = [];
  const dealsToInsert: (typeof deals.$inferInsert)[] = [];
  const ticketSalesToInsert: (typeof ticketSales.$inferInsert)[] = [];
  const expensesToInsert: (typeof expenses.$inferInsert)[] = [];
  const settlementsToInsert: (typeof settlements.$inferInsert)[] = [];

  const datePool: string[] = [];
  for (let off = -540; off <= 60; off++) {
    const d = new Date(TODAY);
    d.setDate(d.getDate() + off);
    const dow = d.getDay();
    if ((dow === 0 || dow === 1) && rnd() > 0.25) continue;
    datePool.push(dateOffset(off));
  }

  const artistPool: ArtistDef[] = [];
  for (const a of ARTIST_DEFS) {
    const count = Math.max(2, Math.round(a.recurrence * 2 + (rnd() - 0.5) * 2));
    for (let i = 0; i < count; i++) artistPool.push(a);
  }
  for (let i = artistPool.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [artistPool[i], artistPool[j]] = [artistPool[j], artistPool[i]];
  }

  const showCount = Math.min(datePool.length, artistPool.length);
  for (let i = 0; i < showCount; i++) {
    const date = datePool[i];
    const artist = artistPool[i];
    const showId = `show_${i.toString().padStart(4, "0")}`;
    const isPast = new Date(date) < TODAY;

    showsToInsert.push({
      id: showId,
      venueId: VENUE_ID,
      artistId: artist.id,
      date,
      status: isPast ? "settled" : (rnd() < 0.6 ? "booked" : "advanced"),
      doorsTime: choose(["19:00", "19:30", "20:00"]),
      setTime: choose(["20:30", "21:00", "21:30"]),
      roomConfig: weighted([
        { value: "standing" as const, weight: 8 },
        { value: "seated" as const, weight: 1 },
        { value: "mixed" as const, weight: 1 },
      ]),
      createdAt: new Date(date),
    });

    const deal = generateDeal(artist.tier);
    dealsToInsert.push({
      id: `deal_${showId}`,
      showId,
      dealType: deal.type,
      guaranteeAmount: deal.guaranteeAmount,
      percentage: deal.percentage,
      percentageBasis: deal.percentageBasis,
      expenseCap: deal.expenseCap,
      hospitalityCap: deal.hospitalityCap,
      bonusesJson: deal.bonuses ? JSON.stringify(deal.bonuses) : null,
      dealNotesFreetext: deal.notes,
      createdAt: new Date(date),
    });

    if (isPast) {
      const sellThrough = generateSellThrough(artist.tier);
      const ticketCount = Math.round(VENUE_CAPACITY * sellThrough);
      const avgPrice = artist.tier === "A" ? 32 : artist.tier === "B" ? 26 : artist.tier === "C" ? 20 : 15;
      const gross = Math.round(ticketCount * avgPrice * (0.9 + rnd() * 0.2));
      const fees = Math.round(gross * 0.1);

      ticketSalesToInsert.push({
        id: `ts_${showId}`,
        showId,
        qty: ticketCount,
        gross,
        fees,
        capturedAt: new Date(date),
      });

      const showExpenses = generateExpenses(showId);
      expensesToInsert.push(...showExpenses);

      const passThru = showExpenses.filter((e) => !e.absorbedByVenue).reduce((s, e) => s + e.amount, 0);
      const totalToArtist = computeSettlement(deal, gross, fees, passThru);

      settlementsToInsert.push({
        id: `stl_${showId}`,
        showId,
        completedAt: new Date(date),
        completedByUserId: MARIANA_ID,
        grossBoxOffice: gross,
        netBoxOffice: gross - fees,
        totalExpenses: passThru,
        totalToArtist: Math.round(totalToArtist * 100) / 100,
        status: rnd() < 0.05 ? "disputed" : "signed",
        signoffText: choose(["OK. Good night.", "Looks good.", "👍", "ok wire monday", "Sign off."]),
        notes: rnd() < 0.1
          ? choose(["Hospitality $87 absorbed — over rider.", "Backline charge waived.", "Marketing recoup pre-deducted from gross.", "Comp tickets: 12. Revenue impact accepted."])
          : null,
      });
    }
  }

  // Inject the Coastal Spell March 14 2025 dispute referenced in dispute-thread.md
  const coastalDate = "2025-03-14";
  const coastalShowId = "show_coastal_spell_dispute";
  showsToInsert.push({
    id: coastalShowId,
    venueId: VENUE_ID,
    artistId: "art_coastal_spell",
    date: coastalDate,
    status: "settled",
    doorsTime: "19:30",
    setTime: "21:00",
    roomConfig: "standing",
    internalNotes: "[Mariana, March 19] Settlement disputed by Daniel Hwang at WME re: marketing recoup interpretation. Marcus signed off on additional $720 to make it go away. See dispute-thread for full email chain. Going forward — get marketing recoup language explicit in the deal email.",
    createdAt: new Date(coastalDate),
  });
  dealsToInsert.push({
    id: `deal_${coastalShowId}`,
    showId: coastalShowId,
    dealType: "vs",
    guaranteeAmount: 5000,
    percentage: 0.8,
    percentageBasis: "net",
    expenseCap: 2500,
    hospitalityCap: 500,
    bonusesJson: null,
    dealNotesFreetext: "$5,000 vs 80% of net after expenses, expenses capped $2,500. Marketing recoup of $900 against gross. (Note added 3/19/25: this deal email was ambiguous — recoup interpretation disputed by WME, resolved with $720 concession.)",
    createdAt: new Date(coastalDate),
  });
  ticketSalesToInsert.push({ id: `ts_${coastalShowId}`, showId: coastalShowId, qty: 620, gross: 19840, fees: 1984, capturedAt: new Date(coastalDate) });
  for (const [idx, e] of [
    { category: "sound" as const, amount: 400, description: null },
    { category: "lights" as const, amount: 220, description: null },
    { category: "production" as const, amount: 280, description: null },
    { category: "hospitality" as const, amount: 480, description: null },
    { category: "marketing" as const, amount: 900, description: "Marketing recoup — disputed interpretation" },
    { category: "backline" as const, amount: 220, description: null },
  ].entries()) {
    expensesToInsert.push({
      id: `exp_${coastalShowId}_${idx}`,
      showId: coastalShowId,
      category: e.category,
      amount: e.amount,
      description: e.description,
      approved: true,
      absorbedByVenue: false,
      enteredByUserId: MARIANA_ID,
      enteredAt: new Date(coastalDate),
    });
  }
  settlementsToInsert.push({
    id: `stl_${coastalShowId}`,
    showId: coastalShowId,
    completedAt: new Date(coastalDate),
    completedByUserId: MARIANA_ID,
    grossBoxOffice: 19840,
    netBoxOffice: 17856,
    totalExpenses: 2500,
    totalToArtist: 12285,
    status: "disputed",
    signoffText: "OK — but flag any future marketing recoup deals.",
    notes: "Disputed by WME (Daniel Hwang) on 3/18. Marcus authorized additional $720 to resolve. Final settled at $12,285 (vs originally calculated $11,565). See email thread for context. Going forward: deal emails must specify marketing recoup as inside or outside expense cap.",
  });

  // Bulk insert in chunks
  console.log(`   Inserting ${showsToInsert.length} shows…`);
  const chunkArr = <T>(arr: T[], size: number): T[][] =>
    Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, i * size + size));

  for (const c of chunkArr(showsToInsert, 50)) await db.insert(shows).values(c);
  for (const c of chunkArr(dealsToInsert, 50)) await db.insert(deals).values(c);
  for (const c of chunkArr(ticketSalesToInsert, 50)) await db.insert(ticketSales).values(c);
  for (const c of chunkArr(expensesToInsert, 50)) await db.insert(expenses).values(c);
  for (const c of chunkArr(settlementsToInsert, 50)) await db.insert(settlements).values(c);

  console.log("✅ Seeded:");
  console.log(`   1 venue, 2 users`);
  console.log(`   ${AGENCIES.length} agencies, ${AGENT_DEFS.length} agents`);
  console.log(`   ${ARTIST_DEFS.length} artists`);
  console.log(`   ${showsToInsert.length} shows`);
  console.log(`   ${ticketSalesToInsert.length} ticket sale records`);
  console.log(`   ${expensesToInsert.length} expenses`);
  console.log(`   ${settlementsToInsert.length} settlements`);
  console.log(`   1 named dispute (Coastal Spell, March 2025) injected for narrative continuity`);
}

main()
  .then(() => { client.close(); process.exit(0); })
  .catch((err) => { console.error(err); client.close(); process.exit(1); });
