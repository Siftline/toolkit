import { dispatch, webhook } from "@siftline/actions";
import type { Decision, Recipe } from "@siftline/core";

import { actions } from "./actions";

export async function send(decision: Decision, recipe: Recipe) {
  // `null` when the Decision went to Review or its Rule selected no Action. Otherwise one attempt
  // through the global `fetch`, no retries: `retryable` on the error says whether a second try is
  // worth it.
  return dispatch(decision, actions, recipe);
}

// Preview is `build` without `perform`: the exact request, and nothing sent.
export async function preview(decision: Decision, recipe: Recipe) {
  return webhook.build(decision, actions.escalations.config, recipe);
}
