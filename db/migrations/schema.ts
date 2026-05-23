import { sqliteTable, AnySQLiteColumn, text, foreignKey, integer, real, uniqueIndex } from "drizzle-orm/sqlite-core"
  import { sql } from "drizzle-orm"

export const agencies = sqliteTable("agencies", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
});

export const agents = sqliteTable("agents", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	agencyId: text("agency_id").references(() => agencies.id),
	email: text().notNull(),
	phone: text(),
	preferencesNotes: text("preferences_notes"),
});

export const artists = sqliteTable("artists", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	agentId: text("agent_id").references(() => agents.id),
	managerEmail: text("manager_email"),
	genre: text(),
	priorShowCount: integer("prior_show_count").default(0).notNull(),
});

export const comps = sqliteTable("comps", {
	id: text().primaryKey().notNull(),
	showId: text("show_id").notNull().references(() => shows.id),
	category: text().notNull(),
	count: integer().notNull(),
	faceValue: real("face_value").notNull(),
	countsTowardGross: integer("counts_toward_gross").default(false).notNull(),
	notes: text(),
});

export const deals = sqliteTable("deals", {
	id: text().primaryKey().notNull(),
	showId: text("show_id").notNull().references(() => shows.id),
	dealType: text("deal_type").notNull(),
	guaranteeAmount: real("guarantee_amount"),
	percentage: real(),
	percentageBasis: text("percentage_basis"),
	expenseCap: real("expense_cap"),
	hospitalityCap: real("hospitality_cap"),
	bonusesJson: text("bonuses_json"),
	dealNotesFreetext: text("deal_notes_freetext"),
	createdAt: integer("created_at").notNull(),
},
(table) => [
	uniqueIndex("deals_show_id_unique").on(table.showId),
]);

export const expenses = sqliteTable("expenses", {
	id: text().primaryKey().notNull(),
	showId: text("show_id").notNull().references(() => shows.id),
	category: text().notNull(),
	amount: real().notNull(),
	description: text(),
	approved: integer().default(true).notNull(),
	absorbedByVenue: integer("absorbed_by_venue").default(false).notNull(),
	enteredByUserId: text("entered_by_user_id").references(() => users.id),
	enteredAt: integer("entered_at").notNull(),
});

export const settlements = sqliteTable("settlements", {
	id: text().primaryKey().notNull(),
	showId: text("show_id").notNull().references(() => shows.id),
	status: text().default("draft").notNull(),
	draftedAt: integer("drafted_at"),
	submittedAt: integer("submitted_at"),
	reviewStartedAt: integer("review_started_at"),
	signedAt: integer("signed_at"),
	disputedAt: integer("disputed_at"),
	revisedAt: integer("revised_at"),
	finalizedAt: integer("finalized_at"),
	paidAt: integer("paid_at"),
	completedAt: integer("completed_at"),
	completedByUserId: text("completed_by_user_id").references(() => users.id),
	grossBoxOffice: real("gross_box_office"),
	netBoxOffice: real("net_box_office"),
	totalExpenses: real("total_expenses"),
	totalToArtist: real("total_to_artist"),
	calculationJson: text("calculation_json"),
	recoupsJson: text("recoups_json"),
	signoffText: text("signoff_text"),
	notes: text(),
},
(table) => [
	uniqueIndex("settlements_show_id_unique").on(table.showId),
]);

export const shows = sqliteTable("shows", {
	id: text().primaryKey().notNull(),
	venueId: text("venue_id").notNull().references(() => venues.id),
	artistId: text("artist_id").notNull().references(() => artists.id),
	date: text().notNull(),
	status: text().default("booked").notNull(),
	doorsTime: text("doors_time"),
	setTime: text("set_time"),
	openerArtistId: text("opener_artist_id").references(() => artists.id),
	roomConfig: text("room_config").default("standing").notNull(),
	internalNotes: text("internal_notes"),
	createdAt: integer("created_at").notNull(),
});

export const ticketSales = sqliteTable("ticket_sales", {
	id: text().primaryKey().notNull(),
	showId: text("show_id").notNull().references(() => shows.id),
	qty: integer().notNull(),
	gross: real().notNull(),
	fees: real().notNull(),
	capturedAt: integer("captured_at").notNull(),
});

export const users = sqliteTable("users", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	email: text().notNull(),
	role: text().notNull(),
	venueId: text("venue_id").notNull(),
},
(table) => [
	uniqueIndex("users_email_unique").on(table.email),
]);

export const venues = sqliteTable("venues", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	capacity: integer().notNull(),
	city: text().notNull(),
	state: text().notNull(),
});

export const canonicalDeals = sqliteTable("canonical_deals", {
	id: text().primaryKey().notNull(),
	dealId: text("deal_id").notNull().references(() => deals.id),
	proseSnapshot: text("prose_snapshot").notNull(),
	dealType: text("deal_type"),
	guaranteeAmount: real("guarantee_amount"),
	percentage: real(),
	percentageBasis: text("percentage_basis"),
	expenseCap: real("expense_cap"),
	hospitalityCap: real("hospitality_cap"),
	bonusesJson: text("bonuses_json"),
	recoupExpectationsJson: text("recoup_expectations_json"),
	fieldConfidenceJson: text("field_confidence_json"),
	status: text().default("draft").notNull(),
	reviewedByUserId: text("reviewed_by_user_id").references(() => users.id),
	reviewedAt: integer("reviewed_at"),
	createdAt: integer("created_at").notNull(),
	updatedAt: integer("updated_at").notNull(),
},
(table) => [
	uniqueIndex("canonical_deals_deal_id_unique").on(table.dealId),
]);

export const dealAmbiguities = sqliteTable("deal_ambiguities", {
	id: text().primaryKey().notNull(),
	canonicalDealId: text("canonical_deal_id").notNull().references(() => canonicalDeals.id),
	type: text().notNull(),
	severity: text().notNull(),
	proseSpanStart: integer("prose_span_start"),
	proseSpanEnd: integer("prose_span_end"),
	summary: text().notNull(),
	possibleReadingsJson: text("possible_readings_json").notNull(),
	suggestedActionsJson: text("suggested_actions_json"),
	status: text().default("open").notNull(),
	resolutionNote: text("resolution_note"),
	resolvedAt: integer("resolved_at"),
	resolvedByUserId: text("resolved_by_user_id").references(() => users.id),
	linkedSettlementId: text("linked_settlement_id").references(() => settlements.id),
	createdAt: integer("created_at").notNull(),
});

export const dealShareTokens = sqliteTable("deal_share_tokens", {
	id: text().primaryKey().notNull(),
	canonicalDealId: text("canonical_deal_id").notNull().references(() => canonicalDeals.id),
	token: text().notNull(),
	sharedWithEmail: text("shared_with_email"),
	createdAt: integer("created_at").notNull(),
	expiresAt: integer("expires_at"),
	firstViewedAt: integer("first_viewed_at"),
	lastViewedAt: integer("last_viewed_at"),
	status: text().default("pending").notNull(),
	agentResponseJson: text("agent_response_json"),
	agentResponseAt: integer("agent_response_at"),
},
(table) => [
	uniqueIndex("deal_share_tokens_token_unique").on(table.token),
]);

