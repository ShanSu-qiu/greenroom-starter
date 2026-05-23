"use client";

import { useState } from "react";
import { CheckCircle2, Flag, ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { DealAmbiguityRow } from "@/lib/queries-canonical";
import {
  agentConfirmFieldAction,
  agentFlagFieldAction,
} from "../actions";

type AgentFieldResponse = {
  action: "confirm" | "flag";
  comment?: string;
  readingId?: string;
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

type PossibleReading = {
  label: string;
  reading: string;
  implication: string;
  impliedPayoutDeltaUsd: number | null;
};

function parseReadings(json: string | null): PossibleReading[] {
  if (!json) return [];
  try {
    return JSON.parse(json);
  } catch {
    return [];
  }
}

export default function AgentAmbiguityCard({
  ambiguity,
  token,
  existingResponse,
}: {
  ambiguity: DealAmbiguityRow;
  token: string;
  existingResponse?: AgentFieldResponse;
}) {
  const [flagOpen, setFlagOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [overriding, setOverriding] = useState(false);

  const showExisting = existingResponse && !overriding;
  const confirmedReadingIndex = showExisting && existingResponse.action === "confirm" && existingResponse.readingId != null
    ? Number(existingResponse.readingId)
    : null;

  const readings = parseReadings(ambiguity.possibleReadingsJson);
  const ringClass = SEVERITY_RING[ambiguity.severity] ?? SEVERITY_RING.low;
  const dotClass = SEVERITY_DOT[ambiguity.severity] ?? SEVERITY_DOT.low;

  async function handleConfirmReading(readingIndex: number) {
    setIsPending(true);
    try {
      const result = await agentConfirmFieldAction(
        token,
        ambiguity.id,
        String(readingIndex),
      );
      if (result.ok) {
        toast.success("Reading confirmed");
        setOverriding(false);
      } else {
        toast.error(result.error);
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setIsPending(false);
    }
  }

  async function handleFlag() {
    if (!comment.trim()) return;
    setIsPending(true);
    try {
      const result = await agentFlagFieldAction(token, ambiguity.id, comment);
      if (result.ok) {
        toast.success("Flagged with comment");
        setComment("");
        setFlagOpen(false);
        setOverriding(false);
      } else {
        toast.error(result.error);
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className={`rounded-lg ring-1 p-3.5 ${ringClass}`}>
      {/* Type + severity */}
      <div className="flex items-center gap-2 mb-1.5">
        <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${dotClass}`} />
        <span className="text-[11px] font-semibold text-ink-800 tracking-tight">
          {AMBIGUITY_LABELS[ambiguity.type] ?? ambiguity.type}
        </span>
        <span className="text-[10px] text-ink-400 uppercase tracking-wider">
          {ambiguity.severity}
        </span>
      </div>

      {/* Summary */}
      <p className="text-[12px] text-ink-700 leading-relaxed mb-2.5">
        {ambiguity.summary}
      </p>

      {/* Possible readings */}
      {readings.length > 0 && (
        <div className="space-y-1.5 mb-3">
          {readings.map((r, i) => {
            const isConfirmed = confirmedReadingIndex === i;
            return (
              <div
                key={i}
                className={`rounded-md px-3 py-2 ${
                  isConfirmed
                    ? "bg-emerald-50 ring-1 ring-emerald-300"
                    : "bg-white/70 ring-1 ring-ink-200/40"
                }`}
              >
                <div className="text-[11px] font-medium text-ink-800 flex items-center gap-1.5">
                  {isConfirmed && <CheckCircle2 className="h-3 w-3 text-emerald-600" />}
                  {r.label}
                </div>
                <p className="text-[11px] text-ink-500 leading-relaxed mt-0.5">
                  {r.reading}
                </p>
                {r.implication && (
                  <p className="text-[10px] text-ink-400 mt-1 leading-snug">
                    {r.implication}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Existing response indicator */}
      {showExisting && (
        <div className="flex items-center justify-between mb-2.5">
          {existingResponse.action === "confirm" && confirmedReadingIndex != null && readings[confirmedReadingIndex] ? (
            <span className="text-[11px] text-emerald-700 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              You confirmed: {readings[confirmedReadingIndex].label}
            </span>
          ) : existingResponse.action === "flag" ? (
            <div>
              <span className="text-[11px] text-rose-700 flex items-center gap-1">
                <Flag className="h-3 w-3" />
                You flagged this item
              </span>
              {existingResponse.comment && (
                <div className="mt-1.5 border-l-2 border-rose-200 pl-2.5 text-[11px] text-ink-600 leading-relaxed" style={{ fontStyle: "italic" }}>
                  {existingResponse.comment}
                </div>
              )}
            </div>
          ) : null}
          <button
            onClick={() => setOverriding(true)}
            className="text-[10px] text-ink-400 hover:text-ink-700 underline underline-offset-2 transition-colors"
          >
            Change
          </button>
        </div>
      )}

      {/* Action buttons (when no existing response or overriding) */}
      {!showExisting && (
        <>
          <div className="flex items-center gap-1.5 flex-wrap">
            {readings.map((r, i) => (
              <button
                key={i}
                onClick={() => handleConfirmReading(i)}
                disabled={isPending}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 hover:text-emerald-900 rounded-md ring-1 ring-emerald-200 bg-emerald-50/50 px-2 py-1 transition-colors disabled:opacity-50"
              >
                {isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3 w-3" />
                )}
                {r.label}
              </button>
            ))}
            <button
              onClick={() => setFlagOpen(!flagOpen)}
              disabled={isPending}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-700 hover:text-rose-900 rounded-md ring-1 ring-rose-200 bg-rose-50/50 px-2 py-1 transition-colors disabled:opacity-50"
            >
              <Flag className="h-3 w-3" />
              Flag with comment
              <ChevronDown
                className={`h-3 w-3 transition-transform ${flagOpen ? "rotate-180" : ""}`}
              />
            </button>
          </div>

          {flagOpen && (
            <div className="mt-3 space-y-2">
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Describe your concern..."
                className="w-full rounded-md ring-1 ring-ink-200/80 bg-white px-3 py-2 text-[12px] text-ink-800 leading-relaxed placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-700 resize-y min-h-[60px]"
              />
              <button
                onClick={handleFlag}
                disabled={isPending || !comment.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg text-[12px] font-medium h-7 px-3 bg-rose-700 text-white hover:bg-rose-800 shadow-sm transition-all duration-150 active:translate-y-px disabled:pointer-events-none disabled:opacity-50"
              >
                Submit flag
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
