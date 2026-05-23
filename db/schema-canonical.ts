/**
 * Slice B — Canonical Deal Extraction & Ambiguity Surfacing
 *
 * ADDITIVE-ONLY schema. Zero modifications to existing tables.
 *
 *   canonical_deals       — Mariana-reviewed structured version of a deal,
 *                           extracted from dealNotesFreetext. Shadows the
 *                           existing `deals` row via FK; settlement engine
 *                           is unaffected.
 *   deal_ambiguities      — Flags surfaced during extraction. One row per
 *                           ambiguity, six taxonomy types (see Taxonomy v1).
 *   deal_share_tokens     — Magic-link tokens letting agents confirm a
 *                           canonical deal without needing a Greenroom login.
 *
 * Design notes:
 *   - canonical_deals.dealId is UNIQUE — one canonical per deal.
 *   - canonical_deals.recoupExpectationsJson lifts recoup from settlement-
 *     time to deal-time. This is the only conceptual extension; everything
 *     else mirrors existing deals.* columns.
 *   - deal_ambiguities.linkedSettlementId enables retrospective dispute
 *     attribution (skipped flag -> downstream dispute) without changing
 *     the settlements table.
 *   - All read-paths fall back to deals.* when no canonical_deals row
 *     exists — 24 months of seeded history works with zero backfill.
 */

import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { deals, users, settlements } from "./schema";

// -------- canonical_deals --------

