# Greenroom

Software for independent music venues. This is the starter codebase for the Greenroom Senior PM case study.

You're looking at a working but mediocre product. It's enough to feel real, but every workflow has gaps. **Your job isn't to fix everything — it's to pick a slice and design it well.** See your case study brief for full instructions.

---

## Quickstart

Requirements: **Node 20+**, npm.

```bash
npm install
npm run db:reset    # fresh SQLite + seed data (~5 seconds)
npm run dev         # starts on http://localhost:3000
```

That's it. No Docker, no Postgres server, no env vars, no auth. The database is a single SQLite file at `data/greenroom.db`, committed and seeded.

If you want to inspect the data directly, `npm run db:studio` opens [Drizzle Studio](https://orm.drizzle.team/drizzle-studio/overview) at `local.drizzle.studio`.

---

## Tour

You log in automatically as **Mariana Reyes**, lead booker at The Crescent (650-cap, Nashville). The app has these surfaces:

- **`/shows`** — calendar of upcoming and recent shows. The home view.
- **`/shows/[id]`** — show detail page. Deal terms, artist info, ticket sales, expenses, settlement.
- **`/shows/[id]/settle`** — the in-app settlement worksheet. **Try this on a few shows.** You'll quickly see why most bookers default to spreadsheets.

Recommended path your first time through:
1. Open `/shows` and pick an upcoming show with a "Vs deal" badge.
2. Read the deal terms. Note the difference between the structured fields and the free-text "deal notes."
3. Click "Settle" and see what happens.
4. Try the same on a flat-guarantee show. Note the difference.
5. Read `data/transcripts/*.md` and `data/ceo-memo.md` for context.

---

## How the data is shaped

Eighteen months of synthetic operational data, designed to feel like a real venue:

| Table | Approx rows | What it represents |
|---|---|---|
| `shows` | ~370 | Shows over 18 months, with ~30 upcoming |
| `artists` | ~85 | Mix of recurring and one-off acts |
| `agents` | ~30 | Across WME, CAA, Wasserman, and independents |
| `deals` | ~370 | One per show. Mix of flat (~25%), vs (~50%), percentage-of-net (~15%), door (~5%), percentage-of-gross (~5%) |
| `ticket_sales` | hundreds | Per-show, with realistic sell-through distributions |
| `expenses` | ~1,500 | Sound, lights, hospitality, marketing, production, etc. |
| `settlements` | ~340 | Past shows mostly settled. Some have disputes. |

**Two things to know about the data:**

1. **The deal `notes_freetext` field is the truth.** The structured fields (`guarantee_amount`, `percentage`, `bonuses_json`) are filled inconsistently. Mariana enters deals as prose because the structured fields don't model the actual deals well. This mismatch is part of the realism.

2. **Past settlements have a `calculation_json` field** capturing the math. Some are straightforward. Some have absorbed expenses, hospitality overages, or disputed line items. Browse a few of these to understand how settlement actually plays out.

---

## Where to look for context

```
data/
├── ceo-memo.md            # The "winning on completeness, losing on craft" memo
├── dispute-thread.md      # The March 2025 marketing-recoup dispute, in full
└── transcripts/
    ├── mariana.md         # 30-min interview with the booker
    ├── diego.md           # Tour manager perspective
    ├── marcus.md          # GM perspective
    └── sarah-kim.md       # Agent perspective (WME)
```

These aren't decorative. They contain signals the seeded database deliberately doesn't capture — Mariana's frustrations, the agent's pet peeves, the things that escalate disputes. Mine them.

---

## Tech stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS 4** with shadcn-style component primitives
- **Drizzle ORM** + **libsql** (pure-JS SQLite — no native compile)
- **lucide-react** for icons, **date-fns** for dates

Everything is deliberately conventional. You can use Cursor, Claude Code, or any other AI tool to navigate and modify this codebase fluently.

---

## File map

```
app/
  shows/                    # Show calendar and detail pages
  shows/[id]/settle/        # The in-app settlement worksheet
components/
  ui/                       # Buttons, badges, cards
  layout/sidebar.tsx
lib/
  dealMath.ts               # The settlement engine (deliberately incomplete)
  queries.ts                # Server-side data fetching
  format.ts                 # Money + date helpers
db/
  schema.ts                 # All 10 tables, commented
  seed.ts                   # The 18-month synthetic seed
  index.ts                  # libsql + Drizzle client
data/                       # Markdown context files (CEO memo, transcripts, etc.)
```

---

## What we expect from you

- **A focused slice, taken end-to-end.** Don't try to fix everything. See `What we care about` in your case study brief.
- **A 3–5 page PRD-quality memo** explaining your choices.
- **A 5–10 minute Loom** walking us through the prototype.
- **A forked repo** with your changes. Commit history matters — we'll look at how you iterated.

Welcome to The Crescent.
