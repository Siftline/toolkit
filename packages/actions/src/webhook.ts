import { serializeDecision } from "@siftline/core";
import type { Decision, Recipe } from "@siftline/core";
import { z } from "zod";

import { baseHeaders, hmacSha256Hex, idempotencyKeyFor } from "./adapter";
import type { ActionRequest, Adapter } from "./adapter";

export interface WebhookConfig {
  url: string;
  secret?: string;
  headers?: { [name: string]: string };
}

const webhookConfigSchema: z.ZodType<WebhookConfig> = z
  .object({
    url: z.url(),
    secret: z.string().min(1).optional(),
    headers: z.record(z.string().min(1), z.string()).optional(),
  })
  .strict();

async function build(
  decision: Decision,
  config: WebhookConfig,
  _recipe: Recipe,
): Promise<ActionRequest> {
  const idempotencyKey = idempotencyKeyFor(decision);
  const body = serializeDecision(decision);

  const headers = baseHeaders(idempotencyKey);
  for (const [name, value] of Object.entries(config.headers ?? {})) headers[name] = value;

  if (config.secret !== undefined) {
    headers["X-Siftline-Signature"] = `sha256=${await hmacSha256Hex(config.secret, body)}`;
  }

  return { method: "POST", url: config.url, headers, body, idempotencyKey };
}

/** POSTs the Decision line itself, with no envelope, so a receiver runs `parseDecision`. */
export const webhook: Adapter<WebhookConfig> = {
  kind: "webhook",
  configSchema: webhookConfigSchema,
  build,
};
