import type { AnswerValue, Decision, Question, Recipe, ScoreCriteria } from "@siftline/core";
import { z } from "zod";

import { baseHeaders, idempotencyKeyFor } from "./adapter";
import type { ActionRequest, Adapter } from "./adapter";

export interface SlackIncomingWebhookConfig {
  url: string;
}

const slackIncomingWebhookConfigSchema: z.ZodType<SlackIncomingWebhookConfig> = z
  .object({ url: z.url() })
  .strict();

// A level description is any `EntryType`; prose is the common case and the only one Slack
// can render as itself.
function describeLevel(index: number, criteria: ScoreCriteria): string {
  const description = criteria[index];

  if (description === undefined) return String(index);

  const text =
    description === null || description instanceof Object
      ? JSON.stringify(description)
      : description;

  return `${index} · ${text}`;
}

function renderAnswer(question: Question, answer: AnswerValue): string {
  if (question.type === "noul") return answer ? "yes" : "no";

  if (question.type === "score") return describeLevel(Number(answer), question.criteria);

  return String(answer);
}

function renderText(decision: Decision, recipe: Recipe): string {
  const lines = [`*${recipe.name}* · ${decision.recordId}`];

  for (const [name, question] of Object.entries(recipe.questions)) {
    const answer = decision.answers[name];
    const evidence = decision.questions[name];

    if (answer === undefined || evidence === undefined) continue;
    const percent = Math.round(evidence.confidence * 100);
    lines.push(`${name}: ${renderAnswer(question, answer)} (${percent}%)`);
  }

  if (decision.rule !== null) lines.push(`rule ${decision.rule}`);

  return lines.join("\n");
}

// `async` so an Action-less Decision rejects rather than throwing synchronously, matching
// the webhook adapter.
async function build(
  decision: Decision,
  config: SlackIncomingWebhookConfig,
  recipe: Recipe,
): Promise<ActionRequest> {
  const idempotencyKey = idempotencyKeyFor(decision);

  return {
    method: "POST",
    url: config.url,
    headers: baseHeaders(idempotencyKey),
    body: JSON.stringify({ text: renderText(decision, recipe) }),
    idempotencyKey,
  };
}

/**
 * Posts one mrkdwn message, no blocks. Slack itself has no idempotency, so a redelivery
 * past cloud's guard posts twice.
 */
export const slackIncomingWebhook: Adapter<SlackIncomingWebhookConfig> = {
  kind: "slack_incoming_webhook",
  configSchema: slackIncomingWebhookConfigSchema,
  build,
};
