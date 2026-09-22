import { readFileSync } from "node:fs";

import {
  createJudge,
  DEFAULT_MAX_IN_FLIGHT,
  JudgeError,
  JudgeExhaustedError,
  parseRecipe,
  serializeDecision,
} from "@siftline/core";
import type {
  AnswerResponse,
  Decision,
  Evidence,
  Recipe,
  SystemOneCallOptions,
  SystemOneClient,
  SystemOneRequest,
  SystemOneResult,
} from "@siftline/core";
import { createReplayClient, createScriptedClient, parseReplayLines } from "@siftline/core/testing";
import type { ReplayLine } from "@siftline/core/testing";
import { describe, expect, it } from "vitest";

// Imported by package name, not by relative path: this asserts the published `exports` map.

function read(path: string): string {
  return readFileSync(new URL(`../fixtures/${path}`, import.meta.url), "utf8");
}

const recipeNames = ["support-inbox", "feedback-widget", "doc-pair-check"] as const;

type RecipeName = (typeof recipeNames)[number];

const recipes: Record<RecipeName, Recipe> = {
  "support-inbox": parseRecipe(read("recipes/support-inbox.json")),
  "feedback-widget": parseRecipe(read("recipes/feedback-widget.json")),
  "doc-pair-check": parseRecipe(read("recipes/doc-pair-check.json")),
};

const corpus: Record<string, ReplayLine[]> = Object.fromEntries(
  [...recipeNames, "probes"].map((name) => [name, parseReplayLines(read(`replay/${name}.jsonl`))]),
);

function probe(id: string): ReplayLine {
  const found = corpus["probes"]?.find((line) => line.id === id);

  if (!found) throw new Error(`no probe ${id}`);

  return found;
}

const clock = (): Date => new Date("2026-09-21T14:03:11.204Z");

const supportInbox = recipes["support-inbox"];

const answered: SystemOneResult = {
  model: "jev-1.13.0",
  answers: {
    category: {
      type: "choice",
      choice: "other",
      confidence: 1,
      probabilities: { complaint: 0, question: 0, other: 1 },
    },
    wants_human: { type: "noul", noul: 0.02 },
  },
  usage: { input_tokens: 400, output_tokens: 59 },
};

/** A result over `support-inbox` with the two answers overridden question by question. */
function resultWith(answers: { [name: string]: AnswerResponse }): SystemOneResult {
  return { ...answered, answers: { ...answered.answers, ...answers } };
}

// ─── The recorded corpus ────────────────────────────────────────────────────────────────

interface Expectation {
  answers: { [name: string]: string | boolean | number };
  questions: { [name: string]: { [key: string]: unknown } };
  confidence: number;
  review: boolean;
}

