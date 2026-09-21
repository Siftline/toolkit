import { readFileSync } from "node:fs";

import {
  evaluateRules,
  parseRecipe,
  routeDecision,
  ruleConditionSchema,
  ruleSchema,
  validateRules,
} from "@siftline/core";
import type { Answers, Decision, Rule } from "@siftline/core";
import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

// Imported by package name, not by relative path: this asserts the published `exports` map.

const recipe = parseRecipe(
  readFileSync(new URL("../fixtures/recipes/feedback-widget.json", import.meta.url), "utf8"),
);

/** The reference Rules from the spec, in spec order. */
const referenceRules: Rule[] = ruleSchema.array().parse([
  {
    id: "r1",
    condition: { question: "urgency", comparator: "atLeast", value: 3 },
    action: "act_pager",
  },
  {
    id: "r2",
    condition: { question: "team", comparator: "isOneOf", value: ["billing", "sales"] },
    action: "act_slack_revenue",
  },
  { id: "r3", condition: { question: "angry", comparator: "is", value: true }, action: null },
]);

const referenceAnswers: Answers = { team: "billing", angry: true, urgency: 1 };

function decisionFor(answers: Answers, review: boolean): Decision {
  return {
    format: 1,
    id: "0192f3c2-7b1e-7c4a-9f0e-3a1b2c3d4e5f",
    recordId: "rec_8f2a",
    recipe: { name: "feedback-widget", version: 3 },
    model: "jev-1.13.0",
    judgedAt: "2026-09-21T14:03:11.204Z",
    trimmed: false,
    answers,
    questions: {},
    confidence: 0.82,
    review,
    rule: null,
    action: null,
    usage: { inputTokens: 412, outputTokens: 9 },
  };
}

describe("ruleConditionSchema", () => {
  it.each([
    { question: "team", comparator: "is", value: "billing" },
    { question: "team", comparator: "isOneOf", value: ["billing", "sales"] },
    { question: "angry", comparator: "is", value: true },
    { question: "urgency", comparator: "is", value: 2 },
    { question: "urgency", comparator: "atLeast", value: 3 },
    { question: "urgency", comparator: "atMost", value: 0 },
  ])("accepts $comparator on $question", (condition) => {
    expect(ruleConditionSchema.parse(condition)).toEqual(condition);
  });

  it.each([
    ["a seventh comparator", { question: "team", comparator: "isNot", value: "billing" }],
    ["a negated compound", { question: "team", comparator: "not", value: { is: "billing" } }],
    ["an extra key", { question: "team", comparator: "is", value: "billing", weight: 2 }],
    ["an empty isOneOf", { question: "team", comparator: "isOneOf", value: [] }],
    ["a non-string label", { question: "team", comparator: "isOneOf", value: [1] }],
    ["a negative index", { question: "urgency", comparator: "atLeast", value: -1 }],
    ["a fractional index", { question: "urgency", comparator: "atMost", value: 1.5 }],
    ["a string index", { question: "urgency", comparator: "atLeast", value: "3" }],
    ["a null value", { question: "team", comparator: "is", value: null }],
    ["an upper-case question", { question: "Team", comparator: "is", value: "billing" }],
  ])("rejects %s", (_name, condition) => {
    expect(() => ruleConditionSchema.parse(condition)).toThrow(ZodError);
  });
});

describe("ruleSchema", () => {
  const condition = { question: "team", comparator: "is", value: "billing" };

  it("accepts a null action", () => {
    expect(ruleSchema.parse({ id: "r1", condition, action: null }).action).toBeNull();
  });

  it.each([
    ["an extra key", { id: "r1", condition, action: null, position: 1 }],
    ["an empty id", { id: "", condition, action: null }],
    ["an empty action", { id: "r1", condition, action: "" }],
    ["a missing action", { id: "r1", condition }],
  ])("rejects %s", (_name, rule) => {
    expect(() => ruleSchema.parse(rule)).toThrow(ZodError);
  });
});

describe("the reference routing vector", () => {
  it("routes the reference answers to r2", () => {
    expect(evaluateRules(referenceAnswers, referenceRules)).toEqual({
      rule: "r2",
      action: "act_slack_revenue",
    });
  });

  it("routes a judged Decision to r2", () => {
    const routed = routeDecision(decisionFor(referenceAnswers, false), referenceRules);
    expect(routed.rule).toBe("r2");
    expect(routed.action).toBe("act_slack_revenue");
  });

  it("keeps rule and action null under review", () => {
    const routed = routeDecision(decisionFor(referenceAnswers, true), referenceRules);
    expect(routed.rule).toBeNull();
    expect(routed.action).toBeNull();
  });

  it("returns a copy and leaves the input untouched", () => {
    const decision = decisionFor(referenceAnswers, false);
    const routed = routeDecision(decision, referenceRules);
    expect(routed).not.toBe(decision);
    expect(decision.rule).toBeNull();
    expect(decision.action).toBeNull();
  });

  it("reports a Rule that maps to nothing", () => {
    expect(evaluateRules({ team: "product", angry: true, urgency: 1 }, referenceRules)).toEqual({
      rule: "r3",
      action: null,
    });
  });

  it("reports no match at all", () => {
    expect(evaluateRules({ team: "product", angry: false, urgency: 1 }, referenceRules)).toEqual({
      rule: null,
      action: null,
    });
  });
});

