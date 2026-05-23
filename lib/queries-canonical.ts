import { eq, and, inArray, desc, isNotNull, ne } from "drizzle-orm";
import { db } from "@/db";
import { deals, shows, artists, type Deal, type Show, type Artist } from "@/db/schema";
import { canonicalDeals, dealAmbiguities, dealShareTokens, type CanonicalDeal, type DealShareToken } from "@/db/schema-canonical";
import { UNRESOLVED_AMBIGUITY_STATUSES } from "@/lib/ambiguity-status";

export type CanonicalDealRow = typeof canonicalDeals.$inferSelect;
export type DealAmbiguityRow = typeof dealAmbiguities.$inferSelect;

export type DealReviewData = {
  canonicalDeal: CanonicalDealRow;
  ambiguities: DealAmbiguityRow[];
} | null;

export async function getDealReviewData(dealId: string): Promise<DealReviewData> {
  const [canonical] = await db
    .select()
    .from(canonicalDeals)
    .where(eq(canonicalDeals.dealId, dealId));
  if (!canonical) return null;
  const ambiguities = await db
    .select()
    .from(dealAmbiguities)
    .where(eq(dealAmbiguities.canonicalDealId, canonical.id));
  return { canonicalDeal: canonical, ambiguities };
}

export type AgentFieldResponse = {
  action: "confirm" | "flag";
  comment?: string;
  readingId?: string;
};

export type ShowDealView = {
  original: Deal;
  canonical: CanonicalDeal | null;
  unresolvedCount: number;
  agentResponses: Record<string, AgentFieldResponse> | null;
};

export async function getShowDealView(showId: string): Promise<ShowDealView> {
  const [show] = await db
    .select()
    .from(shows)
    .where(eq(shows.id, showId));
  if (!show) throw new Error(`Show not found: ${showId}`);

  const [deal] = await db
    .select()
    .from(deals)
    .where(eq(deals.showId, showId));
  if (!deal) throw new Error(`Deal not found for show: ${showId}`);

  const [canonical] = await db
    .select()
    .from(canonicalDeals)
    .where(eq(canonicalDeals.dealId, deal.id));

  let unresolvedCount = 0;
  if (canonical) {
    const unresolved = await db
      .select()
      .from(dealAmbiguities)
      .where(
        and(
          eq(dealAmbiguities.canonicalDealId, canonical.id),
          inArray(dealAmbiguities.status, [...UNRESOLVED_AMBIGUITY_STATUSES]),
        ),
      );
    unresolvedCount = unresolved.length;
  }

  let agentResponses: Record<string, AgentFieldResponse> | null = null;
  if (canonical) {
    const tokens = await db
      .select()
      .from(dealShareTokens)
      .where(
        and(
          eq(dealShareTokens.canonicalDealId, canonical.id),
          isNotNull(dealShareTokens.agentResponseJson),
          ne(dealShareTokens.agentResponseJson, ""),
        ),
      )
      .orderBy(desc(dealShareTokens.createdAt))
      .limit(1);
    const latest = tokens[0];
    if (latest?.agentResponseJson) {
      try {
        agentResponses = JSON.parse(latest.agentResponseJson);
      } catch {
        // ignore
      }
    }
  }

  return { original: deal, canonical: canonical ?? null, unresolvedCount, agentResponses };
}

export type AgentReviewData = {
  shareToken: DealShareToken;
  canonical: CanonicalDeal;
  ambiguities: DealAmbiguityRow[];
  original: Deal;
  show: Show;
  artist: Artist | null;
};

export async function getAgentReviewData(
  token: string,
): Promise<AgentReviewData | null> {
  const [shareToken] = await db
    .select()
    .from(dealShareTokens)
    .where(eq(dealShareTokens.token, token));
  if (!shareToken) return null;

  // Check expiry
  if (shareToken.expiresAt && shareToken.expiresAt < new Date()) return null;

  const [canonical] = await db
    .select()
    .from(canonicalDeals)
    .where(eq(canonicalDeals.id, shareToken.canonicalDealId));
  if (!canonical) return null;

  const [original] = await db
    .select()
    .from(deals)
    .where(eq(deals.id, canonical.dealId));
  if (!original) return null;

  const [show] = await db
    .select()
    .from(shows)
    .where(eq(shows.id, original.showId));
  if (!show) return null;

  let artist: Artist | null = null;
  if (show.artistId) {
    const [found] = await db
      .select()
      .from(artists)
      .where(eq(artists.id, show.artistId));
    artist = found ?? null;
  }

  const ambiguities = await db
    .select()
    .from(dealAmbiguities)
    .where(eq(dealAmbiguities.canonicalDealId, canonical.id));

  return { shareToken, canonical, ambiguities, original, show, artist };
}
