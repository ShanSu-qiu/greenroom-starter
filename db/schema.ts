/**
 * Greenroom database schema.
 *
 * The data model is deliberately simple but realistic enough to support
 * the settlement workflows. Mariana (the booker at The Crescent) is the
 * primary user. Other personas (tour managers, agents, the GM) appear
 * in the data but don't have UI here.
 */

import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

// -------- Users (operator accounts at the venue) --------

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  role: text("role", {
    enum: ["booker", "gm", "production", "box_office"],
  }).notNull(),
  venueId: text("venue_id").notNull(),
});

// -------- Venues --------

export const venues = sqliteTable("venues", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  capacity: integer("capacity").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
});

// -------- Agencies & Agents --------

export const agencies = sqliteTable("agencies", {
  id: text("id").primaryKey(),
  name: text("name").notNull(), // "WME", "CAA", "Wasserman", "independent"
});

export const agents = sqliteTable("agents", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  agencyId: text("agency_id").references(() => agencies.id),
  email: text("email").notNull(),
  phone: text("phone"),
  // Free-form notes Mariana keeps about working with this agent.
  // Things like "always wants settlement statement formatted with their template"
  // or "pushed back hard on hospitality overage last March".
  preferencesNotes: text("preferences_notes"),
});

// -------- Artists --------

export const artists = sqliteTable("artists", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  agentId: text("agent_id").references(() => agents.id),
  managerEmail: text("manager_email"),
  genre: text("genre"),
  // How many times this artist has played The Crescent before. Useful for trust signals.
  priorShowCount: integer("prior_show_count").notNull().default(0),
});

// -------- Shows --------

export const shows = sqliteTable("shows", {
  id: text("id").primaryKey(),
  venueId: text("venue_id")
    .notNull()
    .references(() => venues.id),
  artistId: text("artist_id")
    .notNull()
    .references(() => artists.id),
  // Show date as ISO 8601 string (e.g. "2026-05-15"). We store as text rather
  // than integer-epoch because the candidate's mental model and our seed data
  // both speak in calendar dates.
  date: text("date").notNull(),
  status: text("status", {
    enum: ["booked", "advanced", "day_of", "settled", "closed"],
  })
    .notNull()
    .default("booked"),
  doorsTime: text("doors_time"), // "19:00"
  setTime: text("set_time"), // "21:00"
  openerArtistId: text("opener_artist_id").references(() => artists.id),
  roomConfig: text("room_config", { enum: ["standing", "seated", "mixed"] })
    .notNull()
    .default("standing"),
  // Mariana's running notes on the show. Free-text. Often where the truth lives.
  internalNotes: text("internal_notes"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// -------- Deals --------

/**
 * One deal per show. The structure here is deliberately split:
 *
 *  - `dealType` and the structured fields (guarantee, percentage, etc.)
 *    are what the in-app settlement tool reads.
 *  - `dealNotesFreetext` is what Mariana actually trusts. She negotiates
 *    over email, pastes the deal into prose, and reads it manually each
 *    time she settles. Sometimes the structured fields and free text agree.
 *    Sometimes they don't. The system has no way to know.
 *
 * This is the seam the case study lives on.
 */
export const deals = sqliteTable("deals", {
  id: text("id").primaryKey(),
  showId: text("show_id")
    .notNull()
    .unique()
    .references(() => shows.id),

  // Structured fields. Filled in inconsistently.
  dealType: text("deal_type", {
    enum: ["flat", "percentage_of_gross", "percentage_of_net", "vs", "door"],
  }).notNull(),
  guaranteeAmount: real("guarantee_amount"), // dollars, e.g. 3500
  percentage: real("percentage"), // 0..1, e.g. 0.85 for 85%
  percentageBasis: text("percentage_basis", { enum: ["gross", "net"] }),
  expenseCap: real("expense_cap"),
  hospitalityCap: real("hospitality_cap"),

  // Bonus tiers as JSON. Each: { thresholdGross: number, amount: number, stacks: boolean }
  // Stored as JSON string in SQLite.
  bonusesJson: text("bonuses_json"),

  // The free-text version. The truth, as far as Mariana is concerned.
  dealNotesFreetext: text("deal_notes_freetext"),

  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// -------- Ticket sales (POS feed) --------

/**
 * Real-time ticket sales from the integrated POS. A row per sale event.
 * Aggregated upward to compute gross/net at settlement time.
 */
export const ticketSales = sqliteTable("ticket_sales", {
  id: text("id").primaryKey(),
  showId: text("show_id")
    .notNull()
    .references(() => shows.id),
  qty: integer("qty").notNull(),
  gross: real("gross").notNull(), // dollars
  fees: real("fees").notNull(), // CC + platform fees
  // net = gross - fees
  capturedAt: integer("captured_at", { mode: "timestamp" }).notNull(),
});

// -------- Expenses (show-level) --------

export const expenses = sqliteTable("expenses", {
  id: text("id").primaryKey(),
  showId: text("show_id")
    .notNull()
    .references(() => shows.id),
  category: text("category", {
    enum: [
      "production",
      "sound",
      "lights",
      "hospitality",
      "marketing",
      "backline",
      "security",
      "other",
    ],
  }).notNull(),
  amount: real("amount").notNull(),
  description: text("description"),
  // Was this expense pre-approved in the deal, or did it come up later?
  approved: integer("approved", { mode: "boolean" }).notNull().default(true),
  // If true, the venue is eating this rather than passing it through to the artist.
  absorbedByVenue: integer("absorbed_by_venue", { mode: "boolean" })
    .notNull()
    .default(false),
  enteredByUserId: text("entered_by_user_id").references(() => users.id),
  enteredAt: integer("entered_at", { mode: "timestamp" }).notNull(),
});

// -------- Settlements --------

/**
 * The result of the 2am ritual. One per show, created when Mariana
 * finalizes the math.
 */
export const settlements = sqliteTable("settlements", {
  id: text("id").primaryKey(),
  showId: text("show_id")
    .notNull()
    .unique()
    .references(() => shows.id),
  completedAt: integer("completed_at", { mode: "timestamp" }),
  completedByUserId: text("completed_by_user_id").references(() => users.id),

  grossBoxOffice: real("gross_box_office"),
  netBoxOffice: real("net_box_office"),
  totalExpenses: real("total_expenses"),
  totalToArtist: real("total_to_artist"),

  // The math, captured as JSON for audit purposes.
  // { steps: [{ label, value, source }], finalFormula: string }
  calculationJson: text("calculation_json"),

  status: text("status", {
    enum: ["draft", "signed", "reconciled", "disputed"],
  })
    .notNull()
    .default("draft"),

  // The text Marcus sent approving. "OK. Good night." etc.
  signoffText: text("signoff_text"),
  // Mariana's notes on what she absorbed, why, etc.
  notes: text("notes"),
});

// -------- Type exports for convenience --------

export type User = typeof users.$inferSelect;
export type Venue = typeof venues.$inferSelect;
export type Agency = typeof agencies.$inferSelect;
export type Agent = typeof agents.$inferSelect;
export type Artist = typeof artists.$inferSelect;
export type Show = typeof shows.$inferSelect;
export type Deal = typeof deals.$inferSelect;
export type TicketSale = typeof ticketSales.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
export type Settlement = typeof settlements.$inferSelect;
