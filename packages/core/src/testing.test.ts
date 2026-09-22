import { readFileSync } from "node:fs";

import { parseRecipe } from "@siftline/core";
import type { SystemOneRequest, SystemOneResult } from "@siftline/core";
import {
  createRecordingClient,
  createReplayClient,
  createScriptedClient,
  parseReplayLines,
  replayLineSchema,
} from "@siftline/core/testing";
import type { ReplayLine } from "@siftline/core/testing";
import { describe, expect, it } from "vitest";

// Imported by package name, not by relative path: this asserts the published `exports` map.

const recipeNames = ["support-inbox", "feedback-widget", "doc-pair-check"] as const;

const corpusNames = [...recipeNames, "probes"] as const;

function read(path: string): string {
  return readFileSync(new URL(`../fixtures/${path}`, import.meta.url), "utf8");
}

const corpus: Record<string, ReplayLine[]> = Object.fromEntries(
  corpusNames.map((name) => [name, parseReplayLines(read(`replay/${name}.jsonl`))]),
);

function line(name: string, index = 0): ReplayLine {
  const found = corpus[name]?.[index];

  if (!found) throw new Error(`no recorded line ${name}:${index}`);

  return found;
}

const pairs = recipeNames.flatMap((name) => corpus[name] ?? []);

const probes = corpus["probes"] ?? [];

function result(model = "jev-1.13.0"): SystemOneResult {
  return {
    model,
    answers: { angry: { type: "noul", noul: 0.9 } },
    usage: { input_tokens: 1, output_tokens: 2 },
  };
}

const request: SystemOneRequest = {
  state: "hello",
  questions: { angry: { type: "noul", instructions: "Angry?" } },
  model: "jev-1.13.0",
};

function clock(): () => Date {
  let tick = 0;

  return () => new Date(Date.UTC(2026, 8, 21) + tick++ * 100);
}

describe("the recorded corpus", () => {
  it("holds 17 answered pairs and 3 probes", () => {
    expect(pairs).toHaveLength(17);
    expect(probes).toHaveLength(3);
    expect(pairs.every((entry) => "response" in entry)).toBe(true);
    expect(probes.filter((entry) => "error" in entry)).toHaveLength(2);
  });

  it.each(corpusNames)("parses every %s line through the schema", (name) => {
    for (const raw of read(`replay/${name}.jsonl`).split("\n")) {
      if (raw === "") continue;
      expect(replayLineSchema.safeParse(JSON.parse(raw)).success).toBe(true);
    }
  });

  it.each(recipeNames)("asks %s's questions verbatim", (name) => {
    const recipe = parseRecipe(read(`recipes/${name}.json`));

    for (const entry of corpus[name] ?? []) {
      expect(entry.request.questions).toEqual(recipe.questions);
      expect(entry.request.model).toBe(recipe.model);
    }
  });

  it("carries the fields the spec's error line omits", () => {
    const probe = line("probes");
    expect("error" in probe ? probe.error : null).toMatchObject({
      name: "BadRequestError",
      message: "400 Unknown model: jev-0.0.0",
      status: 400,
      retryAfterMs: null,
      requestId: expect.stringMatching(/^req_/),
      body: { detail: { error_type: "api_usage_error" } },
    });
  });
});

describe("parseReplayLines", () => {
  it("skips blank lines", () => {
    expect(parseReplayLines(`\n${read("replay/probes.jsonl")}\n\n`)).toHaveLength(3);
  });

  it("names the 1-based line that failed", () => {
    const [first = ""] = read("replay/probes.jsonl").split("\n");
    expect(() => parseReplayLines(`${first}\n{}`)).toThrow(/replay line 2/);
  });

  it("names the line that is not JSON", () => {
    expect(() => parseReplayLines("not json")).toThrow(/replay line 1 is not JSON/);
  });
});

describe("replayLineSchema", () => {
  it("rejects an unknown key", () => {
    expect(replayLineSchema.safeParse({ ...line("support-inbox"), extra: 1 }).success).toBe(false);
  });

  it("rejects a line carrying both a response and an error", () => {
    const both = {
      ...line("support-inbox"),
      error: { name: "E", message: "", status: 400, retryAfterMs: null },
    };

    expect(replayLineSchema.safeParse(both).success).toBe(false);
  });

  it("rejects format 2", () => {
    expect(replayLineSchema.safeParse({ ...line("support-inbox"), format: 2 }).success).toBe(false);
  });

  it("accepts a line without a requestId", () => {
    const { requestId: _absent, ...rest } = line("support-inbox");
    expect(replayLineSchema.safeParse(rest).success).toBe(true);
  });
});

