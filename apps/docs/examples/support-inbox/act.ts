import { perform, slackIncomingWebhook, webhook } from "@siftline/actions";
import type { Decision, Recipe } from "@siftline/core";

export async function sendWebhook(decision: Decision, recipe: Recipe) {
  const request = await webhook.build(
    decision,
    { url: "https://example.com/hooks/siftline", secret: "shared-secret" },
    recipe,
  );

  // One attempt through the global `fetch`, no retries. `retryable` on the error says whether a
  // second try is worth it.
  const response = await perform(request);

  return { request, response };
}

export async function buildSlack(decision: Decision, recipe: Recipe) {
  return slackIncomingWebhook.build(
    decision,
    { url: "https://hooks.slack.com/services/T000/B000/XXXX" },
    recipe,
  );
}
