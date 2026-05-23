"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { dealShareTokens, dealAmbiguities } from "@/db/schema-canonical";

type AgentFieldResponse = {
  action: "confirm" | "flag";
  comment?: string;
  readingId?: string;
};

type AgentResponseMap = Record<string, AgentFieldResponse>;

type ActionResult = { ok: true } | { ok: false; error: string };

async function getValidShareToken(token: string) {
  const [row] = await db
    .select()
    .from(dealShareTokens)
    .where(eq(dealShareTokens.token, token));
  if (!row) return null;
  if (row.expiresAt && row.expiresAt < new Date()) return null;
  return row;
}

function parseResponseJson(json: string | null): AgentResponseMap {
  if (!json) return {};
  try {
    return JSON.parse(json);
  } catch {
    return {};
  }
}

function deriveStatus(responses: AgentResponseMap): "viewed" | "flagged" {
  const values = Object.values(responses);
  if (values.some((v) => v.action === "flag")) return "flagged";
  return "viewed";
}

export async function agentConfirmFieldAction(
  token: string,
  fieldKey: string,
  readingId?: string,
): Promise<ActionResult> {
  const shareToken = await getValidShareToken(token);
  if (!shareToken) return { ok: false, error: "Share link is invalid or expired" };

  const responses = parseResponseJson(shareToken.agentResponseJson);
  const entry: AgentFieldResponse = { action: "confirm" };
  if (readingId) entry.readingId = readingId;
  responses[fieldKey] = entry;

  await db
    .update(dealShareTokens)
    .set({
      agentResponseJson: JSON.stringify(responses),
      agentResponseAt: new Date(),
      status: deriveStatus(responses),
    })
    .where(eq(dealShareTokens.id, shareToken.id));

  // Post-process: update ambiguity status if fieldKey is an ambiguity row
  if (fieldKey.startsWith("amb_")) {
    const [ambRow] = await db
      .select()
      .from(dealAmbiguities)
      .where(eq(dealAmbiguities.id, fieldKey));
    if (ambRow) {
      const now = new Date();
      if (ambRow.status === "deferred_to_agent") {
        await db
          .update(dealAmbiguities)
          .set({
            status: "resolved_by_confirm_reading",
            resolvedAt: now,
            resolutionNote: "agent confirmed after venue deferred",
          })
          .where(eq(dealAmbiguities.id, fieldKey));
      } else if (ambRow.status === "venue_confirmed") {
        if (ambRow.venueConfirmedReadingId === readingId) {
          await db
            .update(dealAmbiguities)
            .set({
              status: "resolved_by_confirm_reading",
              resolvedAt: now,
              resolutionNote: "dual-confirmed",
            })
            .where(eq(dealAmbiguities.id, fieldKey));
        } else {
          await db
            .update(dealAmbiguities)
            .set({ status: "disputed" })
            .where(eq(dealAmbiguities.id, fieldKey));
        }
      }
      // status "open" → leave as-is (agent confirmed, venue hasn't picked yet)
    }
  }

  revalidatePath(`/agent-review/${token}`);
  return { ok: true };
}

export async function agentFlagFieldAction(
  token: string,
  fieldKey: string,
  comment: string,
): Promise<ActionResult> {
  const shareToken = await getValidShareToken(token);
  if (!shareToken) return { ok: false, error: "Share link is invalid or expired" };

  const responses = parseResponseJson(shareToken.agentResponseJson);
  responses[fieldKey] = { action: "flag", comment };

  await db
    .update(dealShareTokens)
    .set({
      agentResponseJson: JSON.stringify(responses),
      agentResponseAt: new Date(),
      status: "flagged",
    })
    .where(eq(dealShareTokens.id, shareToken.id));

  // Post-process: update ambiguity status if fieldKey is an ambiguity row
  if (fieldKey.startsWith("amb_")) {
    const [ambRow] = await db
      .select()
      .from(dealAmbiguities)
      .where(eq(dealAmbiguities.id, fieldKey));
    if (ambRow) {
      if (
        ambRow.status === "venue_confirmed" ||
        ambRow.status === "deferred_to_agent"
      ) {
        await db
          .update(dealAmbiguities)
          .set({ status: "disputed" })
          .where(eq(dealAmbiguities.id, fieldKey));
      }
      // status "open" → leave as-is
    }
  }

  revalidatePath(`/agent-review/${token}`);
  return { ok: true };
}
