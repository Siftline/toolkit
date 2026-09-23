// siftline label recipe.json records.jsonl --rules rules.json | node send.ts recipe.json
import { readFileSync } from "node:fs";
import { createInterface } from "node:readline";

import { defineActions, dispatch } from "@siftline/actions";
import { parseDecision, parseRecipe } from "@siftline/core";

const recipe = parseRecipe(readFileSync(process.argv[2] ?? "recipe.json", "utf8"));

// The ids rules.json selects. URLs and the secret come from the environment, never from a file;
// an unset one fails here, before anything is sent.
const actions = defineActions({
  escalations: { kind: "webhook", config: { url: process.env.ESCALATIONS_WEBHOOK_URL ?? "" } },
  "linear-tickets": {
    kind: "webhook",
    config: {
      url: process.env.TICKETS_WEBHOOK_URL ?? "",
      secret: process.env.TICKETS_WEBHOOK_SECRET ?? "",
    },
  },
});

for await (const line of createInterface({ input: process.stdin })) {
  if (line.trim() === "") continue;

  // `null` when the Decision went to Review or selected no Action: nothing to send.
  const sent = await dispatch(parseDecision(line), actions, recipe);

  if (sent !== null) console.log(`${sent.request.idempotencyKey} ${sent.response.status}`);
}
