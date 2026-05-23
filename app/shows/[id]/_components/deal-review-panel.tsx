"use client";

import { useState, useTransition } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Sparkles,
  Loader2,
  RefreshCw,
  Eye,
  Save,
  CircleCheck,
  Share2,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import {
  extractDealAction,
  saveCanonicalDealAction,
  reopenCanonicalDealAction,
  createShareTokenAction,
  venueConfirmReadingAction,
} from "../actions";
import { formatMoney } from "@/lib/format";
import { UNRESOLVED_AMBIGUITY_STATUSES } from "@/lib/ambiguity-status";
import type {
  CanonicalDealRow,
  DealAmbiguityRow,
  AgentFieldResponse,
} from "@/lib/queries-canonical";

type Props = {
  dealId: string;
  showId: string;
  prose: string;
  canonical: CanonicalDealRow | null;
  ambiguities: DealAmbiguityRow[];
  hoveredAmbiguityId?: string | null;
  onHoverAmbiguity?: (id: string | null) => void;
  agentResponses?: Record<string, AgentFieldResponse> | null;
};

const AMBIGUITY_LABELS: Record<string, string> = {
  scope_ambiguity: "Scope ambiguity",
  structural_prose_drift: "Prose \u2194 structured mismatch",
  missing_specification: "Missing specification",
  temporal_amendment: "Post-deal amendment",
  undefined_terminology: "Undefined terminology",
  calculation_order: "Calculation order unclear",
};

const SEVERITY_RING: Record<string, string> = {
  high: "ring-rose-300 bg-rose-50/40",
  medium: "ring-amber-300 bg-amber-50/40",
  low: "ring-ink-200 bg-ink-50/30",
};

const SEVERITY_DOT: Record<string, string> = {
  high: "bg-rose-500",
  medium: "bg-amber-500",
  low: "bg-ink-400",
};

type FieldConfidence = Record<string, number>;

type PossibleReading = {
  label: string;
  reading: string;
  implication: string;
  impliedPayoutDeltaUsd: number | null;
};

function parseConfidence(json: string | null): FieldConfidence {
  if (!json) return {};
  try {
    return JSON.parse(json);
  } catch {
    return {};
  }
}

function parseReadings(json: string | null): PossibleReading[] {
  if (!json) return [];
  try {
    return JSON.parse(json);
  } catch {
    return [];
  }
}

function confidenceTier(value: number | undefined): "high" | "medium" | "low" {
  if (value == null) return "low";
  if (value >= 0.85) return "high";
  if (value >= 0.6) return "medium";
  return "low";
}

const TIER_STYLES = {
  high: {
    bg: "bg-emerald-50/50",
    ring: "ring-emerald-200/60",
    text: "text-emerald-800",
    icon: CheckCircle2,
  },
  medium: {
    bg: "bg-amber-50/50",
    ring: "ring-amber-200/60",
    text: "text-amber-800",
    icon: AlertTriangle,
  },
  low: {
    bg: "bg-rose-50/50",
    ring: "ring-rose-200/60",
    text: "text-rose-800",
    icon: HelpCircle,
  },
} as const;

type FieldDef = {
  key: string;
  label: string;
  format: (canonical: CanonicalDealRow) => string;
};

const FIELD_DEFS: FieldDef[] = [
  {
    key: "dealType",
    label: "Deal type",
    format: (c) => c.dealType ?? "\u2014",
  },
  {
    key: "guaranteeAmount",
    label: "Guarantee",
    format: (c) => formatMoney(c.guaranteeAmount),
  },
  {
    key: "percentage",
    label: "Percentage",
    format: (c) =>
      c.percentage != null
        ? `${(c.percentage * 100).toFixed(0)}% of ${c.percentageBasis ?? "net"}`
        : "\u2014",
  },
  {
    key: "expenseCap",
    label: "Expense cap",
    format: (c) => formatMoney(c.expenseCap),
  },
  {
    key: "hospitalityCap",
    label: "Hospitality cap",
    format: (c) => formatMoney(c.hospitalityCap),
  },
];

