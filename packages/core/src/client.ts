import type { EntryType, Questions } from "./recipe";

/** A Choice answer as the wire returns it; `probabilities` key order is not the Recipe's. */
export interface ChoiceResponse {
  readonly type: "choice";
  readonly choice: string;
  readonly confidence: number;
  readonly probabilities: { readonly [label: string]: number };
}

/** A Noul answer. The wire carries no `confidence`; the Judge derives one. */
export interface NoulResponse {
  readonly type: "noul";
  readonly noul: number;
}

export interface ScoreResponse {
  readonly type: "score";
  /** Expected value across the rubric, not a level index. The answer is the argmax. */
  readonly score: number;
  readonly confidence: number;
  readonly probabilities: { readonly [index: string]: number };
  /** Echoed criteria. Core never reads it, so its shape is the API's business. */
  readonly legend?: unknown;
}

export type AnswerResponse = ChoiceResponse | NoulResponse | ScoreResponse;

/** The wire shape, `usage` in snake case. The Judge camel-cases it into the Decision. */
export interface SystemOneResult {
  readonly model: string;
  readonly answers: { readonly [name: string]: AnswerResponse };
  readonly usage: { readonly input_tokens: number; readonly output_tokens: number };
}

export interface SystemOneRequest {
  state: EntryType;
  questions: Questions;
  model: string;
}

/** The slice of the SDK's retry policy the Judge sets. The client owns the rest. */
export interface RetryPolicy {
  readonly maxRetries: number;
  readonly backoffMaxMs: number;
  readonly maxRetryAfterMs: number;
}

export interface SystemOneCallOptions {
  retry?: Partial<RetryPolicy>;
  signal?: AbortSignal;
  timeout?: number;
}

/**
 * The only thing core asks of a client. Declared here, never imported from the SDK, so core
 * publishes no dependency on it.
 *
 * `systemOne` is a function-typed property, not a method: under `strictFunctionTypes` that
 * checks parameters contravariantly, so `types.test-d.ts` proving `TypeSafeClient` assignable
 * to this interface proves something. A method signature would be bivariant.
 */
export interface SystemOneClient {
  systemOne: (
    request: SystemOneRequest,
    options?: SystemOneCallOptions,
  ) => Promise<SystemOneResult>;
}
