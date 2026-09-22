import { readFileSync } from "node:fs";
import { createInterface } from "node:readline";

import { defineActions, dispatch } from "@siftline/actions";
import type { PerformOptions } from "@siftline/actions";
import { parseDecision, parseRecipe } from "@siftline/core";
import type { Recipe } from "@siftline/core";

// The ids rules.json selects. URLs and the secret come from the environment, never from a file;
// an unset one fails here, before anything is sent.
function actionsFromEnv() {
  return defineActions({
    escalations: {
      kind: "slack_incoming_webhook",
      config: { url: process.env.SLACK_WEBHOOK_URL ?? "" },
    },
    "linear-tickets": {
      kind: "webhook",
      config: {
        url: process.env.TICKETS_WEBHOOK_URL ?? "",
        secret: process.env.TICKETS_WEBHOOK_SECRET ?? "",
      },
    },
  });
}

export async function* sendLines(
  lines: AsyncIterable<string>,
  recipe: Recipe,
  options: PerformOptions = {},
) {
  const actions = actionsFromEnv();

  for await (const line of lines) {
    if (line.trim() === "") continue;

    // `null` when the Decision went to Review or selected no Action: nothing to send.
    const sent = await dispatch(parseDecision(line), actions, recipe, options);

    if (sent !== null) yield sent;
  }
}

// siftline label recipe.json records.jsonl --rules rules.json | node send.ts recipe.json
if (import.meta.main) {
  const recipe = parseRecipe(readFileSync(process.argv[2] ?? "recipe.json", "utf8"));

  for await (const sent of sendLines(createInterface({ input: process.stdin }), recipe)) {
    console.log(`${sent.request.idempotencyKey} ${sent.response.status}`);
  }
}