// Derived by hand from the recordings, not from this module: argmax over the rebuilt
// probabilities, `|2p − 1|` to two decimals for Noul, the minimum for the Decision.
const expectations: Record<RecipeName, Record<string, Expectation>> = {
  "support-inbox": {
    "si-01": {
      answers: { category: "complaint", wants_human: true },
      questions: {
        category: { confidence: 1, probabilities: { complaint: 1, question: 0, other: 0 } },
        wants_human: { probability: 0.99, confidence: 0.98 },
      },
      confidence: 0.98,
      review: false,
    },
    "si-02": {
      answers: { category: "question", wants_human: false },
      questions: {
        category: { confidence: 1, probabilities: { complaint: 0, question: 1, other: 0 } },
        wants_human: { probability: 0.02, confidence: 0.96 },
      },
      confidence: 0.96,
      review: false,
    },
    "si-03": {
      answers: { category: "other", wants_human: false },
      questions: {
        category: { confidence: 1, probabilities: { complaint: 0, question: 0, other: 1 } },
        wants_human: { probability: 0.01, confidence: 0.98 },
      },
      confidence: 0.98,
      review: false,
    },
    "si-04": {
      answers: { category: "question", wants_human: false },
      questions: {
        category: {
          confidence: 0.58,
          probabilities: { complaint: 0.27, question: 0.72, other: 0.01 },
        },
        wants_human: { probability: 0.25, confidence: 0.5 },
      },
      confidence: 0.5,
      review: true,
    },
    "si-05": {
      answers: { category: "other", wants_human: false },
      questions: {
        category: { confidence: 1, probabilities: { complaint: 0, question: 0, other: 1 } },
        wants_human: { probability: 0.01, confidence: 0.98 },
      },
      confidence: 0.98,
      review: false,
    },
    "si-06": {
      answers: { category: "other", wants_human: false },
      questions: {
        category: { confidence: 1, probabilities: { complaint: 0, question: 0, other: 1 } },
        wants_human: { probability: 0.02, confidence: 0.96 },
      },
      confidence: 0.96,
      review: false,
    },
  },
  "feedback-widget": {
    "fw-01": {
      answers: { team: "product", angry: true, urgency: 3 },
      questions: {
        team: { confidence: 1, probabilities: { billing: 0, product: 1, sales: 0 } },
        angry: { probability: 0.92, confidence: 0.84 },
        urgency: { score: 3, confidence: 1, probabilities: { 0: 0, 1: 0, 2: 0, 3: 1 } },
      },
      confidence: 0.84,
      review: false,
    },
    "fw-02": {
      answers: { team: "product", angry: false, urgency: 0 },
      questions: {
        team: { confidence: 1, probabilities: { billing: 0, product: 1, sales: 0 } },
        angry: { probability: 0.06, confidence: 0.88 },
        urgency: { score: 0.2, confidence: 0.8, probabilities: { 0: 0.81, 1: 0.19, 2: 0, 3: 0 } },
      },
      confidence: 0.8,
      review: false,
    },
    "fw-03": {
      answers: { team: "sales", angry: false, urgency: 1 },
      questions: {
        team: { confidence: 0.89, probabilities: { billing: 0.07, product: 0, sales: 0.93 } },
        angry: { probability: 0.03, confidence: 0.94 },
        urgency: { score: 1.08, confidence: 0.92, probabilities: { 0: 0, 1: 0.92, 2: 0.08, 3: 0 } },
      },
      confidence: 0.89,
      review: false,
    },
    // The Score example the spec pins: argmax lands on level 2 and 0.54 is under the 0.6 gate.
    "fw-04": {
      answers: { team: "billing", angry: false, urgency: 2 },
      questions: {
        team: { confidence: 0.78, probabilities: { billing: 0.86, product: 0.14, sales: 0 } },
        angry: { probability: 0.15, confidence: 0.7 },
        urgency: {
          score: 1.54,
          confidence: 0.54,
          probabilities: { 0: 0.01, 1: 0.45, 2: 0.54, 3: 0 },
        },
      },
      confidence: 0.54,
      review: true,
    },
    "fw-05": {
      answers: { team: "product", angry: true, urgency: 2 },
      questions: {
        team: { confidence: 0.97, probabilities: { billing: 0.02, product: 0.98, sales: 0 } },
        angry: { probability: 0.87, confidence: 0.74 },
        urgency: {
          score: 2.05,
          confidence: 0.89,
          probabilities: { 0: 0, 1: 0.03, 2: 0.89, 3: 0.08 },
        },
      },
      confidence: 0.74,
      review: false,
    },
    "fw-06": {
      answers: { team: "product", angry: false, urgency: 0 },
      questions: {
        team: { confidence: 1, probabilities: { billing: 0, product: 1, sales: 0 } },
        angry: { probability: 0.04, confidence: 0.92 },
        urgency: {
          score: 0.39,
          confidence: 0.61,
          probabilities: { 0: 0.65, 1: 0.32, 2: 0.03, 3: 0 },
        },
      },
      confidence: 0.61,
      review: false,
    },
  },
  "doc-pair-check": {
    "dp-01": {
      answers: { language: "en", same_topic: "same" },
      questions: {
        language: { confidence: 1, probabilities: { en: 1, cs: 0, de: 0, other: 0 } },
        same_topic: {
          confidence: 0.28,
          probabilities: { same: 0.52, related: 0.48, unrelated: 0 },
        },
      },
      confidence: 0.28,
      review: true,
    },
    "dp-02": {
      answers: { language: "cs", same_topic: "unrelated" },
      questions: {
        language: { confidence: 1, probabilities: { en: 0, cs: 1, de: 0, other: 0 } },
        same_topic: { confidence: 0.9, probabilities: { same: 0, related: 0.07, unrelated: 0.93 } },
      },
      confidence: 0.9,
      review: false,
    },
    "dp-03": {
      answers: { language: "de", same_topic: "related" },
      questions: {
        language: { confidence: 1, probabilities: { en: 0, cs: 0, de: 1, other: 0 } },
        same_topic: { confidence: 0.54, probabilities: { same: 0.3, related: 0.7, unrelated: 0 } },
      },
      confidence: 0.54,
      review: true,
    },
    "dp-04": {
      answers: { language: "other", same_topic: "related" },
      questions: {
        language: { confidence: 1, probabilities: { en: 0, cs: 0, de: 0, other: 1 } },
        same_topic: {
          confidence: 0.94,
          probabilities: { same: 0.01, related: 0.96, unrelated: 0.03 },
        },
      },
      confidence: 0.94,
      review: false,
    },
    "dp-05": {
      answers: { language: "en", same_topic: "unrelated" },
      questions: {
        language: { confidence: 1, probabilities: { en: 1, cs: 0, de: 0, other: 0 } },
        same_topic: {
          confidence: 0.61,
          probabilities: { same: 0, related: 0.26, unrelated: 0.74 },
        },
      },
      confidence: 0.61,
      review: true,
    },
  },
};

