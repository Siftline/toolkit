import { dispatch, webhook } from "@siftline/actions";
import type { RecordContext } from "@siftline/actions";
import type { Decision, Recipe, SiftlineRecord } from "@siftline/core";
import { z } from "zod";

import { actions } from "./actions";

// This inbox keeps the sender beside the text in each Record's state. The Engine judged both;
// a Body template wants them apart.
const email = z.object({ sender: z.string(), text: z.string() });

export function recordContext(record: SiftlineRecord): RecordContext {
  const { sender, text } = email.parse(record.state);

  return { text, sender };
}

export async function send(decision: Decision, record: RecordContext, recipe: Recipe) {
  // `null` when the Decision went to Review or its Rule selected no Action. Otherwise one attempt
  // through the global `fetch`, no retries: `retryable` on the error says whether a second try is
  // worth it.
  return dispatch(decision, record, actions, recipe);
}

// Preview is `build` without `perform`: the exact request, and nothing sent.
export async function preview(decision: Decision, record: RecordContext, recipe: Recipe) {
  return webhook.build(decision, record, actions.escalations.config, recipe);
}
