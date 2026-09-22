import type { AnswerResponse, RetryPolicy, SystemOneClient, SystemOneResult } from "./client";
import type { AnswerValue, Decision, Evidence, Record } from "./decision";
import { SiftlineError } from "./errors";
import { isObjectLike } from "./object";
import type { Question, Questions, Recipe } from "./recipe";

/** The gate's width when the caller sets none (cloud ADR 0005). */
export const DEFAULT_MAX_IN_FLIGHT = 8;

/** `prompt` is the sync door, `patient` the batch one. The client does the retrying. */
export type RetryMode = "prompt" | "patient";

export type JudgeErrorReason =
  | "max_tokens_exceeded"
  | "api_usage_error"
  | "network"
  | "timeout"
  | "invalid_answers"
  | "unknown";

/**
 * The client gave up on a 429 or a 529. The fallback delay when `retryAfterMs` is `null`
 * belongs to the caller.
 */
export class JudgeExhaustedError extends SiftlineError {
  readonly retryAfterMs: number | null;

  constructor(message: string, retryAfterMs: number | null, options?: ErrorOptions) {
    super(message, "jev_exhausted", true, options);
    this.retryAfterMs = retryAfterMs;
  }
}

/** Everything else a judged call can fail on. The thrown value stays on `cause`. */
export class JudgeError extends SiftlineError {
  readonly status: number | null;
  readonly reason: JudgeErrorReason;

  constructor(
    message: string,
    reason: JudgeErrorReason,
    status: number | null,
    options?: ErrorOptions,
  ) {
    super(message, "jev_error", reason === "network" || reason === "timeout", options);
    this.status = status;
    this.reason = reason;
  }
}

export interface JudgeCallOptions {
  /** Overrides the minted `crypto.randomUUID()`, which is what makes a replay byte-stable. */
  id?: string;
  signal?: AbortSignal;
}

export interface Judge {
  <Q extends Questions>(
    record: Record,
    recipe: Recipe<Q>,
    callOptions?: JudgeCallOptions,
  ): Promise<Decision<Q>>;
}

export interface CreateJudgeOptions {
  client: SystemOneClient;
  retry: RetryMode;
  maxInFlight?: number;
  now?: () => Date;
}

interface RetrySettings {
  readonly retry: RetryPolicy;
  readonly timeout: number;
}

const RETRY_MODES: { readonly [M in RetryMode]: RetrySettings } = {
  prompt: {
    retry: { maxRetries: 1, backoffMaxMs: 2000, maxRetryAfterMs: 5000 },
    timeout: 10000,
  },
  patient: {
    retry: { maxRetries: 5, backoffMaxMs: 30000, maxRetryAfterMs: 60000 },
    timeout: 30000,
  },
};

interface Waiter {
  admit: () => void;
}

/**
 * FIFO, unbounded wait. A slot is held for the whole `systemOne` call, the SDK's internal
 * retries included, and an aborted waiter leaves the queue without ever taking one.
 */
function createGate(limit: number): (signal?: AbortSignal) => Promise<() => void> {
  let inFlight = 0;
  const queue: Waiter[] = [];

  function release(): void {
    const next = queue.shift();

    if (next) next.admit();
    else inFlight -= 1;
  }

  return async (signal?: AbortSignal): Promise<() => void> => {
    signal?.throwIfAborted();

    if (inFlight < limit) {
      inFlight += 1;

      return release;
    }

    await new Promise<void>((resolve, reject) => {
      let onAbort: (() => void) | undefined;

      const waiter: Waiter = {
        admit: () => {
          if (onAbort) signal?.removeEventListener("abort", onAbort);
          resolve();
        },
      };

      if (signal) {
        onAbort = (): void => {
          const index = queue.indexOf(waiter);

          if (index >= 0) queue.splice(index, 1);
          reject(signal.reason);
        };

        signal.addEventListener("abort", onAbort, { once: true });
      }

      queue.push(waiter);
    });

    return release;
  };
}

function errorType(thrown: { [key: string]: unknown }): string | undefined {
  const body = thrown["body"];
  if (!isObjectLike(body)) return undefined;
  const detail = body["detail"];
  if (!isObjectLike(detail)) return undefined;
  const type = detail["error_type"];
  return typeof type === "string" ? type : undefined;
}

function reasonOf(thrown: { [key: string]: unknown }, status: number | null): JudgeErrorReason {
  if (status === null) {
    const name = thrown["name"];
    return typeof name === "string" && /timeout/i.test(name) ? "timeout" : "network";
  }
  const type = errorType(thrown);
  if (type === "api_usage_error" || type === "max_tokens_exceeded") return type;

  return "unknown";
}

// An aborted signal is not enough on its own: a sibling's abort and a real 429 can land in
// the same tick, and the 429 still has to be mapped.
function isAbort(
  cause: unknown,
  thrown: { [key: string]: unknown },
  signal?: AbortSignal,
): boolean {
  if (signal?.aborted === true && cause === signal.reason) return true;
  const name = thrown["name"];
  return name === "AbortError" || name === "APIUserAbortError";
}

/** Duck typing, because core cannot import the SDK's error classes. Never returns. */
function mapClientError(cause: unknown, signal?: AbortSignal): never {
  const thrown = isObjectLike(cause) ? cause : {};
  if (isAbort(cause, thrown, signal)) throw cause;

  const rawStatus = thrown["status"];
  const status = typeof rawStatus === "number" ? rawStatus : null;
  const rawMessage = thrown["message"];
  const message = typeof rawMessage === "string" && rawMessage !== "" ? rawMessage : String(cause);

  if (status === 429 || status === 529) {
    const retryAfterMs = thrown["retryAfterMs"];
    throw new JudgeExhaustedError(message, typeof retryAfterMs === "number" ? retryAfterMs : null, {
      cause,
    });
  }

  throw new JudgeError(message, reasonOf(thrown, status), status, { cause });
}