function probabilityKeys(block: Evidence | undefined): string[] {
  return block && "probabilities" in block ? Object.keys(block.probabilities) : [];
}

/** The key order a Recipe dictates, which `serializeDecision` then writes out verbatim. */
function probabilityOrder(recipe: Recipe, name: string): string[] {
  const question = recipe.questions[name];

  if (question?.type === "choice") return Object.keys(question.criteria);

  if (question?.type === "score") return question.criteria.map((_c, index) => String(index));

  return [];
}

describe("judging the recorded corpus", () => {
  for (const name of recipeNames) {
    const recipe = recipes[name];
    const lines = corpus[name] ?? [];

    for (const line of lines) {
      const recordId = line.id.slice(line.id.indexOf("/") + 1);

      it(`replays ${line.id} to the pinned Decision`, async () => {
        const judge = createJudge({
          client: createReplayClient(lines),
          retry: "patient",
          now: clock,
        });

        const decision = await judge({ id: recordId, state: line.request.state }, recipe, {
          id: recordId,
        });

        const pinned = expectations[name][recordId];

        expect(pinned).toBeDefined();
        expect(decision.answers).toEqual(pinned?.answers);
        expect(decision.questions).toEqual(pinned?.questions);
        expect(decision.confidence).toBe(pinned?.confidence);
        expect(decision.review).toBe(pinned?.review);

        expect(Object.keys(decision.answers)).toEqual(Object.keys(recipe.questions));
        expect(Object.keys(decision.questions)).toEqual(Object.keys(recipe.questions));

        for (const question of Object.keys(recipe.questions)) {
          const order = probabilityOrder(recipe, question);

          if (order.length === 0) continue;
          expect(probabilityKeys(decision.questions[question])).toEqual(order);
        }
      });
    }
  }

  it("rebuilds Choice probabilities in Recipe order, not the wire's", async () => {
    const lines = corpus["support-inbox"] ?? [];
    const line = lines[0];

    if (!line || !("response" in line)) throw new Error("si-01 is not a recorded answer");
    const wire = line.response.answers["category"];

    if (wire?.type !== "choice") throw new Error("si-01 has no Choice answer");
    expect(Object.keys(wire.probabilities)).toEqual(["question", "other", "complaint"]);

    const judge = createJudge({ client: createReplayClient(lines), retry: "patient", now: clock });
    const decision = await judge({ id: "si-01", state: line.request.state }, supportInbox);

    expect(probabilityKeys(decision.questions["category"])).toEqual([
      "complaint",
      "question",
      "other",
    ]);
  });
});

// ─── Answer mapping ─────────────────────────────────────────────────────────────────────