export const canonicalDeals = sqliteTable("canonical_deals", {
  id: text("id").primaryKey(),
  dealId: text("deal_id")
    .notNull()
    .unique()
    .references(() => deals.id),

  // Prose snapshot at the moment of extraction. If deals.dealNotesFreetext
  // changes later, this snapshot is how we detect that the canonical is stale.
  proseSnapshot: text("prose_snapshot").notNull(),

  // Extracted structured fields. Same shape as deals.* but always populated
  // by LLM + reviewed by Mariana. Null = "not detected in prose".
  dealType: text("deal_type", {
    enum: ["flat", "percentage_of_gross", "percentage_of_net", "vs", "door"],
  }),
  guaranteeAmount: real("guarantee_amount"),
  percentage: real("percentage"),
  percentageBasis: text("percentage_basis", { enum: ["gross", "net"] }),
  expenseCap: real("expense_cap"),
  hospitalityCap: real("hospitality_cap"),

  // Bonuses, same JSON shape as deals.bonusesJson (see schema.ts).
  bonusesJson: text("bonuses_json"),

  // RECOUP EXPECTATIONS — the conceptual extension. Recoups agreed at deal
  // time, before the show. Shape:
  //   [
  //     {
  //       id: string,
  //       label: string,                          // "Marketing recoup — Spotify pre-show"
  //       category: "marketing" | "hospitality_overage" | "production_overage"
  //                 | "prior_advance" | "damages" | "other",
  //       amount: number,
  //       appliedAgainst: "gross" | "net",        // basis
  //       scopeRelativeToExpenseCap:              // critical: drives A1 detection
  //         "INSIDE" | "OUTSIDE" | "AMBIGUOUS" | "NOT_APPLICABLE"
  //     }
  //   ]
  recoupExpectationsJson: text("recoup_expectations_json"),

  // Per-field LLM confidence. Shape: { fieldName: 0.0-1.0 }
  // Drives the confidence-tiered UI display.
  fieldConfidenceJson: text("field_confidence_json"),

  // Review lifecycle.
  status: text("status", {
    enum: [
      "draft",                 // LLM extracted, not yet reviewed
      "reviewed_by_venue",     // Mariana accepted/edited
      "shared_with_agent",     // magic link sent
      "confirmed_by_agent",    // agent clicked confirm
      "agent_flagged",         // agent disagreed on a field
      "needs_reconciliation",  // post-confirm conflict surfaced
    ],
  })
    .notNull()
    .default("draft"),

  reviewedByUserId: text("reviewed_by_user_id").references(() => users.id),
  reviewedAt: integer("reviewed_at", { mode: "timestamp" }),

  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// -------- deal_ambiguities --------

export const dealAmbiguities = sqliteTable("deal_ambiguities", {
  id: text("id").primaryKey(),
  canonicalDealId: text("canonical_deal_id")
    .notNull()
    .references(() => canonicalDeals.id),

  // Taxonomy v1 — keep this enum in sync with the prompt.
  type: text("type", {
    enum: [
      "scope_ambiguity",          // A1 — Coastal Spell pattern
      "structural_prose_drift",   // A2 — detected by code, not LLM
      "missing_specification",    // A3 — "see email thread"
      "temporal_amendment",       // A4 — phone-call updates
      "undefined_terminology",    // A5 — walkout, breakeven, etc.
      "calculation_order",        // A6 — deduction order matters
    ],
  }).notNull(),

  severity: text("severity", { enum: ["high", "medium", "low"] }).notNull(),

  // Character offsets into proseSnapshot — used for inline highlight in the
  // review UI. Both null when the flag is structural (e.g. A2 doesn't anchor
  // to a single span).
  proseSpanStart: integer("prose_span_start"),
  proseSpanEnd: integer("prose_span_end"),

  // Human-readable one-line summary, shown in the right-panel flag list.
  summary: text("summary").notNull(),

  // Possible readings. Shape:
  //   [
  //     {
  //       label: string,                // "Inside cap"
  //       reading: string,               // full explanation
  //       implication: string,          // "Artist receives $X less"
  //       impliedPayoutDeltaUsd: number | null
  //     }
  //   ]
  possibleReadingsJson: text("possible_readings_json").notNull(),

  // Suggested actions. Shape:
  //   [{ kind: "edit_prose" | "confirm_reading" | "defer_to_agent"
  //          | "fill_missing_params" | "select_definition" | "specify_order",
  //      label: string,
  //      payload?: object }]
  suggestedActionsJson: text("suggested_actions_json"),

  status: text("status", {
    enum: [
      "open",
      "resolved_by_edit",
      "resolved_by_confirm_reading",
      "deferred_to_agent",
      "dismissed",
      "venue_confirmed",
      "disputed",
    ],
  })
    .notNull()
    .default("open"),

  // Which reading the venue picked (index as string). Populated by
  // venueConfirmReadingAction; null until venue acts.
  venueConfirmedReadingId: text("venue_confirmed_reading_id"),

  resolutionNote: text("resolution_note"),
  resolvedAt: integer("resolved_at", { mode: "timestamp" }),
  resolvedByUserId: text("resolved_by_user_id").references(() => users.id),

  // Set during dispute analysis: if a settlement.status == "disputed" can be
  // traced back to this ambiguity (by prose-span or term-match), we link it.
  // Powers the flag_skip_cost metric without altering settlements table.
  linkedSettlementId: text("linked_settlement_id").references(
    () => settlements.id,
  ),

  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// -------- deal_share_tokens --------

export const dealShareTokens = sqliteTable("deal_share_tokens", {
  id: text("id").primaryKey(),
  canonicalDealId: text("canonical_deal_id")
    .notNull()
    .references(() => canonicalDeals.id),

  // URL-safe random string, ~32 chars. Used as path segment in
  // /share/deal/[token]. Indexed implicitly by UNIQUE.
  token: text("token").notNull().unique(),

  sharedWithEmail: text("shared_with_email"),

  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }),

  firstViewedAt: integer("first_viewed_at", { mode: "timestamp" }),
  lastViewedAt: integer("last_viewed_at", { mode: "timestamp" }),

  status: text("status", {
    enum: ["pending", "viewed", "confirmed", "flagged"],
  })
    .notNull()
    .default("pending"),

  // Per-field response from agent. Shape:
  //   { dealType: { action: "confirm" | "flag", comment?: string },
  //     guaranteeAmount: { ... }, ... }
  agentResponseJson: text("agent_response_json"),
  agentResponseAt: integer("agent_response_at", { mode: "timestamp" }),
});

// -------- Type exports --------

export type CanonicalDeal = typeof canonicalDeals.$inferSelect;
export type DealAmbiguity = typeof dealAmbiguities.$inferSelect;
export type DealShareToken = typeof dealShareTokens.$inferSelect;

// -------- Decoded JSON helpers --------

export type RecoupExpectation = {
  id: string;
  label: string;
  category:
    | "marketing"
    | "hospitality_overage"
    | "production_overage"
    | "prior_advance"
    | "damages"
    | "other";
  amount: number;
  appliedAgainst: "gross" | "net";
  scopeRelativeToExpenseCap:
    | "INSIDE"
    | "OUTSIDE"
    | "AMBIGUOUS"
    | "NOT_APPLICABLE";
};

export type AmbiguityType = DealAmbiguity["type"];

export type PossibleReading = {
  label: string;
  reading: string;
  implication: string;
  impliedPayoutDeltaUsd: number | null;
};

export type SuggestedAction =
  | { kind: "edit_prose"; label: string }
  | { kind: "confirm_reading"; label: string; readingIndex: number }
  | { kind: "defer_to_agent"; label: string; draftEmailText?: string }
  | { kind: "fill_missing_params"; label: string; missingFields: string[] }
  | { kind: "select_definition"; label: string; definitions: string[] }
  | { kind: "specify_order"; label: string };

export type FieldConfidence = Record<string, number>;

export type AgentFieldResponse = {
  action: "confirm" | "flag";
  comment?: string;
};