export default function DealReviewPanel({
  dealId,
  showId,
  prose,
  canonical,
  ambiguities,
  hoveredAmbiguityId,
  onHoverAmbiguity,
  agentResponses,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [isSaving, startSaveTransition] = useTransition();
  const [expandedReadings, setExpandedReadings] = useState<Set<string>>(new Set());

  function toggleReading(key: string) {
    setExpandedReadings((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleExtract() {
    startTransition(async () => {
      await extractDealAction(dealId, showId);
    });
  }

  function handleSave() {
    if (!canonical) return;
    const unresolvedCount = ambiguities.filter(
      (a) => (UNRESOLVED_AMBIGUITY_STATUSES as readonly string[]).includes(a.status),
    ).length;

    if (unresolvedCount > 0) {
      toast(
        `${unresolvedCount} ambiguit${unresolvedCount === 1 ? "y" : "ies"} unresolved \u2014 save anyway?`,
        {
          duration: 10000,
          action: {
            label: "Save anyway",
            onClick: () => doSave(),
          },
          cancel: {
            label: "Review",
            onClick: () => {},
          },
        },
      );
    } else {
      doSave();
    }
  }

  function doSave() {
    if (!canonical) return;
    startSaveTransition(async () => {
      await saveCanonicalDealAction(canonical.id, showId);
      toast.success("Deal saved");
    });
  }

  function handleReopen() {
    if (!canonical) return;
    startSaveTransition(async () => {
      await reopenCanonicalDealAction(canonical.id, showId);
    });
  }

  async function handleShare() {
    if (!canonical) return;
    try {
      const { url } = await createShareTokenAction(canonical.id);
      const fullUrl = `${window.location.origin}${url}`;
      await navigator.clipboard.writeText(fullUrl);
      toast.success("Share link copied — paste to agent");
    } catch (e) {
      toast.error(`Failed to create share link: ${(e as Error).message}`);
    }
  }

  // Empty state — no canonical yet
  if (!canonical) {
    return (
      <div className="rounded-lg border border-ink-200/80 bg-white shadow-[0_1px_2px_rgba(26,24,20,0.03)] overflow-hidden">
        <div className="px-5 py-4 border-b border-ink-100/80">
          <h3 className="text-[13px] font-semibold text-ink-900 tracking-tight">
            Deal review
          </h3>
          <p className="text-[12px] text-ink-500 mt-0.5 leading-relaxed">
            Extract structured terms from prose with AI.
          </p>
        </div>
        <div className="px-5 py-6 flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-brand-50 ring-1 ring-brand-200/50 flex items-center justify-center">
            <Sparkles className="h-4.5 w-4.5 text-brand-700" />
          </div>
          <p className="text-[12px] text-ink-500 text-center leading-relaxed max-w-[220px]">
            Run LLM extraction to surface ambiguities and build a canonical deal
            record.
          </p>
          <button
            onClick={handleExtract}
            disabled={isPending || !prose}
            className="mt-1 inline-flex items-center gap-1.5 rounded-lg text-[13px] font-medium h-9 px-4 bg-brand-700 text-white hover:bg-brand-800 shadow-sm shadow-brand-700/15 ring-1 ring-inset ring-brand-800/20 transition-all duration-150 active:translate-y-px disabled:pointer-events-none disabled:opacity-50"
          >
            {isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Extracting\u2026
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" />
                Run extraction
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // Loaded state — canonical exists
  const confidence = parseConfidence(canonical.fieldConfidenceJson);

  return (
    <div className="rounded-lg border border-ink-200/80 bg-white shadow-[0_1px_2px_rgba(26,24,20,0.03)] overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-ink-100/80 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <CircleCheck className="h-3.5 w-3.5 text-ink-400 shrink-0" />
          <div>
            <h3 className="text-[13px] font-semibold text-ink-900 tracking-tight">
              Canonical (Mariana confirmed)
            </h3>
            <p className="text-[12px] text-ink-500 mt-0.5 leading-relaxed">
              LLM-extracted canonical fields &middot; {ambiguities.length} flag
              {ambiguities.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>
        <button
          onClick={handleExtract}
          disabled={isPending}
          className="text-[11px] text-ink-500 hover:text-ink-900 inline-flex items-center gap-1 transition-colors disabled:opacity-50"
        >
          {isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
          Re-run
        </button>
      </div>

      {/* Confidence-tiered field rows */}
      <div className="px-5 py-4 space-y-2">
        {FIELD_DEFS.map((f) => {
          const tier = confidenceTier(confidence[f.key]);
          const style = TIER_STYLES[tier];
          const Icon = style.icon;

          const fieldAgentResponse = agentResponses?.[f.key];

          return (
            <div
              key={f.key}
              className={`rounded-md px-3 py-2 ring-1 ${style.bg} ${style.ring}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Icon className={`h-3.5 w-3.5 shrink-0 ${style.text}`} />
                  <span className="eyebrow text-[10px] text-ink-500 shrink-0">
                    {f.label}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-mono tabular text-ink-900 text-right">
                    {f.format(canonical)}
                  </span>
                  {tier === "low" && (
                    <button className="text-[10px] text-rose-700 hover:text-rose-900 font-medium ring-1 ring-rose-200 rounded px-1.5 py-0.5 transition-colors">
                      Confirm
                    </button>
                  )}
                </div>
              </div>
              {fieldAgentResponse && (
                <div className="mt-1.5">
                  {fieldAgentResponse.action === "confirm" ? (
                    <span className="text-[10px] text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 className="h-2.5 w-2.5" />
                      Agent confirmed
                    </span>
                  ) : (
                    <div>
                      <span className="text-[10px] text-rose-700 flex items-center gap-1">
                        <AlertTriangle className="h-2.5 w-2.5" />
                        Agent flagged
                      </span>
                      {fieldAgentResponse.comment && (
                        <p className="text-[10px] text-ink-500 mt-0.5 leading-snug" style={{ fontStyle: "italic" }}>
                          {fieldAgentResponse.comment}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Ambiguity cards */}
      {ambiguities.length > 0 && (
        <div className="px-5 pb-5 space-y-2.5">
          <div className="eyebrow text-[10px] text-ink-400 mb-1">
            Ambiguity flags
          </div>
          {ambiguities.map((amb) => {
            const readings = parseReadings(amb.possibleReadingsJson);
            const ringClass =
              SEVERITY_RING[amb.severity] ?? SEVERITY_RING.low;
            const dotClass =
              SEVERITY_DOT[amb.severity] ?? SEVERITY_DOT.low;
            const isHovered = hoveredAmbiguityId === amb.id;
            const ambAgentResponse = agentResponses?.[amb.id];

            return (
              <div
                key={amb.id}
                className={`rounded-lg ring-1 p-3.5 transition-all duration-150 ${isHovered ? "ring-2 ring-rose-400 bg-rose-50/60 shadow-sm" : ringClass}`}
                onMouseEnter={() => onHoverAmbiguity?.(amb.id)}
                onMouseLeave={() => onHoverAmbiguity?.(null)}
              >
                {/* Type + severity + status badge */}
                <div className="flex items-center gap-2 mb-1.5">
                  <span
                    className={`h-1.5 w-1.5 rounded-full shrink-0 ${dotClass}`}
                  />
                  <span className="text-[11px] font-semibold text-ink-800 tracking-tight">
                    {AMBIGUITY_LABELS[amb.type] ?? amb.type}
                  </span>
                  <span className="text-[10px] text-ink-400 uppercase tracking-wider">
                    {amb.severity}
                  </span>
                  {amb.status === "resolved_by_confirm_reading" && (
                    <span className="text-[9px] font-medium text-emerald-700 bg-emerald-50 ring-1 ring-emerald-200/60 rounded px-1.5 py-px">Dual-confirmed</span>
                  )}
                  {amb.status === "resolved_by_edit" && (
                    <span className="text-[9px] font-medium text-emerald-700 bg-emerald-50 ring-1 ring-emerald-200/60 rounded px-1.5 py-px">Resolved via edit</span>
                  )}
                  {amb.status === "venue_confirmed" && (
                    <span className="text-[9px] font-medium text-amber-700 bg-amber-50 ring-1 ring-amber-200/60 rounded px-1.5 py-px">Awaiting agent</span>
                  )}
                  {amb.status === "disputed" && (
                    <span className="text-[9px] font-medium text-rose-700 bg-rose-50 ring-1 ring-rose-200/60 rounded px-1.5 py-px">Disputed</span>
                  )}
                </div>

                {/* Summary */}
                <p className="text-[12px] text-ink-700 leading-relaxed mb-2.5">
                  {amb.summary}
                </p>

                {/* Possible readings — collapsed by default, expand on click */}
                {readings.length > 0 && (
                  <div className="space-y-1.5 mb-3">
                    {readings.map((r, i) => {
                      const isVenueConfirmed = amb.venueConfirmedReadingId === String(i);
                      const isAgentConfirmed = ambAgentResponse?.action === "confirm" && ambAgentResponse.readingId === String(i);
                      const isResolved = ["resolved_by_confirm_reading", "resolved_by_edit", "dismissed"].includes(amb.status);
                      const readingKey = `${amb.id}_${i}`;
                      const defaultOpen = isVenueConfirmed || isAgentConfirmed || amb.status === "disputed";
                      const isOpen = expandedReadings.has(readingKey) || (defaultOpen && !expandedReadings.has(`${readingKey}_closed`));

                      function toggle() {
                        if (defaultOpen) {
                          // For default-open readings, track explicit close
                          setExpandedReadings((prev) => {
                            const next = new Set(prev);
                            const closedKey = `${readingKey}_closed`;
                            if (next.has(closedKey)) next.delete(closedKey);
                            else next.add(closedKey);
                            return next;
                          });
                        } else {
                          toggleReading(readingKey);
                        }
                      }

                      return (
                        <div
                          key={i}
                          className={`rounded-md ${isVenueConfirmed ? "bg-emerald-50 ring-1 ring-emerald-300" : "bg-white/70 ring-1 ring-ink-200/40"}`}
                        >
                          {/* Title row — always visible, clickable */}
                          <button
                            type="button"
                            onClick={toggle}
                            className="w-full px-3 py-2 flex items-center justify-between gap-1.5 text-left"
                          >
                            <span className="text-[11px] font-medium text-ink-800 flex items-center gap-1.5">
                              {isVenueConfirmed && <CheckCircle2 className="h-3 w-3 text-emerald-600 shrink-0" />}
                              {isAgentConfirmed && !isVenueConfirmed && <CheckCircle2 className="h-3 w-3 text-brand-600 shrink-0" />}
                              {r.label}
                            </span>
                            <ChevronRight className={`h-3 w-3 text-ink-400 shrink-0 transition-transform ${isOpen ? "rotate-90" : ""}`} />
                          </button>

                          {/* Expanded content */}
                          {isOpen && (
                            <div className="px-3 pb-2">
                              <p className="text-[11px] text-ink-500 leading-relaxed">
                                {r.reading}
                              </p>
                              {r.implication && (
                                <p className="text-[10px] text-ink-400 mt-1 leading-snug">
                                  {r.implication}
                                </p>
                              )}
                              {!isVenueConfirmed && !isResolved && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    startTransition(async () => {
                                      const result = await venueConfirmReadingAction(amb.id, showId, String(i));
                                      if (result?.ok) {
                                        toast.success("Reading confirmed");
                                      } else {
                                        toast.error(result?.error ?? "Failed to confirm reading");
                                      }
                                    });
                                  }}
                                  disabled={isPending}
                                  className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 hover:text-emerald-900 rounded ring-1 ring-emerald-200 bg-emerald-50/50 px-1.5 py-0.5 transition-colors disabled:opacity-50"
                                >
                                  <CheckCircle2 className="h-2.5 w-2.5" />
                                  Confirm this reading
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Agent feedback */}
                {ambAgentResponse && (
                  <div className="mb-2.5">
                    {ambAgentResponse.action === "confirm" ? (
                      <span className="text-[10px] text-emerald-700 flex items-center gap-1">
                        <CheckCircle2 className="h-2.5 w-2.5" />
                        Agent confirmed{ambAgentResponse.readingId != null && readings[Number(ambAgentResponse.readingId)]
                          ? `: ${readings[Number(ambAgentResponse.readingId)].label}`
                          : ""}
                      </span>
                    ) : (
                      <div>
                        <span className="text-[10px] text-rose-700 flex items-center gap-1">
                          <AlertTriangle className="h-2.5 w-2.5" />
                          Agent flagged
                        </span>
                        {ambAgentResponse.comment && (
                          <p className="text-[10px] text-ink-500 mt-0.5 leading-snug" style={{ fontStyle: "italic" }}>
                            {ambAgentResponse.comment}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Disputed detail */}
                {amb.status === "disputed" && ambAgentResponse && (
                  <div className="mb-2.5 bg-rose-50/40 rounded-md ring-1 ring-rose-200/60 px-2.5 py-1.5">
                    <div className="text-[10px] text-rose-700">
                      {ambAgentResponse.action === "flag"
                        ? ambAgentResponse.comment
                          ? `Agent flagged: "${ambAgentResponse.comment}"`
                          : "Agent flagged this item"
                        : ambAgentResponse.action === "confirm" &&
                            ambAgentResponse.readingId !== amb.venueConfirmedReadingId
                          ? "Agent confirmed a different reading"
                          : "Dispute raised"}
                    </div>
                    <p className="text-[9px] text-rose-600/70 mt-1 leading-snug">
                      To resolve: confirm the same reading as the agent, or edit the prose.
                    </p>
                  </div>
                )}

                {/* Action: View original prose */}
                {!["resolved_by_confirm_reading", "resolved_by_edit", "dismissed"].includes(amb.status) && (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        const el = document.getElementById("deal-notes-prose");
                        if (el) {
                          el.scrollIntoView({ behavior: "smooth", block: "center" });
                        }
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-ink-600 hover:text-ink-900 rounded-md ring-1 ring-ink-200/80 bg-white px-2 py-1 transition-colors"
                    >
                      <Eye className="h-3 w-3" />
                      View original prose
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Save section */}
      <div className="px-5 py-4 border-t border-ink-100/80">
        {canonical.status === "reviewed_by_venue" ? (
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-emerald-700 flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Saved
            </span>
            <button
              onClick={handleReopen}
              disabled={isSaving}
              className="text-[11px] text-ink-500 hover:text-ink-900 transition-colors disabled:opacity-50"
            >
              Re-open
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg text-[13px] font-medium h-9 px-4 bg-brand-700 text-white hover:bg-brand-800 shadow-sm shadow-brand-700/15 ring-1 ring-inset ring-brand-800/20 transition-all duration-150 active:translate-y-px disabled:pointer-events-none disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Saving&hellip;
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5" />
                  Save deal
                </>
              )}
            </button>
            <button
              onClick={handleShare}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg text-[13px] font-medium h-9 px-4 bg-white text-ink-800 hover:bg-ink-50 ring-1 ring-inset ring-ink-200/80 shadow-sm transition-all duration-150 active:translate-y-px"
            >
              <Share2 className="h-3.5 w-3.5" />
              Send to agent
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