describe("mapping answers", () => {
  function judgeOnce(result: SystemOneResult, recipe: Recipe = supportInbox): Promise<Decision> {
    const judge = createJudge({
      client: createScriptedClient([{ response: result }]),
      retry: "prompt",
      now: clock,
    });

    return judge({ id: "rec", state: "hello" }, recipe, { id: "dec" });
  }

  it("breaks a Choice tie on the lowest Recipe-order label", async () => {
    const decision = await judgeOnce(
      resultWith({
        category: {
          type: "choice",
          choice: "question",
          confidence: 0.3,
          probabilities: { other: 0, question: 0.5, complaint: 0.5 },
        },
      }),
    );

    expect(decision.answers["category"]).toBe("complaint");
  });

  it("takes the argmax of a Score, never the rounded expected value", async () => {
    const recipe = recipes["feedback-widget"];

    const decision = await judgeOnce(
      {
        model: "jev-1.13.0",
        answers: {
          team: {
            type: "choice",
            choice: "billing",
            confidence: 1,
            probabilities: { billing: 1, product: 0, sales: 0 },
          },
          angry: { type: "noul", noul: 0.01 },
          urgency: {
            type: "score",
            score: 1.65,
            confidence: 0.5,
            legend: { 0: "a", 1: "b", 2: "c", 3: "d" },
            probabilities: { 0: 0.45, 1: 0, 2: 0, 3: 0.55 },
          },
        },
        usage: { input_tokens: 1, output_tokens: 1 },
      },
      recipe,
    );

    expect(decision.answers["urgency"]).toBe(3);
    expect(decision.questions["urgency"]).toEqual({
      score: 1.65,
      confidence: 0.5,
      probabilities: { 0: 0.45, 1: 0, 2: 0, 3: 0.55 },
    });
  });

  it("breaks a Score tie on the lowest index", async () => {
    const recipe = recipes["feedback-widget"];

    const decision = await judgeOnce(
      {
        model: "jev-1.13.0",
        answers: {
          team: {
            type: "choice",
            choice: "billing",
            confidence: 1,
            probabilities: { billing: 1, product: 0, sales: 0 },
          },
          angry: { type: "noul", noul: 0.01 },
          urgency: {
            type: "score",
            score: 1.5,
            confidence: 0.5,
            probabilities: { 0: 0, 1: 0.5, 2: 0.5, 3: 0 },
          },
        },
        usage: { input_tokens: 1, output_tokens: 1 },
      },
      recipe,
    );

    expect(decision.answers["urgency"]).toBe(1);
  });

  it("derives a Noul confidence and leaves Choice confidence alone", async () => {
    const decision = await judgeOnce(
      resultWith({
        category: {
          type: "choice",
          choice: "question",
          confidence: 0.58,
          probabilities: { complaint: 0.27, question: 0.72, other: 0.01 },
        },
        wants_human: { type: "noul", noul: 0.82 },
      }),
    );

    expect(decision.questions["wants_human"]).toEqual({ probability: 0.82, confidence: 0.64 });
    expect(decision.questions["category"]).toEqual({
      confidence: 0.58,
      probabilities: { complaint: 0.27, question: 0.72, other: 0.01 },
    });
    expect(decision.confidence).toBe(0.58);
  });

  it("rejects an answer set whose keys miss the Recipe", async () => {
    const extra = judgeOnce(resultWith({ mood: { type: "noul", noul: 0.5 } }));
    await expect(extra).rejects.toMatchObject({ code: "jev_error", reason: "invalid_answers" });

    const missing = judgeOnce({
      ...answered,
      answers: {
        category: {
          type: "choice",
          choice: "other",
          confidence: 1,
          probabilities: { complaint: 0, question: 0, other: 1 },
        },
      },
    });

    await expect(missing).rejects.toBeInstanceOf(JudgeError);
    await expect(missing).rejects.toMatchObject({ reason: "invalid_answers", retryable: false });
  });

  it("rejects an answer of the wrong type", async () => {
    const wrong = judgeOnce(resultWith({ category: { type: "noul", noul: 0.5 } }));
    await expect(wrong).rejects.toMatchObject({ reason: "invalid_answers" });
  });

  it("rejects a Score missing an index", async () => {
    const recipe = recipes["feedback-widget"];

    const gap = judgeOnce(
      {
        model: "jev-1.13.0",
        answers: {
          team: {
            type: "choice",
            choice: "billing",
            confidence: 1,
            probabilities: { billing: 1, product: 0, sales: 0 },
          },
          angry: { type: "noul", noul: 0.01 },
          urgency: {
            type: "score",
            score: 1,
            confidence: 0.9,
            probabilities: { 0: 0, 1: 0.9, 2: 0.1 },
          },
        },
        usage: { input_tokens: 1, output_tokens: 1 },
      },
      recipe,
    );

    await expect(gap).rejects.toBeInstanceOf(JudgeError);
    await expect(gap).rejects.toMatchObject({ reason: "invalid_answers", status: null });
  });
});

// ─── Errors ─────────────────────────────────────────────────────────────────────────────

function thrown(fields: { [key: string]: unknown }): Error {
  return Object.assign(new Error("the client gave up"), fields);
}

