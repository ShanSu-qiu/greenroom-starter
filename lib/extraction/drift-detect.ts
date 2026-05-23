/**
 * A2 structural_prose_drift detector.
 *
 * Pure code, no LLM. Compares the LLM's extraction (from prose) against the
 * existing `deals.*` structured fields. Any mismatch (above tolerance) gets
 * flagged.
 *
 * Why not have the LLM do this? Because:
 *   (a) It's deterministic — exact value comparison.
 *   (b) LLMs are prone to false positives ("are these similar enough?").
 *   (c) We want the LLM to focus token budget on semantic judgment.
 *
 * Senior-teammate principle: each tool does what it's good at.
 */

import type { Deal } from "@/db/schema";
import type { ExtractedDealFields } from "./extract";

export type DriftFlag = {
  type: "structural_prose_drift";
  severity: "high" | "medium" | "low";
  field: string;                          // e.g. "percentage", "dealType"
  proseValue: unknown;                    // what the LLM extracted from prose
  structuredValue: unknown;               // what's in deals.* today
  summary: string;
  possibleReadings: {
    label: string;
    reading: string;
    implication: string;
    impliedPayoutDeltaUsd: number | null;
  }[];
};

// Numeric tolerance — 1% relative, $1 absolute floor.
function numericsDiffer(a: number | null, b: number | null): boolean {
  if (a == null && b == null) return false;
  if (a == null || b == null) return true;
  const abs = Math.abs(a - b);
  const rel = abs / Math.max(Math.abs(a), Math.abs(b));
  return abs > 1 && rel > 0.01;
}