describe("evaluateRules never throws", () => {
  const fallback: Rule = {
    id: "last",
    condition: { question: "angry", comparator: "is", value: true },
    action: "act_last",
  };

  it("treats a missing Question as false and continues", () => {
    const rules: Rule[] = [
      {
        id: "gone",
        condition: { question: "sentiment", comparator: "is", value: true },
        action: "a",
      },
      fallback,
    ];
    expect(evaluateRules({ angry: true }, rules)).toEqual({ rule: "last", action: "act_last" });
  });

  it("treats a runtime type mismatch as false and continues", () => {
    const rules: Rule[] = [
      {
        id: "mismatch",
        condition: { question: "team", comparator: "atLeast", value: 1 },
        action: "a",
      },
      fallback,
    ];
    expect(evaluateRules({ team: "billing", angry: true }, rules)).toEqual({
      rule: "last",
      action: "act_last",
    });
  });

  it("treats an unknown value as false and continues", () => {
    const rules: Rule[] = [
      {
        id: "stale",
        condition: { question: "team", comparator: "is", value: "support" },
        action: "a",
      },
      {
        id: "stale2",
        condition: { question: "team", comparator: "isOneOf", value: ["support"] },
        action: "a",
      },
      fallback,
    ];
    expect(evaluateRules({ team: "billing", angry: true }, rules)).toEqual({
      rule: "last",
      action: "act_last",
    });
  });
});

describe("validateRules", () => {
  it("is empty when the Rules fit the Recipe", () => {
    expect(validateRules(referenceRules, recipe)).toEqual([]);
  });

  it("reports an unknown question", () => {
    const rules: Rule[] = [
      {
        id: "r1",
        condition: { question: "teem", comparator: "is", value: "billing" },
        action: null,
      },
    ];
    expect(validateRules(rules, recipe)).toEqual([
      { rule: "r1", problem: 'unknown question "teem"' },
    ]);
  });

  it.each([
    ["atLeast", "team", 1, "choice"],
    ["isOneOf", "angry", ["true"], "noul"],
    ["atMost", "angry", 1, "noul"],
    ["isOneOf", "urgency", ["1"], "score"],
  ])("reports %s as invalid for %s", (comparator, question, value, type) => {
    const rules: Rule[] = ruleSchema
      .array()
      .parse([{ id: "r1", condition: { question, comparator, value }, action: null }]);
    expect(validateRules(rules, recipe)).toEqual([
      { rule: "r1", problem: `comparator "${comparator}" is not valid for a ${type} question` },
    ]);
  });

  it("reports an unknown label in is", () => {
    const rules: Rule[] = [
      {
        id: "r1",
        condition: { question: "team", comparator: "is", value: "support" },
        action: null,
      },
    ];
    expect(validateRules(rules, recipe)).toEqual([
      { rule: "r1", problem: 'unknown label "support"' },
    ]);
  });

  it("reports every unknown label in isOneOf", () => {
    const rules: Rule[] = [
      {
        id: "r1",
        condition: {
          question: "team",
          comparator: "isOneOf",
          value: ["billing", "support", "ops"],
        },
        action: null,
      },
    ];
    expect(validateRules(rules, recipe)).toEqual([
      { rule: "r1", problem: 'unknown label "support"' },
      { rule: "r1", problem: 'unknown label "ops"' },
    ]);
  });

  it("reports a non-label value on a Choice", () => {
    const rules: Rule[] = ruleSchema
      .array()
      .parse([
        { id: "r1", condition: { question: "team", comparator: "is", value: true }, action: null },
      ]);
    expect(validateRules(rules, recipe)).toEqual([
      { rule: "r1", problem: "value true is not a label" },
    ]);
  });

  it("reports a non-boolean value on a Noul", () => {
    const rules: Rule[] = ruleSchema
      .array()
      .parse([
        { id: "r1", condition: { question: "angry", comparator: "is", value: 1 }, action: null },
      ]);
    expect(validateRules(rules, recipe)).toEqual([
      { rule: "r1", problem: "value 1 is not a boolean" },
    ]);
  });

  it("reports a level index out of range", () => {
    const rules: Rule[] = [
      {
        id: "r1",
        condition: { question: "urgency", comparator: "atLeast", value: 4 },
        action: null,
      },
    ];
    expect(validateRules(rules, recipe)).toEqual([
      { rule: "r1", problem: "level index 4 is out of range (0-3)" },
    ]);
  });

  it("reports a duplicate id", () => {
    const rules: Rule[] = [
      { id: "r1", condition: { question: "angry", comparator: "is", value: true }, action: null },
      { id: "r1", condition: { question: "angry", comparator: "is", value: false }, action: null },
    ];
    expect(validateRules(rules, recipe)).toEqual([{ rule: "r1", problem: 'duplicate id "r1"' }]);
  });

  it("never runs inside evaluateRules", () => {
    const rules: Rule[] = [
      {
        id: "r1",
        condition: { question: "teem", comparator: "is", value: "billing" },
        action: "a",
      },
    ];
    expect(validateRules(rules, recipe)).toHaveLength(1);
    expect(evaluateRules(referenceAnswers, rules)).toEqual({ rule: null, action: null });
  });
});