function judgeThrowing(error: unknown, recipe: Recipe = supportInbox): Promise<unknown> {
  const judge = createJudge({
    client: createScriptedClient([{ error }]),
    retry: "prompt",
    now: clock,
  });

  return judge({ id: "rec", state: "hello" }, recipe);
}

describe("mapping what the client throws", () => {
  it("maps the recorded unknown-model probe to api_usage_error", async () => {
    const line = probe("probe/unknown-model");

    const judge = createJudge({
      client: createReplayClient(corpus["probes"] ?? []),
      retry: "prompt",
      now: clock,
    });

    const failure = judge(
      { id: "rec", state: line.request.state },
      {
        ...supportInbox,
        model: "jev-0.0.0",
      },
    );

    await expect(failure).rejects.toBeInstanceOf(JudgeError);
    await expect(failure).rejects.toMatchObject({
      code: "jev_error",
      reason: "api_usage_error",
      status: 400,
      retryable: false,
    });
  });

  it("maps the recorded over-budget probe to max_tokens_exceeded", async () => {
    const line = probe("probe/over-budget");

    const judge = createJudge({
      client: createReplayClient(corpus["probes"] ?? []),
      retry: "prompt",
      now: clock,
    });

    const failure = judge({ id: "rec", state: line.request.state }, supportInbox);

    await expect(failure).rejects.toMatchObject({
      code: "jev_error",
      reason: "max_tokens_exceeded",
      status: 400,
      retryable: false,
    });
  });

  it("keeps the thrown error on `cause`", async () => {
    const error = thrown({ name: "BadRequestError", status: 400, body: { detail: {} } });
    const failure = judgeThrowing(error);
    await expect(failure).rejects.toMatchObject({ reason: "unknown", cause: error });
  });

  it("maps 429 to an exhausted error carrying the server's delay", async () => {
    const failure = judgeThrowing(
      thrown({ name: "RateLimitError", status: 429, retryAfterMs: 1200 }),
    );

    await expect(failure).rejects.toBeInstanceOf(JudgeExhaustedError);
    await expect(failure).rejects.toMatchObject({
      code: "jev_exhausted",
      retryable: true,
      retryAfterMs: 1200,
    });
  });

  it("maps 429 without a delay to a null `retryAfterMs`", async () => {
    const failure = judgeThrowing(thrown({ name: "RateLimitError", status: 429 }));
    await expect(failure).rejects.toMatchObject({ retryAfterMs: null });
  });

  it("maps 529 to an exhausted error", async () => {
    const failure = judgeThrowing(thrown({ name: "InternalServerError", status: 529 }));
    await expect(failure).rejects.toBeInstanceOf(JudgeExhaustedError);
    await expect(failure).rejects.toMatchObject({ code: "jev_exhausted", retryAfterMs: null });
  });

  it("maps a status-less failure to network, and a timeout by name", async () => {
    const network = judgeThrowing(thrown({ name: "APIConnectionError" }));
    await expect(network).rejects.toMatchObject({
      reason: "network",
      status: null,
      retryable: true,
    });

    const timeout = judgeThrowing(thrown({ name: "APITimeoutError" }));
    await expect(timeout).rejects.toMatchObject({
      reason: "timeout",
      status: null,
      retryable: true,
    });
  });

  it("maps an unrecognised status to unknown, which is not retryable", async () => {
    const failure = judgeThrowing(thrown({ name: "InternalServerError", status: 500 }));
    await expect(failure).rejects.toMatchObject({
      reason: "unknown",
      status: 500,
      retryable: false,
    });
  });
});

// ─── The gate ───────────────────────────────────────────────────────────────────────────

interface GatedClient extends SystemOneClient {
  readonly started: string[];
  finish: (key: string) => void;
  fail: (key: string, error: unknown) => void;
}

/** Holds every call open until the test settles it, so concurrency is observed, not counted. */
function createGatedClient(): GatedClient {
  const started: string[] = [];

  const settlers = new Map<
    string,
    { resolve: (result: SystemOneResult) => void; reject: (error: unknown) => void }
  >();

  return {
    started,
    finish: (key) => settlers.get(key)?.resolve(answered),
    fail: (key, error) => settlers.get(key)?.reject(error),
    systemOne: (request: SystemOneRequest): Promise<SystemOneResult> =>
      new Promise<SystemOneResult>((resolve, reject) => {
        const key = typeof request.state === "string" ? request.state : "";
        started.push(key);
        settlers.set(key, { resolve, reject });
      }),
  };
}

