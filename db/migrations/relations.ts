import { relations } from "drizzle-orm/relations";
import { agencies, agents, artists, shows, comps, deals, users, expenses, settlements, venues, ticketSales, canonicalDeals, dealAmbiguities, dealShareTokens } from "./schema";

export const agentsRelations = relations(agents, ({one, many}) => ({
	agency: one(agencies, {
		fields: [agents.agencyId],
		references: [agencies.id]
	}),
	artists: many(artists),
}));

export const agenciesRelations = relations(agencies, ({many}) => ({
	agents: many(agents),
}));

export const artistsRelations = relations(artists, ({one, many}) => ({
	agent: one(agents, {
		fields: [artists.agentId],
		references: [agents.id]
	}),
	shows_openerArtistId: many(shows, {
		relationName: "shows_openerArtistId_artists_id"
	}),
	shows_artistId: many(shows, {
		relationName: "shows_artistId_artists_id"
	}),
}));

export const compsRelations = relations(comps, ({one}) => ({
	show: one(shows, {
		fields: [comps.showId],
		references: [shows.id]
	}),
}));

export const showsRelations = relations(shows, ({one, many}) => ({
	comps: many(comps),
	deals: many(deals),
	expenses: many(expenses),
	settlements: many(settlements),
	artist_openerArtistId: one(artists, {
		fields: [shows.openerArtistId],
		references: [artists.id],
		relationName: "shows_openerArtistId_artists_id"
	}),
	artist_artistId: one(artists, {
		fields: [shows.artistId],
		references: [artists.id],
		relationName: "shows_artistId_artists_id"
	}),
	venue: one(venues, {
		fields: [shows.venueId],
		references: [venues.id]
	}),
	ticketSales: many(ticketSales),
}));

export const dealsRelations = relations(deals, ({one, many}) => ({
	show: one(shows, {
		fields: [deals.showId],
		references: [shows.id]
	}),
	canonicalDeals: many(canonicalDeals),
}));

export const expensesRelations = relations(expenses, ({one}) => ({
	user: one(users, {
		fields: [expenses.enteredByUserId],
		references: [users.id]
	}),
	show: one(shows, {
		fields: [expenses.showId],
		references: [shows.id]
	}),
}));

export const usersRelations = relations(users, ({many}) => ({
	expenses: many(expenses),
	settlements: many(settlements),
	canonicalDeals: many(canonicalDeals),
	dealAmbiguities: many(dealAmbiguities),
}));

export const settlementsRelations = relations(settlements, ({one, many}) => ({
	user: one(users, {
		fields: [settlements.completedByUserId],
		references: [users.id]
	}),
	show: one(shows, {
		fields: [settlements.showId],
		references: [shows.id]
	}),
	dealAmbiguities: many(dealAmbiguities),
}));

export const venuesRelations = relations(venues, ({many}) => ({
	shows: many(shows),
}));

export const ticketSalesRelations = relations(ticketSales, ({one}) => ({
	show: one(shows, {
		fields: [ticketSales.showId],
		references: [shows.id]
	}),
}));

export const canonicalDealsRelations = relations(canonicalDeals, ({one, many}) => ({
	user: one(users, {
		fields: [canonicalDeals.reviewedByUserId],
		references: [users.id]
	}),
	deal: one(deals, {
		fields: [canonicalDeals.dealId],
		references: [deals.id]
	}),
	dealAmbiguities: many(dealAmbiguities),
	dealShareTokens: many(dealShareTokens),
}));

export const dealAmbiguitiesRelations = relations(dealAmbiguities, ({one}) => ({
	settlement: one(settlements, {
		fields: [dealAmbiguities.linkedSettlementId],
		references: [settlements.id]
	}),
	user: one(users, {
		fields: [dealAmbiguities.resolvedByUserId],
		references: [users.id]
	}),
	canonicalDeal: one(canonicalDeals, {
		fields: [dealAmbiguities.canonicalDealId],
		references: [canonicalDeals.id]
	}),
}));

export const dealShareTokensRelations = relations(dealShareTokens, ({one}) => ({
	canonicalDeal: one(canonicalDeals, {
		fields: [dealShareTokens.canonicalDealId],
		references: [canonicalDeals.id]
	}),
}));