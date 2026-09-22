import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import type { ActionFetch } from "@siftline/actions";
import { run } from "@siftline/cli";
import type { RunDeps } from "@siftline/cli";
import { parseRecipe, serializeDecision } from "@siftline/core";
import type { JsonValue, SystemOneClient, SystemOneResult } from "@siftline/core";
import { createReplayClient, parseReplayLines } from "@siftline/core/testing";
import { describe, expect, it, onTestFinished, vi } from "vitest";

import { buildSlack, sendWebhook } from "./support-inbox/act";
import { recipe } from "./support-inbox/recipe";
import { route } from "./support-inbox/route";
import { judgeScripted } from "./support-inbox/scripted";
import { measure } from "./support-inbox/test";

const dir = new URL("support-inbox/", import.meta.url);

const path = (name: string) => fileURLToPath(new URL(name, dir));

const output = (name: string) => path(`output/${name}`);

const recorded = createReplayClient(
  parseReplayLines(
    readFileSync(
      new URL("../../../packages/core/fixtures/replay/support-inbox.jsonl", import.meta.url),
      "utf8",
    ),
  ),
);

// Keyed by the Record's `subject`, which a Record can carry as any JSON value or not at all.
const scripted = new Map<JsonValue | undefined, SystemOneResult["answers"]>([
  [
    "Charged twice",
    {
      category: {
        type: "choice",
        choice: "complaint",
        confidence: 1,
        probabilities: { complaint: 1, question: 0, other: 0 },
      },
      wants_human: { type: "noul", noul: 0.99 },
      urgency: {
        type: "score",
        score: 1.9,
        confidence: 0.9,
        probabilities: { 0: 0.01, 1: 0.09, 2: 0.9 },
      },
    },
  ],
  [
    "Export question",
    {
      category: {
        type: "choice",
        choice: "question",
        confidence: 1,
        probabilities: { complaint: 0, question: 1, other: 0 },
      },
      wants_human: { type: "noul", noul: 0.02 },
      urgency: {
        type: "score",
        score: 0.2,
        confidence: 0.85,
        probabilities: { 0: 0.85, 1: 0.1, 2: 0.05 },
      },
    },
  ],
  [
    "Re: invoice",
    {
      category: {
        type: "choice",
        choice: "question",
        confidence: 0.58,
        probabilities: { complaint: 0.27, question: 0.72, other: 0.01 },
      },
      wants_human: { type: "noul", noul: 0.25 },
      urgency: {
        type: "score",
        score: 1.1,
        confidence: 0.8,
        probabilities: { 0: 0.1, 1: 0.8, 2: 0.1 },
      },
    },
  ],
]);

const bySubject: SystemOneClient = {
  systemOne: async (request) => {
    const state = request.state;

    const subject = state instanceof Object && !Array.isArray(state) ? state["subject"] : undefined;

    const answers = scripted.get(subject);

    if (!answers) throw new Error(`no scripted answer for ${JSON.stringify(state)}`);

    return { model: "jev-1.13.0", answers, usage: { input_tokens: 400, output_tokens: 60 } };
  },
};

function cli(client: SystemOneClient) {
  const out: string[] = [];
  const err: string[] = [];

  const deps: RunDeps = {
    client,
    stdin: (async function* () {})(),
    stdout: { write: (chunk: string) => out.push(chunk) },
    stderr: { write: (chunk: string) => err.push(chunk) },
    env: { TYPESAFE_API_KEY: "test-key" },
  };

  return { deps, stdout: () => out.join(""), stderr: () => err.join("") };
}

// The CLI mints a Decision id and reads the clock; both are pinned so the snapshot is stable.
function pinned(lines: string): string {
  let n = 0;

  return lines
    .replace(/"id":"[0-9a-f-]{36}"/g, () => `"id":"0192f3c2-7b1e-7c4a-9f0e-00000000000${(n += 1)}"`)
    .replace(/"judgedAt":"[^"]+"/g, '"judgedAt":"2026-09-22T09:00:00.000Z"');
}

// The User-Agent names the published version, which a release bumps; the page shows the shape.
function requestJson(request: { headers: { [name: string]: string }; body: string }): string {
  const headers = { ...request.headers, "User-Agent": "siftline-actions/<version>" };

  // Trailing newline: the snapshot files are formatted by oxfmt like every other JSON here.
  return `${JSON.stringify({ ...request, headers, body: JSON.parse(request.body) }, null, 2)}\n`;
}

describe("the guide's running example", () => {
  it("is the same Recipe in JSON and in TypeScript", () => {
    expect(parseRecipe(readFileSync(path("recipe-v2.json"), "utf8"))).toEqual(recipe);
  });

  it("siftline test", async () => {
    const terminal = cli(recorded);
    const code = await run(["test", path("recipe.json"), path("fixtures.jsonl")], terminal.deps);
    expect(code).toBe(0);
    await expect(terminal.stdout()).toMatchFileSnapshot(output("siftline-test.txt"));
  });

  it("siftline label", async () => {
    const terminal = cli(recorded);
    const code = await run(["label", path("recipe.json"), path("records.jsonl")], terminal.deps);
    expect(code).toBe(0);
    await expect(pinned(terminal.stdout())).toMatchFileSnapshot(output("siftline-label.jsonl"));
  });

  it("siftline label --rules", async () => {
    const terminal = cli(bySubject);

    const code = await run(
      ["label", path("recipe-v2.json"), path("records.jsonl"), "--rules", path("rules.json")],
      terminal.deps,
    );

    expect(code).toBe(0);
    await expect(pinned(terminal.stdout())).toMatchFileSnapshot(
      output("siftline-label-routed.jsonl"),
    );
  });

  it("judges, routes and builds both Actions from code", async () => {
    const decision = await judgeScripted();
    await expect(serializeDecision(decision)).toMatchFileSnapshot(output("decision.jsonl"));

    const routed = route(decision);
    await expect(serializeDecision(routed)).toMatchFileSnapshot(output("routed-decision.jsonl"));
    expect(routed.action).toBe("slack_incoming_webhook");

    const slack = await buildSlack(routed, recipe);
    await expect(requestJson(slack)).toMatchFileSnapshot(output("slack-request.json"));

    const fetchImpl = vi.fn<ActionFetch>(async () => new Response("ok", { status: 200 }));

    vi.stubGlobal("fetch", fetchImpl);
    onTestFinished(() => {
      vi.unstubAllGlobals();
    });

    const { request, response } = await sendWebhook({ ...routed, action: "webhook" }, recipe);

    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(response).toEqual({ status: 200, body: "ok", truncated: false });
    await expect(requestJson(request)).toMatchFileSnapshot(output("webhook-request.json"));
  });

  it("measures from code", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const report = await measure(bySubject);
    expect(report.accuracy).toBe(1);
    await expect(log.mock.calls.map((call) => call.join(" ")).join("\n")).toMatchFileSnapshot(
      output("measure.txt"),
    );
    log.mockRestore();
  });
});
