import type { ActionId } from "@siftline/actions";
import { routeDecision } from "@siftline/core";
import type { Decision, Rule } from "@siftline/core";

import type { actions } from "./actions";
import type { recipe } from "./recipe";

type Questions = typeof recipe.questions;

// Typed against the Recipe and the Actions: a label the Recipe does not have, or an Action id
// that was never defined, is a compile error.
export const rules: Rule<Questions, ActionId<typeof actions>>[] = [
  {
    id: "escalate",
    condition: { question: "wants_human", comparator: "is", value: true },
    action: "escalations",
  },
  {
    id: "urgent-complaint",
    condition: { question: "urgency", comparator: "atLeast", value: 2 },
    action: "linear-tickets",
  },
  {
    id: "ticket",
    condition: { question: "category", comparator: "isOneOf", value: ["complaint", "question"] },
    action: "linear-tickets",
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