const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe("the in-flight gate", () => {
  it("defaults to eight slots", () => {
    expect(DEFAULT_MAX_IN_FLIGHT).toBe(8);
  });

  it("admits at most `maxInFlight` calls at once, in FIFO order", async () => {
    const client = createGatedClient();
    const judge = createJudge({ client, retry: "prompt", maxInFlight: 2, now: clock });
    const keys = ["a", "b", "c", "d"];
    const running = keys.map((key) => judge({ id: key, state: key }, supportInbox, { id: key }));

    await tick();
    expect(client.started).toEqual(["a", "b"]);

    client.finish("a");
    await tick();
    expect(client.started).toEqual(["a", "b", "c"]);

    client.finish("b");
    await tick();
    expect(client.started).toEqual(["a", "b", "c", "d"]);

    client.finish("c");
    client.finish("d");
    const decisions = await Promise.all(running);
    expect(decisions.map((decision) => decision.recordId)).toEqual(keys);
  });

  it("frees the slot a failed call held", async () => {
    const client = createGatedClient();
    const judge = createJudge({ client, retry: "prompt", maxInFlight: 1, now: clock });
    const first = judge({ id: "a", state: "a" }, supportInbox);
    const second = judge({ id: "b", state: "b" }, supportInbox);

    await tick();
    expect(client.started).toEqual(["a"]);

    client.fail("a", thrown({ name: "InternalServerError", status: 500 }));
    await expect(first).rejects.toBeInstanceOf(JudgeError);
    await tick();
    expect(client.started).toEqual(["a", "b"]);

    client.finish("b");
    await second;
  });

  it("never gives a slot to an aborted waiter", async () => {
    const client = createGatedClient();
    const judge = createJudge({ client, retry: "prompt", maxInFlight: 1, now: clock });
    const controller = new AbortController();
    const first = judge({ id: "a", state: "a" }, supportInbox);
    const waiting = judge({ id: "b", state: "b" }, supportInbox, { signal: controller.signal });
    const third = judge({ id: "c", state: "c" }, supportInbox);

    await tick();
    expect(client.started).toEqual(["a"]);

    controller.abort();
    await expect(waiting).rejects.toBe(controller.signal.reason);

    client.finish("a");
    await tick();
    expect(client.started).toEqual(["a", "c"]);

    client.finish("c");
    await Promise.all([first, third]);
    expect(client.started).not.toContain("b");
  });

  it("refuses a call whose signal is already aborted", async () => {
    const client = createGatedClient();
    const judge = createJudge({ client, retry: "prompt", now: clock });
    const controller = new AbortController();
    controller.abort();

    await expect(
      judge({ id: "a", state: "a" }, supportInbox, { signal: controller.signal }),
    ).rejects.toBe(controller.signal.reason);
    expect(client.started).toEqual([]);
  });

  it("rethrows the client's abort error untouched", async () => {
    const client = createGatedClient();
    const judge = createJudge({ client, retry: "prompt", now: clock });
    const controller = new AbortController();
    const running = judge({ id: "a", state: "a" }, supportInbox, { signal: controller.signal });

    await tick();
    const abort = thrown({ name: "APIUserAbortError" });
    controller.abort();
    client.fail("a", abort);

    await expect(running).rejects.toBe(abort);
  });

  it("still maps a 429 that lands while the signal is aborted", async () => {
    const client = createGatedClient();
    const judge = createJudge({ client, retry: "prompt", now: clock });
    const controller = new AbortController();
    const running = judge({ id: "a", state: "a" }, supportInbox, { signal: controller.signal });

    await tick();
    controller.abort();
    client.fail("a", thrown({ name: "RateLimitError", status: 429, retryAfterMs: 1200 }));

    await expect(running).rejects.toMatchObject({
      name: "JudgeExhaustedError",
      code: "jev_exhausted",
      retryAfterMs: 1200,
    });
  });
});

// ─── Retry and the Decision's own fields ────────────────────────────────────────────────

interface CapturingClient extends SystemOneClient {
  readonly options: SystemOneCallOptions[];
}

function createCapturingClient(): CapturingClient {
  const options: SystemOneCallOptions[] = [];

  return {
    options,
    systemOne: async (
      _request: SystemOneRequest,
      callOptions?: SystemOneCallOptions,
    ): Promise<SystemOneResult> => {
      options.push(callOptions ?? {});

      return answered;
    },
  };
}

