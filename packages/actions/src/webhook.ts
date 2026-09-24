import { serializeDecision } from "@siftline/core";
import type { Decision, Recipe } from "@siftline/core";
import { z } from "zod";

import { baseHeaders, hmacSha256Hex, idempotencyKeyFor } from "./adapter";
import type { ActionRequest, Adapter, RecordContext } from "./adapter";
import { bodyTemplateProblem, renderBody } from "./body";

export interface WebhookConfig {
  url: string;
  secret?: string;
  headers?: { [name: string]: string };
  /** A Body template: JSON sent in place of the Decision line. See ADR 0004. */
  body?: string;
}

const webhookConfigSchema: z.ZodType<WebhookConfig> = z
  .object({
    url: z.url(),
    secret: z.string().min(1).optional(),
    headers: z.record(z.string().min(1), z.string()).optional(),
    body: z
      .string()
      .superRefine((body, context) => {
        const problem = bodyTemplateProblem(body);

        if (problem !== null) context.addIssue({ code: "custom", message: problem });
      })
      .optional(),
  })
  .strict();

async function build(
  decision: Decision,
  record: RecordContext,
  config: WebhookConfig,
  recipe: Recipe,
): Promise<ActionRequest> {
  const idempotencyKey = idempotencyKeyFor(decision);

  const body =
    config.body === undefined
      ? serializeDecision(decision)
      : renderBody(config.body, { decision, record, recipe });

  const headers: ActionRequest["headers"] = baseHeaders(idempotencyKey);

  for (const [name, value] of Object.entries(config.headers ?? {})) headers[name] = value;

  if (config.secret !== undefined) {
    headers["X-Siftline-Signature"] = `sha256=${await hmacSha256Hex(config.secret, body)}`;
  }

  return { method: "POST", url: config.url, headers, body, idempotencyKey };
}

/**
 * POSTs the Decision line itself, with no envelope, so a receiver runs `parseDecision`. With a
 * Body template, POSTs the rendered template instead.
 */
export const webhook: Adapter<WebhookConfig> = {
  kind: "webhook",
  configSchema: webhookConfigSchema,
  build,
};
