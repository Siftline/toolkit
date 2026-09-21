import { readFileSync } from "node:fs";

import { parseDecision, parseRecipe } from "@siftline/core";
import type { Decision, Recipe } from "@siftline/core";

// Core's checked-in vectors, read rather than re-pasted: the reference Decision line is the
// HMAC body byte for byte, and the Recipes are the ones every package's tests share.
function read(name: string): string {
  return readFileSync(new URL(`../../core/fixtures/${name}`, import.meta.url), "utf8");
}

export const referenceLine: string = read("decisions/support-inbox.jsonl");

export function referenceDecision(): Decision {
  return parseDecision(referenceLine);
}

export function feedbackWidget(): Recipe {
  return parseRecipe(read("recipes/feedback-widget.json"));
}

/** A routed Decision over `feedback-widget`: every Question type, a Rule and an Action. */
export function routedDecision(): Decision {
  return {
    format: 1,
    id: "0192f3c2-7b1e-7c4a-9f0e-3a1b2c3d4e5f",
    recordId: "rec_4c11",
    recipe: { name: "feedback-widget", version: 3 },
    model: "jev-1.13.0",
    judgedAt: "2026-09-21T14:03:11.204Z",
    trimmed: false,
    answers: { team: "billing", angry: true, urgency: 2 },
    questions: {
      team: { confidence: 0.88, probabilities: { billing: 0.88, product: 0.09, sales: 0.03 } },
      angry: { probability: 0.86, confidence: 0.72 },
      urgency: {
        score: 1.54,
        confidence: 0.7,
        probabilities: { 0: 0.01, 1: 0.25, 2: 0.7, 3: 0.04 },
      },
    },
    confidence: 0.7,
    review: false,
    rule: "r2",
    action: "act_slack_revenue",
    usage: { inputTokens: 300, outputTokens: 11 },
  };
}
