import { readFileSync } from "node:fs";

import {
  compareAnswers,
  createJudge,
  defineFixtures,
  FixtureParseError,
  FixtureValidationError,
  parseDecision,
  parseFixture,
  parseFixtures,
  parseRecipe,
  scoreResults,
  serializeFixture,
  SiftlineError,
  testRecipe,
  validateFixtures,
} from "@siftline/core";
import type {
  EntryType,
  Fixture,
  FixtureResult,
  Judge,
  SystemOneClient,
  SystemOneResult,
} from "@siftline/core";
import { createReplayClient, parseReplayLines } from "@siftline/core/testing";
import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

// Imported by package name, not by relative path: this asserts the published `exports` map.

function read(path: string): string {
  return readFileSync(new URL(`../fixtures/${path}`, import.meta.url), "utf8");
}

const supportInbox = parseRecipe(read("recipes/support-inbox.json"));

const feedbackWidget = parseRecipe(read("recipes/feedback-widget.json"));

const referenceDecision = parseDecision(read("decisions/support-inbox.jsonl"));

const recordings = parseReplayLines(read("replay/support-inbox.jsonl"));

function stateOf(recordId: string): EntryType {
  const line = recordings.find((recorded) => recorded.id === `support-inbox/${recordId}`);

  if (!line) throw new Error(`no recording ${recordId}`);

  return line.request.state;
}

const clock = (): Date => new Date("2026-09-21T14:03:11.204Z");

function replayJudge(maxInFlight?: number): Judge {
  return createJudge({
    client: createReplayClient(recordings),
    retry: "patient",
    now: clock,
    maxInFlight,
  });
}

describe("the Fixture line", () => {
  const full =
    '{"id":"f1","origin":"portal","by":"anna@example.com",' +
    '"state":{"subject":"Charged twice","text":"You charged me twice"},' +
    '"expect":{"category":"complaint","wants_human":true}}';

  it("round-trips byte for byte, keys in order", () => {
    expect(serializeFixture(parseFixture(full))).toBe(full);
  });

  it("omits absent optionals", () => {
    const bare = '{"state":"ok","expect":{"wants_human":false}}';
    expect(serializeFixture(parseFixture(bare))).toBe(bare);
  });

  it("keeps a whole EntryType as the state", () => {
    const list = '{"state":[1,"two",null],"expect":{"wants_human":false}}';
    expect(serializeFixture(parseFixture(list))).toBe(list);
    expect(parseFixture('{"state":null,"expect":{"wants_human":false}}').state).toBeNull();
  });

  it("is strict, and `expect` needs at least one key", () => {
    expect(() => parseFixture('{"state":"ok","expect":{"a":1},"format":1}')).toThrow(ZodError);
    expect(() => parseFixture('{"state":"ok","expect":{}}')).toThrow(ZodError);
    expect(() => parseFixture('{"expect":{"a":1}}')).toThrow(ZodError);
  });

  it("skips blank lines", () => {
    const bare = '{"state":"ok","expect":{"wants_human":false}}';
    expect(parseFixtures(`${full}\n\n${bare}\n`)).toHaveLength(2);
    expect(parseFixtures("")).toEqual([]);
    expect(parseFixtures("\n  \n")).toEqual([]);
  });

  it("names the 1-based bad line", () => {
    let thrown: unknown;

    try {
      parseFixtures(`${full}\n\n{"state":"ok"}`);
    } catch (cause) {
      thrown = cause;
    }

    expect(thrown).toBeInstanceOf(FixtureParseError);
    expect(thrown).toBeInstanceOf(SiftlineError);
    expect(thrown).toMatchObject({
      name: "FixtureParseError",
      code: "fixture_invalid",
      retryable: false,
      line: 3,
    });
  });
});

