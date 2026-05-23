"use client";

import { useState } from "react";
import DealReviewPanel from "./deal-review-panel";
import type {
  CanonicalDealRow,
  DealAmbiguityRow,
  AgentFieldResponse,
} from "@/lib/queries-canonical";

type SpanRange = {
  ambiguityId: string;
  start: number;
  end: number;
};

function buildSpans(ambiguities: DealAmbiguityRow[]): SpanRange[] {
  const raw = ambiguities
    .filter(
      (a): a is DealAmbiguityRow & { proseSpanStart: number; proseSpanEnd: number } =>
        a.proseSpanStart != null && a.proseSpanEnd != null,
    )
    .map((a) => ({
      ambiguityId: a.id,
      start: a.proseSpanStart,
      end: a.proseSpanEnd,
    }))
    .sort((a, b) => a.start - b.start);

  // Remove overlaps: keep earlier, skip later
  const result: SpanRange[] = [];
  let ceiling = 0;
  for (const span of raw) {
    if (span.start < ceiling) {
      console.warn(
        `Overlapping prose span for ambiguity ${span.ambiguityId} (start ${span.start} < ceiling ${ceiling}) — skipping`,
      );
      continue;
    }
    result.push(span);
    ceiling = span.end;
  }
  return result;
}

function HighlightedProse({
  prose,
  ambiguities,
  hoveredId,
  onHoverSpan,
}: {
  prose: string;
  ambiguities: DealAmbiguityRow[];
  hoveredId: string | null;
  onHoverSpan: (id: string | null) => void;
}) {
  const spans = buildSpans(ambiguities);

  if (spans.length === 0) {
    return <>{prose}</>;
  }

  const parts: React.ReactNode[] = [];
  let cursor = 0;

  for (const span of spans) {
    // Plain text before this span
    if (cursor < span.start) {
      parts.push(prose.slice(cursor, span.start));
    }

    const isHovered = hoveredId === span.ambiguityId;
    parts.push(
      <span
        key={span.ambiguityId}
        data-ambiguity-id={span.ambiguityId}
        onMouseEnter={() => onHoverSpan(span.ambiguityId)}
        onMouseLeave={() => onHoverSpan(null)}
        className={`rounded-sm cursor-default transition-colors duration-150 ${
          isHovered
            ? "bg-rose-200 ring-1 ring-rose-400"
            : "bg-rose-50"
        }`}
      >
        {prose.slice(span.start, span.end)}
      </span>,
    );

    cursor = span.end;
  }

  // Trailing text
  if (cursor < prose.length) {
    parts.push(prose.slice(cursor));
  }

  return <>{parts}</>;
}

type Props = {
  dealId: string;
  showId: string;
  prose: string;
  canonical: CanonicalDealRow | null;
  ambiguities: DealAmbiguityRow[];
  agentResponses: Record<string, AgentFieldResponse> | null;
};

export default function DealReviewSection({
  dealId,
  showId,
  prose,
  canonical,
  ambiguities,
  agentResponses,
}: Props) {
  const [hoveredAmbiguityId, setHoveredAmbiguityId] = useState<string | null>(
    null,
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5">
      {/* Left: prose with highlight spans */}
      <div>
        <div className="eyebrow text-[10px] text-ink-500 mb-2">
          Deal notes (free text — what Mariana actually trusts)
        </div>
        <div
          id="deal-notes-prose"
          className="text-[13px] text-ink-800 bg-canvas-soft rounded-lg p-4 ring-1 ring-ink-200/50 leading-relaxed font-[450]"
          style={{ fontStyle: "italic" }}
        >
          <HighlightedProse
            prose={prose}
            ambiguities={ambiguities}
            hoveredId={hoveredAmbiguityId}
            onHoverSpan={setHoveredAmbiguityId}
          />
        </div>
      </div>

      {/* Right: review panel */}
      <DealReviewPanel
        dealId={dealId}
        showId={showId}
        prose={prose}
        canonical={canonical}
        ambiguities={ambiguities}
        hoveredAmbiguityId={hoveredAmbiguityId}
        onHoverAmbiguity={setHoveredAmbiguityId}
        agentResponses={agentResponses}
      />
    </div>
  );
}
