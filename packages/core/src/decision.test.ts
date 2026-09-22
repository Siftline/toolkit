import { readFileSync } from "node:fs";

import { decisionSchema, parseDecision, serializeDecision } from "@siftline/core";
import type { Decision } from "@siftline/core";
import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

// Imported by package name, not by relative path: this asserts the published `exports` map.

/** The spec's reference line, and the body of the pinned HMAC vector. */
const referenceLine = readFileSync(
  new URL("../fixtures/decisions/support-inbox.jsonl", import.meta.url),
  "utf8",
);

function reference(): Decision {
  return parseDecision(referenceLine);
}

function raw(): { [key: string]: unknown } {
  return JSON.parse(referenceLine);
}

describe("the reference Decision line", () => {
  it("round-trips byte for byte", () => {
    expect(serializeDecision(parseDecision(referenceLine))).toBe(referenceLine);
  });

  it("is 518 bytes with no trailing newline", () => {
    expect(Buffer.byteLength(referenceLine, "utf8")).toBe(518);
    expect(referenceLine.endsWith("}")).toBe(true);
  });

  it("reads back the answers and the fold", () => {
    const decision = reference();
    expect(decision.answers).toEqual({ category: "complaint", wants_human: true });
    expect(decision.confidence).toBe(0.64);
    expect(decision.review).toBe(true);
    expect(decision.rule).toBeNull();
  });
});

describe("serializeDecision", () => {
  it("writes the spec's key order whatever order the object carries", () => {
    const decision = reference();

    const scrambled = {
      usage: decision.usage,
      questions: decision.questions,
      review: decision.review,
      answers: decision.answers,
      action: decision.action,
      rule: decision.rule,
      confidence: decision.confidence,
      trimmed: decision.trimmed,
      judgedAt: decision.judgedAt,
      model: decision.model,
      recipe: decision.recipe,
      recordId: decision.recordId,
      id: decision.id,
      format: decision.format,
    } satisfies Decision;

    expect(serializeDecision(scrambled)).toBe(referenceLine);
  });

  it("follows Recipe order in answers and questions", () => {
    const decision = reference();

    const reordered: Decision = {
      ...decision,
      answers: { wants_human: true, category: "complaint" },
    };

    expect(serializeDecision(reordered)).toContain(
      '"answers":{"wants_human":true,"category":"complaint"}',
    );
    expect(serializeDecision(decision)).toContain(
      '"answers":{"category":"complaint","wants_human":true}',
    );
  });

  it("writes Score Evidence as score, confidence, probabilities", () => {
    const decision: Decision = {
      ...reference(),
      answers: { urgency: 2 },
      questions: {
        urgency: {
          probabilities: { 0: 0.01, 1: 0.45, 2: 0.54, 3: 0 },
          confidence: 0.54,
          score: 1.53,
        },
      },
    };

    expect(serializeDecision(decision)).toContain(
      '"questions":{"urgency":{"score":1.53,"confidence":0.54,"probabilities":{"0":0.01,"1":0.45,"2":0.54,"3":0}}}',
    );
  });

  it("rounds nothing", () => {
    const decision: Decision = {
      ...reference(),
      confidence: 0.6399999999999999,
      questions: { wants_human: { probability: 0.8200000000000001, confidence: 0.64 } },
    };

    expect(serializeDecision(decision)).toContain('"probability":0.8200000000000001');
    expect(serializeDecision(decision)).toContain('"confidence":0.6399999999999999');
  });

  it("writes no trailing newline", () => {
    expect(serializeDecision(reference())).not.toContain("\n");
  });
});

describe("parseDecision", () => {
  it("rejects an unknown top-level key", () => {
    expect(() => decisionSchema.parse({ ...raw(), label: "complaint" })).toThrow(ZodError);
  });

  it("rejects a missing usage", () => {
    const decision = raw();
    delete decision.usage;
    expect(() => decisionSchema.parse(decision)).toThrow(ZodError);
  });

  it.each([2, 0, "1"])("rejects format %p", (format) => {
    expect(() => decisionSchema.parse({ ...raw(), format })).toThrow(ZodError);
  });

  it("rejects an unknown key inside an Evidence block", () => {
    const questions = {
      category: { confidence: 0.91, probabilities: { a: 0.5, b: 0.5 }, legend: ["a", "b"] },
    };

    expect(() => decisionSchema.parse({ ...raw(), questions })).toThrow(ZodError);
  });

  it("rejects a judgedAt that is not ISO 8601", () => {
    expect(() => decisionSchema.parse({ ...raw(), judgedAt: "2026-09-21" })).toThrow(ZodError);
  });

  it("rejects a confidence outside [0, 1]", () => {
    expect(() => decisionSchema.parse({ ...raw(), confidence: 1.2 })).toThrow(ZodError);
  });

  it("rejects a question name that is not snake_case", () => {
    expect(() => decisionSchema.parse({ ...raw(), answers: { Category: "complaint" } })).toThrow(
      ZodError,
    );
  });

  it("accepts Score Evidence", () => {
    const questions = {
      urgency: {
        score: 1.53,
        confidence: 0.54,
        probabilities: { 0: 0.01, 1: 0.45, 2: 0.54, 3: 0 },
      },
    };

    const decision = decisionSchema.parse({ ...raw(), answers: { urgency: 2 }, questions });
    expect(decision.questions.urgency).toEqual(questions.urgency);
  });
});
