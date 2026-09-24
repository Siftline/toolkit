import type { Decision, Recipe } from "@siftline/core";
import type { ZodType } from "zod";

import { ActionBuildError } from "./errors";
import { VERSION } from "./version";

/** Cloud's `action.kind` strings. */
export type ActionKind = "webhook";

/** Everything needed to send an Action, and nothing that depends on a clock or randomness. */
export interface ActionRequest {
  method: "POST";
  url: string;
  headers: { [name: string]: string };
  body: string;
  idempotencyKey: string;
}

/**
 * The Record a Decision is about, as its supplier knows it. The Engine's Record has no sender or
 * Source; they exist only where the Record came from. Its id is the Decision's `recordId`.
 */
export interface RecordContext {
  text: string;
  sender?: string;
  source?: string;
}

export interface Adapter<C> {
  kind: ActionKind;
  configSchema: ZodType<C>;
  build: (
    decision: Decision,
    record: RecordContext,
    config: C,
    recipe: Recipe,
  ) => Promise<ActionRequest>;
}

/** The key the receiver deduplicates on, and the `Idempotency-Key` header. */
export function idempotencyKeyFor(decision: Decision): string {
  if (decision.action === null) {
    throw new ActionBuildError(`Decision ${decision.id} selected no Action`);
  }

  return `${decision.id}:${decision.action}`;
}

// A type alias, not an interface: only an alias is assignable to `ActionRequest["headers"]`.
type BaseHeaders = {
  "Content-Type": string;
  "Idempotency-Key": string;
  "User-Agent": string;
};

/** The three headers every adapter sends. An adapter adds its own on top. */
export function baseHeaders(idempotencyKey: string): BaseHeaders {
  return {
    "Content-Type": "application/json",
    "Idempotency-Key": idempotencyKey,
    "User-Agent": `siftline-actions/${VERSION}`,
  };
}

const encoder = new TextEncoder();

export async function hmacSha256Hex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(body));

  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}