function invalidAnswers(message: string): JudgeError {
  return new JudgeError(message, "invalid_answers", null);
}

/** Lowest key wins a tie, so the caller reads insertion order as the tie-break. */
function argmax(probabilities: { readonly [key: string]: number }): string {
  let best = "";
  let top = Number.NEGATIVE_INFINITY;

  for (const [key, probability] of Object.entries(probabilities)) {
    if (probability > top) {
      top = probability;
      best = key;
    }
  }

  return best;
}

function rebuild(
  name: string,
  keys: readonly string[],
  source: { readonly [key: string]: number },
): { [key: string]: number } {
  const probabilities: { [key: string]: number } = {};

  for (const key of keys) {
    const probability = source[key];
    if (typeof probability !== "number") {
      throw invalidAnswers(`question ${name} has no probability for ${key}`);
    }

    probabilities[key] = probability;
  }

  return probabilities;
}

interface Mapped {
  answers: { [name: string]: AnswerValue };
  questions: { [name: string]: Evidence };
  confidence: number;
}

function mismatch(name: string, question: Question, answer: AnswerResponse): JudgeError {
  return invalidAnswers(`question ${name} is a ${question.type}, answered as a ${answer.type}`);
}

function mapAnswer(
  name: string,
  question: Question,
  answer: AnswerResponse,
): { answer: AnswerValue; evidence: Evidence; confidence: number } {
  if (answer.type === "choice") {
    if (question.type !== "choice") throw mismatch(name, question, answer);
    const probabilities = rebuild(name, Object.keys(question.criteria), answer.probabilities);

    return {
      answer: argmax(probabilities),
      evidence: { confidence: answer.confidence, probabilities },
      confidence: answer.confidence,
    };
  }

  if (answer.type === "score") {
    if (question.type !== "score") throw mismatch(name, question, answer);
    const indices = question.criteria.map((_criterion, index) => String(index));
    const probabilities = rebuild(name, indices, answer.probabilities);

    return {
      answer: Number(argmax(probabilities)),
      evidence: { score: answer.score, confidence: answer.confidence, probabilities },
      confidence: answer.confidence,
    };
  }

  if (question.type !== "noul") throw mismatch(name, question, answer);
  const probability = answer.noul;
  const confidence = Math.round(Math.abs(2 * probability - 1) * 100) / 100;

  return { answer: probability >= 0.5, evidence: { probability, confidence }, confidence };
}

/** Rebuilt in Recipe insertion order, which is what `serializeDecision` writes out. */
function mapAnswers(recipe: Recipe, result: SystemOneResult): Mapped {
  const names = Object.keys(recipe.questions);
  const answered = Object.keys(result.answers);

  if (answered.length !== names.length || !names.every((name) => name in result.answers)) {
    throw invalidAnswers(
      `the model answered [${answered.join(", ")}], the Recipe asks [${names.join(", ")}]`,
    );
  }

  const answers: { [name: string]: AnswerValue } = {};
  const questions: { [name: string]: Evidence } = {};
  const confidences: number[] = [];

  for (const [name, question] of Object.entries(recipe.questions)) {
    const response = result.answers[name];

    if (!response) throw invalidAnswers(`question ${name} went unanswered`);
    const mapped = mapAnswer(name, question, response);
    answers[name] = mapped.answer;
    questions[name] = mapped.evidence;
    confidences.push(mapped.confidence);
  }

  return { answers, questions, confidence: Math.min(...confidences) };
}

export function createJudge(options: CreateJudgeOptions): Judge {
  const { client } = options;
  const { retry, timeout } = RETRY_MODES[options.retry];
  const now = options.now ?? ((): Date => new Date());
  const acquire = createGate(options.maxInFlight ?? DEFAULT_MAX_IN_FLIGHT);

  return async <Q extends Questions>(
    record: Record,
    recipe: Recipe<Q>,
    callOptions: JudgeCallOptions = {},
  ): Promise<Decision<Q>> => {
    const { signal } = callOptions;
    const release = await acquire(signal);
    let result: SystemOneResult;

    try {
      result = await client.systemOne(
        { state: record.state, questions: recipe.questions, model: recipe.model },
        { retry, signal, timeout },
      );
    } catch (cause) {
      mapClientError(cause, signal);
    } finally {
      release();
    }

    const mapped = mapAnswers(recipe, result);
    // Both maps are keyed by `recipe.questions`, which is `Q` itself; `Object.entries` is
    // what loses that, so the keys are recovered here rather than proved.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const { answers, questions } = mapped as unknown as Pick<Decision<Q>, "answers" | "questions">;

    return {
      format: 1,
      id: callOptions.id ?? crypto.randomUUID(),
      recordId: record.id,
      recipe: { name: recipe.name, version: recipe.version },
      model: result.model,
      judgedAt: now().toISOString(),
      trimmed: record.trimmed ?? false,
      answers,
      questions,
      confidence: mapped.confidence,
      review: mapped.confidence < recipe.reviewThreshold,
      rule: null,
      action: null,
      usage: {
        inputTokens: result.usage.input_tokens,
        outputTokens: result.usage.output_tokens,
      },
    };
  };
}