describe("createScriptedClient", () => {
  it("consumes the script in call order and records the requests", async () => {
    const client = createScriptedClient([{ response: result("one") }, { response: result("two") }]);
    await expect(client.systemOne(request)).resolves.toMatchObject({ model: "one" });
    await expect(client.systemOne({ ...request, model: "other" })).resolves.toMatchObject({
      model: "two",
    });
    expect(client.calls.map((call) => call.model)).toEqual(["jev-1.13.0", "other"]);
  });

  it("throws when the script runs out", async () => {
    const client = createScriptedClient([{ response: result() }]);
    await client.systemOne(request);
    await expect(client.systemOne(request)).rejects.toThrow(/exhausted after 1 calls/);
    expect(client.calls).toHaveLength(2);
  });

  it("throws the scripted error untouched", async () => {
    const boom = Object.assign(new Error("429"), { status: 429 });
    const client = createScriptedClient([{ error: boom }]);
    await expect(client.systemOne(request)).rejects.toBe(boom);
  });
});

describe("createReplayClient", () => {
  it("answers the deep-equal request whatever the key order", async () => {
    const recorded = line("support-inbox");

    if (!("response" in recorded)) throw new Error("expected a response line");
    const client = createReplayClient(corpus["support-inbox"] ?? []);

    const reordered: SystemOneRequest = {
      model: recorded.request.model,
      questions: recorded.request.questions,
      state: recorded.request.state,
    };

    await expect(client.systemOne(reordered)).resolves.toEqual(recorded.response);
  });

  it("throws when nothing matches", async () => {
    const client = createReplayClient(corpus["support-inbox"] ?? []);
    await expect(client.systemOne(request)).rejects.toThrow(/no replay line matches/);
  });

  it("rethrows an error line as the recorded error", async () => {
    const probe = line("probes");

    if (!("error" in probe)) throw new Error("expected an error line");
    const client = createReplayClient(probes);
    const thrown: unknown = await client.systemOne(probe.request).catch((cause: unknown) => cause);
    expect(thrown).toBeInstanceOf(Error);
    expect(thrown).toMatchObject({
      name: probe.error.name,
      message: probe.error.message,
      status: probe.error.status,
      retryAfterMs: probe.error.retryAfterMs,
      body: probe.error.body,
    });
  });

  it("replays the over-budget probe by its placeholder state", async () => {
    const probe = line("probes", 2);
    const client = createReplayClient(probes);
    await expect(client.systemOne(probe.request)).rejects.toMatchObject({
      status: 400,
      body: { detail: { error_type: "max_tokens_exceeded" } },
    });
  });
});

describe("createRecordingClient", () => {
  it("writes one replayable line per answered call", async () => {
    const lines: ReplayLine[] = [];

    const client = createRecordingClient(
      createScriptedClient([{ response: result() }]),
      (recorded) => lines.push(recorded),
      { now: clock(), id: (_call, index) => `probe/${index}` },
    );

    await expect(client.systemOne(request)).resolves.toMatchObject({ model: "jev-1.13.0" });
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      format: 1,
      id: "probe/1",
      recordedAt: "2026-09-21T00:00:00.000Z",
      durationMs: 100,
      request,
    });
    expect(replayLineSchema.safeParse(lines[0]).success).toBe(true);
  });

  it("records the error and rethrows it", async () => {
    const lines: ReplayLine[] = [];

    const boom = Object.assign(new Error("429 slow down"), {
      name: "RateLimitError",
      status: 429,
      retryAfterMs: 1200,
      requestId: "req_01",
      body: { detail: { error_type: "rate_limit" } },
    });

    const client = createRecordingClient(
      createScriptedClient([{ error: boom }]),
      (recorded) => lines.push(recorded),
      { now: clock() },
    );

    await expect(client.systemOne(request)).rejects.toBe(boom);
    const recorded = lines[0];
    expect(recorded && "error" in recorded ? recorded.error : null).toEqual({
      name: "RateLimitError",
      message: "429 slow down",
      status: 429,
      retryAfterMs: 1200,
      requestId: "req_01",
      body: { detail: { error_type: "rate_limit" } },
    });
    expect(replayLineSchema.safeParse(recorded).success).toBe(true);
  });

  it("records a status-less failure with nulls", async () => {
    const lines: ReplayLine[] = [];

    const client = createRecordingClient(
      createScriptedClient([{ error: new TypeError("fetch failed") }]),
      (recorded) => lines.push(recorded),
      { now: clock(), id: () => "net" },
    );

    await expect(client.systemOne(request)).rejects.toThrow("fetch failed");
    const recorded = lines[0];
    expect(recorded && "error" in recorded ? recorded.error : null).toMatchObject({
      name: "TypeError",
      status: null,
      retryAfterMs: null,
      requestId: undefined,
    });
    expect(replayLineSchema.safeParse(recorded).success).toBe(true);
  });
});