describe("validateFixtures", () => {
  it("is empty on Fixtures that fit", () => {
    const clean: Fixture[] = [
      { id: "a", state: "x", expect: { category: "complaint", wants_human: true } },
      { state: "y", expect: { wants_human: false } },
    ];

    expect(validateFixtures(clean, supportInbox)).toEqual([]);
  });

  it("reports an unknown Question, keyed by the id or the 1-based index", () => {
    const problems = validateFixtures(
      [
        { state: "x", expect: { teem: "complaint" } },
        { id: "f2", state: "y", expect: { teem: "complaint" } },
      ],
      supportInbox,
    );

    expect(problems).toEqual([
      { fixture: "1", problem: 'unknown question "teem"' },
      { fixture: "f2", problem: 'unknown question "teem"' },
    ]);
  });

  it("reports a label outside the Choice", () => {
    const problems = validateFixtures([{ state: "x", expect: { category: "spam" } }], supportInbox);
    expect(problems).toEqual([
      { fixture: "1", problem: 'unknown label "spam" for question "category"' },
    ]);
  });

  it("reports a non-boolean for a Noul", () => {
    const problems = validateFixtures(
      [{ state: "x", expect: { wants_human: "yes" } }],
      supportInbox,
    );

    expect(problems).toEqual([
      { fixture: "1", problem: 'value "yes" is not a boolean for question "wants_human"' },
    ]);
  });

  it("reports a level index out of range", () => {
    const problems = validateFixtures(
      [
        { state: "x", expect: { urgency: 4 } },
        { state: "y", expect: { urgency: -1 } },
        { state: "z", expect: { urgency: 1.5 } },
      ],
      feedbackWidget,
    );

    expect(problems).toEqual([
      { fixture: "1", problem: 'level index 4 is out of range (0-3) for question "urgency"' },
      { fixture: "2", problem: 'level index -1 is out of range (0-3) for question "urgency"' },
      { fixture: "3", problem: 'level index 1.5 is out of range (0-3) for question "urgency"' },
    ]);
  });

  it("reports a duplicate id once per repeat", () => {
    const problems = validateFixtures(
      [
        { id: "f1", state: "x", expect: { wants_human: true } },
        { id: "f1", state: "y", expect: { wants_human: false } },
        { id: "f1", state: "z", expect: { wants_human: false } },
      ],
      supportInbox,
    );

    expect(problems).toEqual([
      { fixture: "f1", problem: 'duplicate id "f1"' },
      { fixture: "f1", problem: 'duplicate id "f1"' },
    ]);
  });
});

describe("defineFixtures", () => {
  it("returns the Fixtures it was given", () => {
    const written = defineFixtures(supportInbox, [
      { state: "x", expect: { category: "complaint" } },
    ]);

    expect(written).toEqual([{ state: "x", expect: { category: "complaint" } }]);
  });

  it("rebuilds `expect` in Recipe order", () => {
    const written = defineFixtures(supportInbox, [
      { state: "x", expect: { wants_human: true, category: "complaint" } },
    ]);

    const [first] = written;

    if (!first) throw new Error("defineFixtures dropped the Fixture");

    expect(Object.keys(first.expect)).toEqual(["category", "wants_human"]);
    expect(serializeFixture(first)).toBe(
      '{"state":"x","expect":{"category":"complaint","wants_human":true}}',
    );
  });

  it("throws a FixtureValidationError carrying every problem", () => {
    let thrown: unknown;

    try {
      defineFixtures(supportInbox, [
        { state: "x", expect: { category: "spam" } },
        { state: "y", expect: { wants_human: true } },
        { state: "z", expect: { teem: "complaint" } },
      ] as Fixture[]);
    } catch (cause) {
      thrown = cause;
    }

    expect(thrown).toBeInstanceOf(FixtureValidationError);
    expect(thrown).toBeInstanceOf(SiftlineError);
    expect(thrown).toMatchObject({
      name: "FixtureValidationError",
      code: "fixture_invalid",
      retryable: false,
      message: '1: unknown label "spam" for question "category" (and 1 more)',
      problems: [
        { fixture: "1", problem: 'unknown label "spam" for question "category"' },
        { fixture: "3", problem: 'unknown question "teem"' },
      ],
    });
  });

  it("runs the schema too", () => {
    expect(() => defineFixtures(supportInbox, [{ state: "x", expect: {} }])).toThrow(ZodError);
  });
});

describe("compareAnswers", () => {
  it("is empty when every asserted Question matches", () => {
    expect(
      compareAnswers({ category: "complaint" }, { category: "complaint", wants_human: true }),
    ).toEqual([]);
  });

  it("reports the expected and the actual, in `expect` order", () => {
    expect(
      compareAnswers(
        { wants_human: true, category: "complaint" },
        { category: "question", wants_human: false },
      ),
    ).toEqual([
      { question: "wants_human", expected: true, actual: false },
      { question: "category", expected: "complaint", actual: "question" },
    ]);
  });

  it("leaves `actual` undefined when the Decision has no answer", () => {
    expect(compareAnswers({ urgency: 2 }, { category: "other" })).toEqual([
      { question: "urgency", expected: 2, actual: undefined },
    ]);
  });

  it("compares strictly, with no tolerance", () => {
    expect(compareAnswers({ urgency: 2 }, { urgency: 3 })).toHaveLength(1);
    expect(compareAnswers({ wants_human: true }, { wants_human: 1 })).toHaveLength(1);
  });
});

// ─── The worked example ─────────────────────────────────────────────────────────────────

