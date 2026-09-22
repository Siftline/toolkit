import { routeDecision } from "@siftline/core";
import type { Decision, Rule } from "@siftline/core";

import type { recipe } from "./recipe";

type Questions = typeof recipe.questions;

// Typed against the Recipe: a label the Recipe does not have is a compile error.
export const rules: Rule<Questions>[] = [
  {
    id: "escalate",
    condition: { question: "wants_human", comparator: "is", value: true },
    action: "slack_incoming_webhook",
  },
  {
    id: "urgent-complaint",
    condition: { question: "urgency", comparator: "atLeast", value: 2 },
    action: "webhook",
  },
  {
    id: "ticket",
    condition: { question: "category", comparator: "isOneOf", value: ["complaint", "question"] },
    action: "webhook",
  },
  {
    id: "ignore",
    condition: { question: "category", comparator: "is", value: "other" },
    action: null,
  },
];

export function route(decision: Decision<Questions>): Decision<Questions> {
  return routeDecision(decision, rules);
}
