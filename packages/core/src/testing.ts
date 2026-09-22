import { z } from "zod";

import type {
  SystemOneCallOptions,
  SystemOneClient,
  SystemOneRequest,
  SystemOneResult,
} from "./client";
import { parseJsonLines } from "./jsonl";
import { isObjectLike } from "./object";
import { entryType, jsonValue, questionSchema } from "./recipe";

const probability = z.number().min(0).max(1);
const probabilities = z.record(z.string().min(1), z.number());

const answerSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("choice"),
      choice: z.string().min(1),
      confidence: probability,
      probabilities,
    })
    .strict(),
  z.object({ type: z.literal("noul"), noul: probability }).strict(),
  z
    .object({
      type: z.literal("score"),
      score: z.number(),
      confidence: probability,
      legend: z.record(z.string().min(1), jsonValue).optional(),
      probabilities,
    })
    .strict(),
]);

const systemOneRequestSchema = z
  .object({
    state: entryType,
    questions: z.record(z.string().min(1), questionSchema),
    model: z.string().min(1),
  })
  .strict();

const systemOneResultSchema = z
  .object({
    model: z.string().min(1),
    answers: z.record(z.string().min(1), answerSchema),
    usage: z
      .object({
        input_tokens: z.number().int().nonnegative(),
        output_tokens: z.number().int().nonnegative(),
      })
      .strict(),
  })
  .strict();

// Wider than the spec's `{ name, status, retryAfterMs, body }`, because the recorded probes
// carry `message` and `requestId` too and the corpus has to parse as recorded. `status` is
// nullable so a connection or timeout failure — which the SDK throws without one — records.
const replayErrorSchema = z
  .object({
    name: z.string().min(1),
    message: z.string(),
    status: z.number().int().nullable(),
    retryAfterMs: z.number().int().nonnegative().nullable(),
    requestId: z.string().min(1).optional(),
    body: z.unknown(),
  })
  .strict();

// `requestId` is optional: it comes off the HTTP response, which a `SystemOneClient` does
// not expose. The corpus carries one on every line; a recording client cannot write one.
const replayLineFields = {
  format: z.literal(1),
  id: z.string().min(1),
  recordedAt: z.iso.datetime(),
  requestId: z.string().min(1).optional(),
  durationMs: z.number().int().nonnegative(),
  request: systemOneRequestSchema,
};

export const replayLineSchema = z.union([
  z.object({ ...replayLineFields, response: systemOneResultSchema }).strict(),
  z.object({ ...replayLineFields, error: replayErrorSchema }).strict(),
]);

export interface ReplayError {
  name: string;
  message: string;
  status: number | null;
  retryAfterMs: number | null;
  requestId?: string;
  body?: unknown;
}

interface ReplayLineHead {
  format: 1;
  id: string;
  recordedAt: string;
  requestId?: string;
  durationMs: number;
  request: SystemOneRequest;
}

// Declared over core's own types rather than inferred: the schema parses a Recipe-shaped
// subset of `EntryType`, and a recording client has to be able to hand back the whole of it.
export type ReplayLine =
  | (ReplayLineHead & { response: SystemOneResult })
  | (ReplayLineHead & { error: ReplayError });

/** Parses JSONL, skipping blank lines. A bad line throws naming its 1-based number. */
export function parseReplayLines(text: string): ReplayLine[] {
  return parseJsonLines(
    text,
    (line) => replayLineSchema.parse(JSON.parse(line)),
    (line, cause) =>
      cause instanceof SyntaxError
        ? new Error(`replay line ${line} is not JSON`, { cause })
        : new Error(`replay line ${line} is invalid: ${messageOf(cause)}`, { cause }),
  );
}

function messageOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

export type ScriptStep = { response: SystemOneResult } | { error: unknown };

export interface ScriptedClient extends SystemOneClient {
  /** The requests received so far, in call order. */
  readonly calls: readonly SystemOneRequest[];
}

/**
 * Answers in call order. The gate is FIFO, so a script and a judged batch line up.
 * Failures reject rather than throw synchronously, as a real client does.
 */
export function createScriptedClient(script: readonly ScriptStep[]): ScriptedClient {
  const calls: SystemOneRequest[] = [];
  return {
    calls,
    systemOne: async (request: SystemOneRequest): Promise<SystemOneResult> => {
      const step = script[calls.length];
      calls.push(request);
      if (!step) throw new Error(`scripted client exhausted after ${script.length} calls`);
      if ("error" in step) throw step.error;
      return step.response;
    },
  };
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!isObjectLike(a) || !isObjectLike(b)) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((key) => key in b && deepEqual(a[key], b[key]));
}

/** Rebuilds what the SDK threw closely enough for the Judge's duck typing to see it. */
function replayError(recorded: ReplayError): Error {
  const error = new Error(recorded.message);
  error.name = recorded.name;
  return Object.assign(error, {
    status: recorded.status,
    retryAfterMs: recorded.retryAfterMs,
    requestId: recorded.requestId,
    body: recorded.body,
  });
}

/** Answers the line whose `request` is deep-equal to the incoming one. Key order is free. */
export function createReplayClient(lines: readonly ReplayLine[]): SystemOneClient {
  return {
    systemOne: async (request: SystemOneRequest): Promise<SystemOneResult> => {
      const line = lines.find((candidate) => deepEqual(candidate.request, request));
      if (!line) {
        throw new Error(
          `no replay line matches the request for model ${request.model} and questions ${Object.keys(request.questions).join(", ")}`,
        );
      }
      if ("error" in line) throw replayError(line.error);
      return line.response;
    },
  };
}

export interface RecordingOptions {
  /** The `id` written on each line. Defaults to the 1-based call index. */
  id?: (request: SystemOneRequest, index: number) => string;
  now?: () => Date;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

/** Duck typing, because core cannot name the SDK's error classes. */
function recordError(cause: unknown): ReplayError {
  const thrown = isObjectLike(cause) ? cause : {};
  return {
    name: asString(thrown["name"]) ?? "Error",
    message: asString(thrown["message"]) ?? String(cause),
    status: asNumber(thrown["status"]),
    retryAfterMs: asNumber(thrown["retryAfterMs"]),
    requestId: asString(thrown["requestId"]),
    body: thrown["body"],
  };
}

/** Wraps a live client and hands one replay line per call to `sink`. The live test's half. */
export function createRecordingClient(
  inner: SystemOneClient,
  sink: (line: ReplayLine) => void,
  options: RecordingOptions = {},
): SystemOneClient {
  const now = options.now ?? ((): Date => new Date());
  const nextId = options.id ?? ((_request: SystemOneRequest, index: number): string => `${index}`);
  let calls = 0;
  return {
    systemOne: async (
      request: SystemOneRequest,
      callOptions?: SystemOneCallOptions,
    ): Promise<SystemOneResult> => {
      const startedAt = now();
      const head = {
        format: 1 as const,
        id: nextId(request, ++calls),
        recordedAt: startedAt.toISOString(),
        request,
      };
      try {
        const response = await inner.systemOne(request, callOptions);
        sink({ ...head, durationMs: now().getTime() - startedAt.getTime(), response });
        return response;
      } catch (cause) {
        sink({
          ...head,
          durationMs: now().getTime() - startedAt.getTime(),
          error: recordError(cause),
        });
        throw cause;
      }
    },
  };
}