// Five Fixtures over the recorded `support-inbox` corpus. `fixture:4` asserts `complaint`
// where si-04 answers `question`, and si-04 is the one unsure Decision (confidence 0.5).
const workedFixtures = defineFixtures(supportInbox, [
  { state: stateOf("si-01"), expect: { category: "complaint", wants_human: true } },
  { state: stateOf("si-02"), expect: { category: "question", wants_human: false } },
  { state: stateOf("si-03"), expect: { category: "other", wants_human: false } },
  { state: stateOf("si-04"), expect: { category: "complaint", wants_human: false } },
  { state: stateOf("si-05"), expect: { category: "other", wants_human: false } },
]);

describe("testRecipe over the replay corpus", () => {
  it("yields the spec's numbers", async () => {
    const report = await testRecipe(replayJudge(), supportInbox, workedFixtures);

    expect(report.recipe).toEqual({ name: "support-inbox", version: 1 });
    expect(report.model).toBe("jev-1.13.0");
    expect(report.questions).toEqual({
      category: { asserted: 5, matched: 4, accuracy: 0.8 },
      wants_human: { asserted: 5, matched: 5, accuracy: 1 },
    });
    expect(Object.keys(report.questions)).toEqual(Object.keys(supportInbox.questions));
    expect(report.accuracy).toBe(0.8);
  });

  it("keeps the Fixtures in input order and names the unnamed ones", async () => {
    const report = await testRecipe(replayJudge(), supportInbox, workedFixtures);

    expect(report.fixtures.map((result) => result.id)).toEqual([
      "fixture:1",
      "fixture:2",
      "fixture:3",
      "fixture:4",
      "fixture:5",
    ]);
    expect(report.fixtures.map((result) => result.index)).toEqual([1, 2, 3, 4, 5]);
    expect(report.fixtures.map((result) => result.decision.recordId)).toEqual([
      "fixture:1",
      "fixture:2",
      "fixture:3",
      "fixture:4",
      "fixture:5",
    ]);
  });

  it("reports the one miss and the one unsure Decision", async () => {
    const report = await testRecipe(replayJudge(), supportInbox, workedFixtures);

    expect(report.fixtures.flatMap((result) => result.mismatches)).toEqual([
      { question: "category", expected: "complaint", actual: "question" },
    ]);
    expect(report.fixtures.filter((result) => result.review).map((result) => result.id)).toEqual([
      "fixture:4",
    ]);
  });

  it("counts an unsure Decision on its answers", async () => {
    const report = await testRecipe(replayJudge(), supportInbox, workedFixtures);
    const unsure = report.fixtures[3];

    expect(unsure?.review).toBe(true);
    expect(unsure?.decision.answers).toEqual({ category: "question", wants_human: false });
    // Its `wants_human` still counts, which is what makes that row 5/5.
    expect(report.questions["wants_human"]?.matched).toBe(5);
  });

  it("uses a Fixture's own id when it has one", async () => {
    const named = defineFixtures(supportInbox, [
      { id: "anna", state: stateOf("si-01"), expect: { category: "complaint" } },
    ]);

    const report = await testRecipe(replayJudge(), supportInbox, named);

    expect(report.fixtures[0]?.id).toBe("anna");
    expect(report.fixtures[0]?.decision.recordId).toBe("anna");
  });
});

describe("the denominators", () => {
  it("leaves the unasserted Question's denominator alone", async () => {
    const partial = defineFixtures(supportInbox, [
      { state: stateOf("si-01"), expect: { category: "complaint", wants_human: true } },
      { state: stateOf("si-02"), expect: { wants_human: false } },
    ]);

    const report = await testRecipe(replayJudge(), supportInbox, partial);

    expect(report.questions).toEqual({
      category: { asserted: 1, matched: 1, accuracy: 1 },
      wants_human: { asserted: 2, matched: 2, accuracy: 1 },
    });
    expect(report.accuracy).toBe(1);
  });

  it("yields null everywhere on an empty set", async () => {
    const report = await testRecipe(replayJudge(), supportInbox, []);

    expect(report.fixtures).toEqual([]);
    expect(report.model).toBe("");
    expect(report.questions).toEqual({
      category: { asserted: 0, matched: 0, accuracy: null },
      wants_human: { asserted: 0, matched: 0, accuracy: null },
    });
    expect(report.accuracy).toBeNull();
  });
});

