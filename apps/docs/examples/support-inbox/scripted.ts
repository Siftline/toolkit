import { createJudge } from "@siftline/core";
import { createScriptedClient } from "@siftline/core/testing";

import { recipe } from "./recipe";

// A test double: one recorded answer per call, in call order, never the network.
export const client = createScriptedClient([
  {
    response: {
      model: "jev-1.13.0",
      answers: {
        category: {
          type: "choice",
          choice: "complaint",
          confidence: 0.97,
          probabilities: { complaint: 0.97, question: 0.02, other: 0.01 },
        },
        wants_human: { type: "noul", noul: 0.99 },
        urgency: {
          type: "score",
          score: 1.9,
          confidence: 0.9,
          probabilities: { 0: 0.01, 1: 0.09, 2: 0.9 },
        },
      },
      usage: { input_tokens: 412, output_tokens: 60 },
    },
  },
]);

export async function judgeScripted() {
  // `now` and `id` pin the Decision's clock and id, so the output is byte-stable.
  const judge = createJudge({
    client,
    retry: "prompt",
    now: () => new Date("2026-09-22T09:00:00Z"),
  });

  return judge({ id: "msg-1", state: "Refund me now and get me a human." }, recipe, {
    id: "0192f3c2-7b1e-7c4a-9f0e-000000000001",
  });
}
