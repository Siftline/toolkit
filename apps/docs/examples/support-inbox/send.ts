// siftline label recipe.json records.jsonl --rules rules.json | node send.ts recipe.json records.jsonl
import { readFileSync } from "node:fs";
import { createInterface } from "node:readline";

import { defineActions, dispatch } from "@siftline/actions";
import { parseDecision, parseRecipe, recordSchema } from "@siftline/core";
import { z } from "zod";

const recipe = parseRecipe(readFileSync(process.argv[2] ?? "recipe.json", "utf8"));

// A Decision line carries only its `recordId`; a Body template wants the Record's text.
const email = z.object({ sender: z.string(), text: z.string() });

const records = new Map(
  readFileSync(process.argv[3] ?? "records.jsonl", "utf8")
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => {
      const record = recordSchema.parse(JSON.parse(line));

      return [record.id, email.parse(record.state)] as const;
    }),
);

// The ids rules.json selects. URLs and the secret come from the environment, never from a file;
// an unset one fails here, before anything is sent.
const actions = defineActions({
  escalations: {
    kind: "webhook",
    config: {
      url: process.env.ESCALATIONS_WEBHOOK_URL ?? "",
      body: JSON.stringify({
        content:
          "Escalated by {{rule}}, urgency {{answers.urgency}}. {{record.sender}} wrote:\n{{record.text}}",
        allowed_mentions: { parse: [] },
      }),
    },
  },
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

  const decision = parseDecision(line);
  const record = records.get(decision.recordId);

  if (record === undefined) throw new Error(`no Record ${decision.recordId} in records.jsonl`);

  // `null` when the Decision went to Review or selected no Action: nothing to send.
  const sent = await dispatch(decision, record, actions, recipe);

  if (sent !== null) console.log(`${sent.request.idempotencyKey} ${sent.response.status}`);
}