export function detectStructuralDrift(
  extracted: ExtractedDealFields,
  existingDeal: Deal,
): DriftFlag[] {
  const flags: DriftFlag[] = [];

  // dealType drift — high severity, this changes the whole calculation
  if (
    extracted.dealType != null &&
    existingDeal.dealType != null &&
    extracted.dealType !== existingDeal.dealType
  ) {
    flags.push({
      type: "structural_prose_drift",
      severity: "high",
      field: "dealType",
      proseValue: extracted.dealType,
      structuredValue: existingDeal.dealType,
      summary: `Deal type in prose ("${extracted.dealType}") differs from structured field ("${existingDeal.dealType}").`,
      possibleReadings: [
        {
          label: "Trust prose (default)",
          reading: `Deal is a ${extracted.dealType} deal as described in prose. Structured field is stale.`,
          implication: "Settlement math should follow prose-described logic.",
          impliedPayoutDeltaUsd: null,
        },
        {
          label: "Trust structured field",
          reading: `Deal is a ${existingDeal.dealType} deal as recorded structurally. Prose may be incorrect or pre-renegotiation.`,
          implication: "Verify with agent before proceeding.",
          impliedPayoutDeltaUsd: null,
        },
      ],
    });
  }

  // guaranteeAmount drift
  if (numericsDiffer(extracted.guaranteeAmount, existingDeal.guaranteeAmount)) {
    flags.push({
      type: "structural_prose_drift",
      severity: "high",
      field: "guaranteeAmount",
      proseValue: extracted.guaranteeAmount,
      structuredValue: existingDeal.guaranteeAmount,
      summary: `Guarantee in prose ($${extracted.guaranteeAmount ?? "—"}) differs from structured field ($${existingDeal.guaranteeAmount ?? "—"}).`,
      possibleReadings: driftReadings(
        "guarantee",
        extracted.guaranteeAmount,
        existingDeal.guaranteeAmount,
      ),
    });
  }

  // percentage drift
  if (numericsDiffer(extracted.percentage, existingDeal.percentage)) {
    flags.push({
      type: "structural_prose_drift",
      severity: "high",
      field: "percentage",
      proseValue: extracted.percentage,
      structuredValue: existingDeal.percentage,
      summary: `Percentage in prose (${pct(extracted.percentage)}) differs from structured field (${pct(existingDeal.percentage)}).`,
      possibleReadings: driftReadings(
        "percentage",
        extracted.percentage,
        existingDeal.percentage,
      ),
    });
  }

  // percentageBasis drift
  if (
    extracted.percentageBasis != null &&
    existingDeal.percentageBasis != null &&
    extracted.percentageBasis !== existingDeal.percentageBasis
  ) {
    flags.push({
      type: "structural_prose_drift",
      severity: "high",
      field: "percentageBasis",
      proseValue: extracted.percentageBasis,
      structuredValue: existingDeal.percentageBasis,
      summary: `Percentage basis in prose (${extracted.percentageBasis}) differs from structured field (${existingDeal.percentageBasis}).`,
      possibleReadings: driftReadings(
        "percentage basis",
        extracted.percentageBasis,
        existingDeal.percentageBasis,
      ),
    });
  }

  // expenseCap and hospitalityCap — medium severity (smaller dollar impact usually)
  if (numericsDiffer(extracted.expenseCap, existingDeal.expenseCap)) {
    flags.push({
      type: "structural_prose_drift",
      severity: "medium",
      field: "expenseCap",
      proseValue: extracted.expenseCap,
      structuredValue: existingDeal.expenseCap,
      summary: `Expense cap in prose ($${extracted.expenseCap ?? "—"}) differs from structured field ($${existingDeal.expenseCap ?? "—"}).`,
      possibleReadings: driftReadings(
        "expense cap",
        extracted.expenseCap,
        existingDeal.expenseCap,
      ),
    });
  }

  if (numericsDiffer(extracted.hospitalityCap, existingDeal.hospitalityCap)) {
    flags.push({
      type: "structural_prose_drift",
      severity: "low",
      field: "hospitalityCap",
      proseValue: extracted.hospitalityCap,
      structuredValue: existingDeal.hospitalityCap,
      summary: `Hospitality cap in prose ($${extracted.hospitalityCap ?? "—"}) differs from structured field ($${existingDeal.hospitalityCap ?? "—"}).`,
      possibleReadings: driftReadings(
        "hospitality cap",
        extracted.hospitalityCap,
        existingDeal.hospitalityCap,
      ),
    });
  }

  // Bonus drift — more nuanced; flag if structured has bonus that prose
  // doesn't, or vice versa. Token-level matching is overkill for MVP; flag
  // presence/absence and let Mariana eyeball.
  const proseBonusCount = extracted.bonuses?.length ?? 0;
  const structuredBonusCount = existingDeal.bonusesJson
    ? safeParseArray(existingDeal.bonusesJson).length
    : 0;
  if (proseBonusCount !== structuredBonusCount) {
    flags.push({
      type: "structural_prose_drift",
      severity: "medium",
      field: "bonuses",
      proseValue: `${proseBonusCount} bonus(es) in prose`,
      structuredValue: `${structuredBonusCount} bonus(es) in structured field`,
      summary: `Bonus count mismatch: prose has ${proseBonusCount}, structured field has ${structuredBonusCount}.`,
      possibleReadings: [
        {
          label: "Trust prose",
          reading: "Prose is the source of truth; structured field is incomplete or stale.",
          implication: "Update structured bonuses from extraction.",
          impliedPayoutDeltaUsd: null,
        },
        {
          label: "Trust structured field",
          reading: "Structured field was correct; prose may have lost or added a bonus during edit.",
          implication: "Verify with agent which bonuses are in force.",
          impliedPayoutDeltaUsd: null,
        },
      ],
    });
  }

  return flags;
}

// -------- Helpers --------

function pct(p: number | null): string {
  return p == null ? "—" : `${(p * 100).toFixed(0)}%`;
}

function safeParseArray(json: string): unknown[] {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function driftReadings(
  fieldName: string,
  proseValue: unknown,
  structuredValue: unknown,
): DriftFlag["possibleReadings"] {
  return [
    {
      label: "Trust prose (default)",
      reading: `Prose says ${fieldName} = ${proseValue}. Greenroom's policy is that prose is the source of truth for deal terms.`,
      implication: "Adopt prose value into canonical deal; structured field will be updated.",
      impliedPayoutDeltaUsd: null,
    },
    {
      label: "Trust structured field",
      reading: `Structured field says ${fieldName} = ${structuredValue}. Prose may be a draft or pre-renegotiation snapshot.`,
      implication: "Keep structured value; verify with agent that prose is the outdated version.",
      impliedPayoutDeltaUsd: null,
    },
  ];
}