describe("the call the Judge makes", () => {
  it("passes the prompt policy on every call", async () => {
    const client = createCapturingClient();
    const judge = createJudge({ client, retry: "prompt", now: clock });
    await judge({ id: "a", state: "a" }, supportInbox);
    await judge({ id: "b", state: "b" }, supportInbox);

    expect(client.options).toEqual([
      { retry: { maxRetries: 1, backoffMaxMs: 2000, maxRetryAfterMs: 5000 }, timeout: 10000 },
      { retry: { maxRetries: 1, backoffMaxMs: 2000, maxRetryAfterMs: 5000 }, timeout: 10000 },
    ]);
  });

  it("passes the patient policy on every call", async () => {
    const client = createCapturingClient();
    const judge = createJudge({ client, retry: "patient", now: clock });
    await judge({ id: "a", state: "a" }, supportInbox);
    await judge({ id: "b", state: "b" }, supportInbox);

    expect(client.options).toEqual([
      { retry: { maxRetries: 5, backoffMaxMs: 30000, maxRetryAfterMs: 60000 }, timeout: 30000 },
      { retry: { maxRetries: 5, backoffMaxMs: 30000, maxRetryAfterMs: 60000 }, timeout: 30000 },
    ]);
  });

  it("sends the Record's state and the Recipe's questions and model untouched", async () => {
    const client = createScriptedClient([{ response: answered }]);
    const judge = createJudge({ client, retry: "prompt", now: clock });
    await judge({ id: "a", state: { text: "hi" } }, supportInbox);

    expect(client.calls).toEqual([
      { state: { text: "hi" }, questions: supportInbox.questions, model: supportInbox.model },
    ]);
  });
});

describe("the Decision the Judge builds", () => {
  it("takes `model` from the response and never checks it against the Recipe", async () => {
    // The recorded alias probe: the API answered `jev-latest` with `jev-1.13.0`. The Recipe
    // schema rejects the alias, so the Recipe is built as an object rather than parsed.
    const line = probe("probe/alias-latest");
    const aliased: Recipe = { ...supportInbox, model: "jev-latest" };

    const judge = createJudge({
      client: createReplayClient(corpus["probes"] ?? []),
      retry: "prompt",
      now: clock,
    });

    const decision = await judge({ id: "rec", state: line.request.state }, aliased);

    expect(decision.model).toBe("jev-1.13.0");
    expect(decision.recipe).toEqual({ name: "support-inbox", version: 1 });
  });

  it("copies `trimmed` from the Record", async () => {
    const judge = createJudge({
      client: createScriptedClient([{ response: answered }, { response: answered }]),
      retry: "prompt",
      now: clock,
    });

    expect((await judge({ id: "a", state: "a", trimmed: true }, supportInbox)).trimmed).toBe(true);
    expect((await judge({ id: "b", state: "b" }, supportInbox)).trimmed).toBe(false);
  });

  it("mints an id when none is given, and returns no Rule", async () => {
    const judge = createJudge({
      client: createScriptedClient([{ response: answered }]),
      retry: "prompt",
      now: clock,
    });

    const decision = await judge({ id: "a", state: "a" }, supportInbox);

    expect(decision.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(decision.rule).toBeNull();
    expect(decision.action).toBeNull();
    expect(decision.usage).toEqual({ inputTokens: 400, outputTokens: 59 });
    expect(decision.judgedAt).toBe("2026-09-21T14:03:11.204Z");
  });

  it("serializes to the same bytes twice under a fixed id and clock", async () => {
    const lines = corpus["feedback-widget"] ?? [];
    const line = lines[3];

    if (!line) throw new Error("fw-04 is missing");
    const recipe = recipes["feedback-widget"];

    const judge = createJudge({
      client: createReplayClient(lines),
      retry: "patient",
      now: clock,
    });

    const record = { id: "fw-04", state: line.request.state };
    const first = await judge(record, recipe, { id: "d1" });
    const second = await judge(record, recipe, { id: "d1" });

    expect(serializeDecision(second)).toBe(serializeDecision(first));
    expect(serializeDecision(first)).toContain(
      '"answers":{"team":"billing","angry":false,"urgency":2}',
    );
    expect(serializeDecision(first)).toContain(
      '"urgency":{"score":1.54,"confidence":0.54,"probabilities":{"0":0.01,"1":0.45,"2":0.54,"3":0}}',
    );
  });
});
