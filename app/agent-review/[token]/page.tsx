import { AlertTriangle } from "lucide-react";
import { getAgentReviewData } from "@/lib/queries-canonical";
import { formatMoney, formatShowDateFull } from "@/lib/format";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import AgentFieldRow from "./_components/agent-field-row";
import AgentAmbiguityCard from "./_components/agent-ambiguity-card";

export default async function AgentReviewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await getAgentReviewData(token);

  if (!data) {
    return (
      <div className="max-w-[960px] mx-auto px-8 py-20 text-center">
        <h1 className="font-display text-[32px] font-medium text-ink-900 mb-4">
          Link expired or invalid
        </h1>
        <p className="text-[14px] text-ink-500 leading-relaxed max-w-md mx-auto">
          This share link is invalid or has expired. If you believe this is an
          error, please contact the venue at{" "}
          <a
            href="mailto:mariana@thecrescent.com"
            className="text-brand-700 underline underline-offset-2"
          >
            mariana@thecrescent.com
          </a>
          .
        </p>
      </div>
    );
  }

  const { shareToken, canonical, ambiguities, original, show, artist } = data;
  const artistName = artist?.name ?? "Artist";

  type AgentFieldResponse = {
    action: "confirm" | "flag";
    comment?: string;
    readingId?: string;
  };
  let agentResponses: Record<string, AgentFieldResponse> = {};
  if (shareToken.agentResponseJson) {
    try {
      agentResponses = JSON.parse(shareToken.agentResponseJson);
    } catch {
      // ignore
    }
  }

  const fields: { key: string; label: string; value: string }[] = [
    { key: "dealType", label: "Deal type", value: canonical.dealType ?? "\u2014" },
    {
      key: "guaranteeAmount",
      label: "Guarantee",
      value: formatMoney(canonical.guaranteeAmount),
    },
    {
      key: "percentage",
      label: "Percentage",
      value:
        canonical.percentage != null
          ? `${(canonical.percentage * 100).toFixed(0)}% of ${canonical.percentageBasis ?? "net"}`
          : "\u2014",
    },
    {
      key: "expenseCap",
      label: "Expense cap",
      value: formatMoney(canonical.expenseCap),
    },
    {
      key: "hospitalityCap",
      label: "Hospitality cap",
      value: formatMoney(canonical.hospitalityCap),
    },
  ];

  // Parse bonuses if present
  let bonuses: { type: string; label: string }[] = [];
  if (canonical.bonusesJson) {
    try {
      bonuses = JSON.parse(canonical.bonusesJson);
    } catch {
      // ignore
    }
  }

  return (
    <div className="max-w-[960px] mx-auto px-8 py-10">
      {/* Header */}
      <div className="mb-10">
        <div className="text-[12px] text-ink-400 mb-3">
          Greenroom &middot; The Crescent
        </div>
        <h1
          className="font-display text-[40px] font-medium text-ink-900 leading-[1.05]"
          style={{ letterSpacing: "-0.02em" }}
        >
          {artistName}
        </h1>
        <div className="text-[14px] text-ink-500 mt-2">
          {formatShowDateFull(show.date)} &middot; Shared by Mariana Reyes for
          your review
        </div>
      </div>

      {/* Banner */}
      {ambiguities.length > 0 && (
        <div className="rounded-lg bg-amber-50/50 ring-1 ring-amber-200/60 p-4 flex items-center gap-2.5 mb-6">
          <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0" />
          <span className="text-[13px] text-amber-900">
            {ambiguities.length} term{ambiguities.length === 1 ? " was" : "s were"} flagged
            for review — see below
          </span>
        </div>
      )}

      {/* Deal terms */}
      <Card className="mb-6">
        <CardHeader>
          <div>
            <CardTitle>Deal terms</CardTitle>
            <CardDescription>
              Canonical terms extracted and confirmed by the venue. Please review
              each field.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {fields.map((f) => (
            <AgentFieldRow
              key={f.key}
              label={f.label}
              value={f.value}
              fieldKey={f.key}
              token={token}
              existingResponse={agentResponses[f.key]}
            />
          ))}
          {bonuses.length > 0 && (
            <div className="mt-3 rounded-md ring-1 ring-ink-200/50 bg-ink-50/30 px-3 py-2.5">
              <div className="eyebrow text-[10px] text-ink-500 mb-1.5">
                Bonuses
              </div>
              <ul className="space-y-1">
                {bonuses.map((b, i) => (
                  <li
                    key={i}
                    className="text-[12px] text-ink-800 leading-relaxed"
                  >
                    {b.label}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ambiguity flags */}
      {ambiguities.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <div>
              <CardTitle>Flagged items</CardTitle>
              <CardDescription>
                These terms were flagged during review. Please confirm the
                correct reading or flag any concerns.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {ambiguities.map((amb) => (
              <AgentAmbiguityCard key={amb.id} ambiguity={amb} token={token} existingResponse={agentResponses[amb.id]} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Original prose — collapsible */}
      <Card>
        <CardContent className="py-4">
          <details>
            <summary className="text-[13px] font-semibold text-ink-900 tracking-tight cursor-pointer select-none">
              Original deal notes from Mariana
            </summary>
            <div
              className="mt-3 text-[13px] text-ink-700 bg-canvas-soft rounded-lg p-4 ring-1 ring-ink-200/50 leading-relaxed font-[450]"
              style={{ fontStyle: "italic" }}
            >
              {original.dealNotesFreetext ?? "No notes."}
            </div>
          </details>
        </CardContent>
      </Card>
    </div>
  );
}