describe("scoreResults", () => {
  function resultWith(expected: FixtureResult["expect"]): FixtureResult {
    return {
      index: 1,
      id: "fixture:1",
      decision: referenceDecision,
      expect: expected,
      mismatches: compareAnswers(expected, referenceDecision.answers),
      review: referenceDecision.review,
    } satisfies FixtureResult;
  }

  it("folds with the minimum over the asserted Questions only", () => {
    const report = scoreResults(
      [
        resultWith({ category: "complaint", wants_human: true }),
        { ...resultWith({ category: "other" }), index: 2, id: "fixture:2" },
      ],
      supportInbox,
    );

    expect(report.questions).toEqual({
      category: { asserted: 2, matched: 1, accuracy: 0.5 },
      wants_human: { asserted: 1, matched: 1, accuracy: 1 },
    });
    expect(report.accuracy).toBe(0.5);
  });

  it("lists every Recipe Question in Recipe order, asserted or not", () => {
    const report = scoreResults([resultWith({ wants_human: true })], feedbackWidget);

    expect(Object.keys(report.questions)).toEqual(["team", "angry", "urgency"]);
    expect(report.accuracy).toBeNull();
  });

  it("takes the model from the first result", () => {
    expect(scoreResults([resultWith({ category: "complaint" })], supportInbox).model).toBe(
      referenceDecision.model,
    );
  });
});

// ─── The runner's edges ─────────────────────────────────────────────────────────────────

function countingClient(inner: SystemOneClient): SystemOneClient & { calls: number } {
  const client = {
    calls: 0,
    systemOne: async (request: Parameters<SystemOneClient["systemOne"]>[0], options?: object) => {
      client.calls += 1;

      return inner.systemOne(request, options);
    },
  };

  return client;
}

describe("testRecipe refuses bad Fixtures before judging", () => {
  it("throws a FixtureValidationError without ever calling the client", async () => {
    const client = countingClient({
      systemOne: (): Promise<SystemOneResult> => {
        throw new Error("the Judge must not be called");
      },
    });

    const judge = createJudge({ client, retry: "patient", now: clock });

    await expect(
      testRecipe(judge, supportInbox, [
        { state: "x", expect: { category: "spam" } },
        { state: "y", expect: { wants_human: true } },
      ]),
    ).rejects.toBeInstanceOf(FixtureValidationError);
    expect(client.calls).toBe(0);
  });
});

describe("testRecipe reports and aborts", () => {
  it("fires onResult in completion order, not input order", async () => {
    const replay = createReplayClient(recordings);

    const delays = new Map<unknown, number>([
      [stateOf("si-01"), 40],
      [stateOf("si-02"), 5],
      [stateOf("si-03"), 20],
    ]);

    const client: SystemOneClient = {
      systemOne: async (request, options) => {
        await new Promise((resolve) => setTimeout(resolve, delays.get(request.state) ?? 0));

        return replay.systemOne(request, options);
      },
    };

    const judge = createJudge({ client, retry: "patient", now: clock });

    const completed: string[] = [];

    const report = await testRecipe(
      judge,
      supportInbox,
      defineFixtures(supportInbox, [
        { state: stateOf("si-01"), expect: { category: "complaint" } },
        { state: stateOf("si-02"), expect: { category: "question" } },
        { state: stateOf("si-03"), expect: { category: "other" } },
      ]),
      { onResult: (result) => completed.push(result.id) },
    );

    expect(completed).toEqual(["fixture:2", "fixture:3", "fixture:1"]);
    expect(report.fixtures.map((result) => result.id)).toEqual([
      "fixture:1",
      "fixture:2",
      "fixture:3",
    ]);
    expect(report.accuracy).toBe(1);
  });

  it("aborts the run and rethrows on a JudgeError", async () => {
    const failure = Object.assign(new Error("over budget"), {
      name: "BadRequestError",
      status: 400,
      body: { detail: { error_type: "max_tokens_exceeded" } },
    });

    const client = countingClient({
      systemOne: () => Promise.reject(failure),
    });

    const judge = createJudge({ client, retry: "patient", now: clock, maxInFlight: 1 });

    const running = testRecipe(judge, supportInbox, workedFixtures);

    await expect(running).rejects.toMatchObject({
      name: "JudgeError",
      code: "jev_error",
      reason: "max_tokens_exceeded",
    });
    // The queued Fixtures never reach the client; a partial accuracy is worse than none.
    expect(client.calls).toBeLessThan(workedFixtures.length);
  });

  it("aborts the waiting and the in-flight calls on `signal`", async () => {
    const client = countingClient({
      systemOne: (_request, options) =>
        new Promise<SystemOneResult>((_resolve, reject) => {
          options?.signal?.addEventListener("abort", () => reject(options.signal?.reason), {
            once: true,
          });
        }),
    });

    const judge = createJudge({ client, retry: "patient", now: clock, maxInFlight: 1 });
    const controller = new AbortController();

    const running = testRecipe(judge, supportInbox, workedFixtures, {
      signal: controller.signal,
    });

    await Promise.resolve();
    controller.abort(new Error("stop"));

    await expect(running).rejects.toThrow("stop");
    expect(client.calls).toBe(1);
  });
});
