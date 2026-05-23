/**
 * Slice B — LLM extraction wrapper.
 *
 * Calls Anthropic API, parses JSON, validates shape. Returns a typed
 * result ready to be merged with code-detected ambiguities (A2).
 */

import Anthropic from "@anthropic-ai/sdk";
import {
  EXTRACTION_SYSTEM_PROMPT,
  buildExtractionUserMessage,
} from "./prompt";
import type {
  RecoupExpectation,
  AmbiguityType,
  PossibleReading,
} from "@/db/schema-canonical";
import type { Bonus } from "@/db/schema";

// -------- Output types --------

export type ExtractedDealFields = {
  dealType: "flat" | "percentage_of_gross" | "percentage_of_net" | "vs" | "door" | null;
  guaranteeAmount: number | null;
  percentage: number | null;
  percentageBasis: "gross" | "net" | null;
  expenseCap: number | null;
  hospitalityCap: number | null;
  bonuses: Bonus[];
  recoupExpectations: Omit<RecoupExpectation, "id">[];
};

export type FieldConfidence = {
  dealType: number;
  guaranteeAmount: number;
  percentage: number;
  percentageBasis: number;
  expenseCap: number;
  hospitalityCap: number;
  bonuses: number;
  recoupExpectations: number;
};

export type LlmDetectedAmbiguity = {
  // Note: type excludes "structural_prose_drift" — that's code-detected.
  type: Exclude<AmbiguityType, "structural_prose_drift">;
  severity: "high" | "medium" | "low";
  proseSpanText: string;
  summary: string;
  possibleReadings: PossibleReading[];
  suggestedActions: { kind: string; label: string }[];
};

export type ExtractionResult = {
  extracted: ExtractedDealFields;
  fieldConfidence: FieldConfidence;
  ambiguities: LlmDetectedAmbiguity[];
  rawResponse: string;          // for debugging
  modelUsed: string;
  durationMs: number;
};

// -------- Client (lazy init) --------

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY not set");
    }
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _client;
}

// -------- Main extraction call --------

const DEFAULT_MODEL = "claude-sonnet-4-5";

export async function extractDealFromProse(
  prose: string,
  options: { model?: string } = {},
): Promise<ExtractionResult> {
  const model = options.model ?? DEFAULT_MODEL;
  const startedAt = Date.now();

  const response = await getClient().messages.create({
    model,
    max_tokens: 4096,
    system: EXTRACTION_SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildExtractionUserMessage(prose) }],
  });

  // Extract text from response (assumes single text block, which the prompt
  // enforces by saying "no commentary").
  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new ExtractionError("LLM returned no text content", { response });
  }
  const raw = textBlock.text.trim();

  // Some models still wrap JSON in ```json fences despite instructions —
  // strip defensively.
  const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    throw new ExtractionError(
      `JSON parse failed: ${(e as Error).message}`,
      { raw: cleaned },
    );
  }

  const validated = validateExtractionShape(parsed);

  return {
    ...validated,
    rawResponse: raw,
    modelUsed: model,
    durationMs: Date.now() - startedAt,
  };
}

// -------- Validation --------

class ExtractionError extends Error {
  constructor(message: string, public context: Record<string, unknown>) {
    super(message);
    this.name = "ExtractionError";
  }
}

function validateExtractionShape(obj: unknown): {
  extracted: ExtractedDealFields;
  fieldConfidence: FieldConfidence;
  ambiguities: LlmDetectedAmbiguity[];
} {
  if (!obj || typeof obj !== "object") {
    throw new ExtractionError("Top-level not an object", { obj });
  }
  const o = obj as Record<string, unknown>;

  if (!o.extracted || typeof o.extracted !== "object") {
    throw new ExtractionError("Missing 'extracted' field", { obj });
  }
  if (!o.fieldConfidence || typeof o.fieldConfidence !== "object") {
    throw new ExtractionError("Missing 'fieldConfidence' field", { obj });
  }
  if (!Array.isArray(o.ambiguities)) {
    throw new ExtractionError("'ambiguities' must be an array", { obj });
  }

  // Light shape check — trust the LLM JSON schema if these top fields pass.
  // Production version would use zod here.
  return {
    extracted: o.extracted as ExtractedDealFields,
    fieldConfidence: o.fieldConfidence as FieldConfidence,
    ambiguities: o.ambiguities as LlmDetectedAmbiguity[],
  };
}

export { ExtractionError };
