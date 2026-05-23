"use client";

import { useState } from "react";
import { CheckCircle2, Flag, ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  agentConfirmFieldAction,
  agentFlagFieldAction,
} from "../actions";

type AgentFieldResponse = {
  action: "confirm" | "flag";
  comment?: string;
};

type Props = {
  label: string;
  value: string;
  fieldKey: string;
  token: string;
  existingResponse?: AgentFieldResponse;
};

export default function AgentFieldRow({
  label,
  value,
  fieldKey,
  token,
  existingResponse,
}: Props) {
  const [isPending, setIsPending] = useState(false);
  const [flagOpen, setFlagOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [overriding, setOverriding] = useState(false);

  const showExisting = existingResponse && !overriding;

  async function handleConfirm() {
    setIsPending(true);
    try {
      const result = await agentConfirmFieldAction(token, fieldKey);
      if (result.ok) {
        toast.success(`Confirmed: ${label}`);
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
      const result = await agentFlagFieldAction(token, fieldKey, comment);
      if (result.ok) {
        toast.success(`Flagged: ${label}`);
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
    <div className="rounded-md ring-1 ring-ink-200/50 bg-white overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-3 py-2.5">
        <div className="min-w-0">
          <div className="eyebrow text-[10px] text-ink-500">{label}</div>
          <div className="text-[13px] font-mono tabular text-ink-900 mt-0.5">
            {value}
          </div>
        </div>

        {showExisting ? (
          <div className="flex items-center gap-2 shrink-0">
            {existingResponse.action === "confirm" ? (
              <span className="text-[11px] text-emerald-700 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Confirmed
              </span>
            ) : (
              <span className="text-[11px] text-rose-700 flex items-center gap-1">
                <Flag className="h-3 w-3" />
                Flagged
              </span>
            )}
            <button
              onClick={() => setOverriding(true)}
              className="text-[10px] text-ink-400 hover:text-ink-700 underline underline-offset-2 transition-colors"
            >
              Change
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleConfirm}
              disabled={isPending}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 hover:text-emerald-900 rounded-md ring-1 ring-emerald-200 bg-emerald-50/50 px-2 py-1 transition-colors disabled:opacity-50"
            >
              {isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3 w-3" />
              )}
              Confirm
            </button>
            <button
              onClick={() => setFlagOpen(!flagOpen)}
              disabled={isPending}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-700 hover:text-rose-900 rounded-md ring-1 ring-rose-200 bg-rose-50/50 px-2 py-1 transition-colors disabled:opacity-50"
            >
              <Flag className="h-3 w-3" />
              Flag
              <ChevronDown
                className={`h-3 w-3 transition-transform ${flagOpen ? "rotate-180" : ""}`}
              />
            </button>
          </div>
        )}
      </div>

      {/* Existing flag comment (read-only) */}
      {showExisting && existingResponse.action === "flag" && existingResponse.comment && (
        <div className="px-3 pb-3">
          <div className="border-l-2 border-rose-200 pl-2.5 text-[11px] text-ink-600 leading-relaxed" style={{ fontStyle: "italic" }}>
            {existingResponse.comment}
          </div>
        </div>
      )}

      {/* Flag textarea (editing mode) */}
      {!showExisting && flagOpen && (
        <div className="px-3 pb-3 space-y-2">
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
    </div>
  );
}
