import { z } from "zod";

import { questionName } from "./recipe";
import type { EntryType, Question, Questions } from "./recipe";

/** The Engine's whole view of an item. Sender, source and raw payload stay with the caller. */
export interface Record {
  id: string;
  state: EntryType;
  trimmed?: boolean;
}

// `number extends S["length"]` is what collapses the erased tuple to `number`; without it
// the index union would be `never`.
type IndexOf<S extends readonly unknown[]> = number extends S["length"]
  ? number
  : Extract<keyof S, `${number}`> extends `${infer N extends number}`
    ? N
    : never;

type AnswerFor<Qn> = Qn extends { type: "choice"; criteria: infer C }
  ? keyof C & string
  : Qn extends { type: "noul" }
    ? boolean
    : Qn extends { type: "score"; criteria: infer S extends readonly unknown[] }
      ? IndexOf<S>
      : never;

/** Choice → label, Noul → boolean, Score → level index. Shared with Fixture `expect`. */
export type Answers<Q extends Questions = Questions> = { [K in keyof Q]: AnswerFor<Q[K]> };

type EvidenceFor<Qn> = Qn extends { type: "choice"; criteria: infer C }
  ? { confidence: number; probabilities: { [L in keyof C]: number } }
  : Qn extends { type: "noul" }
    ? { probability: number; confidence: number }
    : Qn extends { type: "score"; criteria: infer S extends readonly unknown[] }
      ? { score: number; confidence: number; probabilities: { [I in IndexOf<S>]: number } }
      : never;

/** The model's evidence for one Question. Bare `Evidence` is the union of the three shapes. */
export type Evidence<Qn extends Question = Question> = EvidenceFor<Qn>;

export interface Decision<Q extends Questions = Questions> {
  format: 1;
  id: string;
  recordId: string;
  recipe: { name: string; version: number };
  model: string;
  judgedAt: string;
  trimmed: boolean;
  answers: Answers<Q>;
  questions: { [K in keyof Q]: Evidence<Q[K]> };
  confidence: number;
  review: boolean;
  rule: string | null;
  action: string | null;
  usage: { inputTokens: number; outputTokens: number };
}

const unit = z.number().min(0).max(1);
const levelIndex = z.string().regex(/^\d+$/);

const choiceEvidence = z
  .object({ confidence: unit, probabilities: z.record(z.string().min(1), unit) })
  .strict();

const noulEvidence = z.object({ probability: unit, confidence: unit }).strict();

// `score` is the SDK's expected value, copied untouched, so it is not bounded by 1.
const scoreEvidence = z
  .object({
    score: z.number(),
    confidence: unit,
    probabilities: z.record(levelIndex, unit),
  })
  .strict();

// Noul first, then Score: a Choice block is the only one with neither `probability` nor
// `score`, so the strict members disambiguate the union.
const evidence = z.union([noulEvidence, scoreEvidence, choiceEvidence]);

export const decisionSchema = z
  .object({
    format: z.literal(1),
    id: z.string().min(1),
    recordId: z.string().min(1),
    recipe: z.object({ name: z.string().min(1), version: z.number().int().min(1) }).strict(),
    model: z.string().min(1),
    judgedAt: z.iso.datetime(),
    trimmed: z.boolean(),
    answers: z.record(questionName, z.union([z.string(), z.boolean(), z.number()])),
    questions: z.record(questionName, evidence),
    confidence: unit,
    review: z.boolean(),
    rule: z.string().min(1).nullable(),
    action: z.string().min(1).nullable(),
    usage: z
      .object({ inputTokens: z.number().int().min(0), outputTokens: z.number().int().min(0) })
      .strict(),
  })
  .strict();

export function parseDecision(line: string): Decision {
  return decisionSchema.parse(JSON.parse(line));
}

function orderEvidence(block: Evidence): Evidence {
  if ("probability" in block) {
    return { probability: block.probability, confidence: block.confidence };
  }
  if ("score" in block) {
    return {
      score: block.score,
      confidence: block.confidence,
      probabilities: block.probabilities,
    };
  }
  return { confidence: block.confidence, probabilities: block.probabilities };
}

/** The only writer. One compact line, no trailing newline, and nothing is rounded. */
export function serializeDecision(decision: Decision): string {
  const questions: { [name: string]: Evidence } = {};
  for (const [name, block] of Object.entries(decision.questions)) {
    questions[name] = orderEvidence(block);
  }

  return JSON.stringify({
    format: decision.format,
    id: decision.id,
    recordId: decision.recordId,
    recipe: { name: decision.recipe.name, version: decision.recipe.version },
    model: decision.model,
    judgedAt: decision.judgedAt,
    trimmed: decision.trimmed,
    answers: decision.answers,
    questions,
    confidence: decision.confidence,
    review: decision.review,
    rule: decision.rule,
    action: decision.action,
    usage: {
      inputTokens: decision.usage.inputTokens,
      outputTokens: decision.usage.outputTokens,
    },
  });
}
