/**
 * Server-side query helpers. Keeps page components clean and gives us
 * a single place to evolve the data layer.
 */

import { db } from "@/db";
import {
  shows,
  artists,
  agents,
  agencies,
  deals,
  ticketSales,
  expenses,
  settlements,
  venues,
} from "@/db/schema";
import { desc, asc, eq } from "drizzle-orm";

export async function getAllShows() {
  return db
    .select({
      show: shows,
      artist: artists,
      agent: agents,
      deal: deals,
      settlement: settlements,
    })
    .from(shows)
    .leftJoin(artists, eq(shows.artistId, artists.id))
    .leftJoin(agents, eq(artists.agentId, agents.id))
    .leftJoin(deals, eq(deals.showId, shows.id))
    .leftJoin(settlements, eq(settlements.showId, shows.id))
    .orderBy(asc(shows.date));
}

export async function getShowById(id: string) {
  const rows = await db
    .select({
      show: shows,
      artist: artists,
      agent: agents,
      agency: agencies,
      deal: deals,
      settlement: settlements,
      venue: venues,
    })
    .from(shows)
    .leftJoin(artists, eq(shows.artistId, artists.id))
    .leftJoin(agents, eq(artists.agentId, agents.id))
    .leftJoin(agencies, eq(agents.agencyId, agencies.id))
    .leftJoin(deals, eq(deals.showId, shows.id))
    .leftJoin(settlements, eq(settlements.showId, shows.id))
    .leftJoin(venues, eq(shows.venueId, venues.id))
    .where(eq(shows.id, id));

  if (rows.length === 0) return null;
  const row = rows[0];

  const [showTicketSales, showExpenses] = await Promise.all([
    db
      .select()
      .from(ticketSales)
      .where(eq(ticketSales.showId, id))
      .orderBy(desc(ticketSales.capturedAt)),
    db
      .select()
      .from(expenses)
      .where(eq(expenses.showId, id))
      .orderBy(asc(expenses.enteredAt)),
  ]);

  return {
    ...row,
    ticketSales: showTicketSales,
    expenses: showExpenses,
  };
}

export type ShowWithRelations = NonNullable<
  Awaited<ReturnType<typeof getShowById>>
>;
