import { run } from "@siftline/cli";
import { parseDecision } from "@siftline/core";
import type { Decision, Record, Rule, SystemOneClient, SystemOneRequest } from "@siftline/core";
import { createReplayClient, createScriptedClient } from "@siftline/core/testing";
import type { ReplayLine } from "@siftline/core/testing";
import { describe, expect, it } from "vitest";

import type { Harness } from "./harness";
import { harness, recordedError, recordings, RECIPE_PATH, stateOf, textFile } from "./harness";

const replay = createReplayClient(recordings);

const RECORDS: Record[] = ["si-01", "si-02", "si-03", "si-04", "si-05", "si-06"].map(
  (recorded, offset) => ({ id: `r${offset + 1}`, state: stateOf(recorded) }),
);

const IN_ORDER = RECORDS.map((record) => record.id);

function jsonl(records: readonly Record[]): string {
  return records.map((record) => JSON.stringify(record)).join("\n");
}

function recordsFile(records: readonly Record[]): string {
  return textFile(jsonl(records), "records.jsonl");
}

function decisions(stdout: string): Decision[] {
  return stdout.trimEnd() === "" ? [] : stdout.trimEnd().split("\n").map(parseDecision);
}

function labelled(stdout: string): string[] {
  return decisions(stdout).map((decision) => decision.recordId);
}

function indexOf(request: SystemOneRequest): number {
  const state = JSON.stringify(request.state);

  return RECORDS.findIndex((record) => JSON.stringify(record.state) === state);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

// ─── Input order over an out-of-order corpus ────────────────────────────────────────────

/** Answers last Record first, so anything that writes in completion order is caught. */
function reversing(completed: string[]): SystemOneClient {
  return {
    systemOne: async (request, options) => {
      const index = indexOf(request);
      await delay((RECORDS.length - index) * 20);
      completed.push(`r${index + 1}`);

      return await replay.systemOne(request, options);
    },
  };
}

describe("output order", () => {
  it("writes one Decision line per Record in input order", async () => {
    const completed: string[] = [];
    const { deps, stdout } = harness(reversing(completed));

    await expect(
      run(["label", RECIPE_PATH, recordsFile(RECORDS), "--max-in-flight", "6", "--quiet"], deps),
    ).resolves.toBe(0);

    expect(completed).toEqual(IN_ORDER.toReversed());
    expect(labelled(stdout())).toEqual(IN_ORDER);
  });

  it("holds input order through a gate narrower than the input", async () => {
    const completed: string[] = [];
    const { deps, stdout } = harness(reversing(completed));

    await expect(
      run(["label", RECIPE_PATH, recordsFile(RECORDS), "--max-in-flight", "2", "--quiet"], deps),
    ).resolves.toBe(0);

    expect(completed).not.toEqual(IN_ORDER);
    expect(labelled(stdout())).toEqual(IN_ORDER);
  });
});

// ─── Reading the Records ────────────────────────────────────────────────────────────────

async function* chunked(text: string, at: number): AsyncGenerator<Uint8Array> {
  const bytes = new TextEncoder().encode(text);
  yield bytes.subarray(0, at);
  yield bytes.subarray(at);
}

function piping(sample: Harness, text: string, at: number): Harness {
  return { ...sample, deps: { ...sample.deps, stdin: chunked(text, at) } };
}

describe("the input", () => {
  it("reads stdin for the sentinel `-`, across chunk boundaries", async () => {
    const text = jsonl(RECORDS);
    const { deps, stdout } = piping(harness(replay), text, Math.floor(text.length / 2));

    await expect(run(["label", RECIPE_PATH, "-", "--quiet"], deps)).resolves.toBe(0);
    expect(labelled(stdout())).toEqual(IN_ORDER);
  });

  it("reads stdin with no second positional at all", async () => {
    const { deps, stdout } = piping(harness(replay), jsonl(RECORDS.slice(0, 2)), 1);

    await expect(run(["label", RECIPE_PATH, "--quiet"], deps)).resolves.toBe(0);
    expect(labelled(stdout())).toEqual(["r1", "r2"]);
  });

  it("carries `trimmed` to the Decision untouched", async () => {
    const { deps, stdout } = harness(replay);

    const path = recordsFile([
      { id: "r1", state: stateOf("si-01"), trimmed: true },
      { id: "r2", state: stateOf("si-02") },
    ]);

    await expect(run(["label", RECIPE_PATH, path, "--quiet"], deps)).resolves.toBe(0);
    expect(decisions(stdout()).map((decision) => decision.trimmed)).toEqual([true, false]);
  });

  it("labels nothing and exits 0 on empty input", async () => {
    const { deps, stdout, stderr } = harness(replay);

    await expect(run(["label", RECIPE_PATH, textFile("", "records.jsonl")], deps)).resolves.toBe(0);
    expect(stdout()).toBe("");
    expect(stderr()).toBe("");
  });
});

describe("a bad Record line", () => {
  const bad: { [what: string]: string } = {
    "is not JSON": "{",
    "is not an object": '"just prose"',
    "has no id": '{"state":"hi"}',
    "has an empty id": '{"id":"","state":"hi"}',
    "has no state": '{"id":"r2"}',
    "has a number for state": '{"id":"r2","state":7}',
    "has a string for trimmed": '{"id":"r2","state":"hi","trimmed":"yes"}',
    "carries an unknown key": '{"id":"r2","state":"hi","text":"hello"}',
  };

  it.each(Object.entries(bad))("exits 2 naming line 2 when it %s", async (_what, line) => {
    const client = createScriptedClient([]);
    const { deps, stdout, stderr } = harness(client);
    const path = textFile(`${JSON.stringify(RECORDS[0])}\n${line}\n`, "records.jsonl");

    await expect(run(["label", RECIPE_PATH, path], deps)).resolves.toBe(2);
    expect(stderr()).toContain("line 2 is not a valid Record");
    expect(stdout()).toBe("");
    expect(client.calls).toEqual([]);
  });

  it("names stdin rather than a path when the line came from the pipe", async () => {
    const client = createScriptedClient([]);
    const { deps, stderr } = piping(harness(client), '{"id":"r1"}', 4);

    await expect(run(["label", RECIPE_PATH, "-"], deps)).resolves.toBe(2);
    expect(stderr()).toContain("stdin line 1 is not a valid Record");
    expect(client.calls).toEqual([]);
  });
});

// ─── Rules ──────────────────────────────────────────────────────────────────────────────

const ESCALATE: Rule[] = [
  {
    id: "escalate",
    condition: { question: "category", comparator: "is", value: "complaint" },
    action: "slack",
  },
  {
    id: "answer",
    condition: { question: "category", comparator: "is", value: "question" },
    action: "reply",
  },
];

function rulesFile(rules: unknown): string {
  return textFile(JSON.stringify(rules), "rules.json");
}

describe("--rules", () => {
  it("routes each Decision, leaving an unsure one unrouted", async () => {
    const { deps, stdout } = harness(replay);

    await expect(
      run(
        ["label", RECIPE_PATH, recordsFile(RECORDS), "--rules", rulesFile(ESCALATE), "--quiet"],
        deps,
      ),
    ).resolves.toBe(0);

    expect(decisions(stdout()).map((decision) => [decision.rule, decision.action])).toEqual([
      ["escalate", "slack"],
      ["answer", "reply"],
      [null, null],
      [null, null],
      [null, null],
      [null, null],
    ]);
  });

  it("leaves rule and action null without it", async () => {
    const { deps, stdout } = harness(replay);

    await expect(
      run(["label", RECIPE_PATH, recordsFile(RECORDS.slice(0, 1)), "--quiet"], deps),
    ).resolves.toBe(0);

    const [decision] = decisions(stdout());
    expect(decision?.rule).toBeNull();
    expect(decision?.action).toBeNull();
  });

  it.each([
    ["a Rule that is not a JSON array", { id: "escalate" }],
    ["a malformed Rule", [{ id: "escalate", condition: { question: "category" } }]],
  ])("exits 2 on %s, before any request", async (_what, rules) => {
    const client = createScriptedClient([]);
    const { deps, stderr } = harness(client);

    await expect(
      run(
        ["label", RECIPE_PATH, recordsFile(RECORDS), "--rules", rulesFile(rules), "--quiet"],
        deps,
      ),
    ).resolves.toBe(2);
    expect(stderr()).toContain("does not hold valid Rules");
    expect(client.calls).toEqual([]);
  });

  it("exits 2 when validateRules refuses a stale Rule", async () => {
    const client = createScriptedClient([]);
    const { deps, stderr } = harness(client);

    const stale = rulesFile([
      {
        id: "stale",
        condition: { question: "urgency", comparator: "is", value: "high" },
        action: null,
      },
    ]);

    await expect(
      run(["label", RECIPE_PATH, recordsFile(RECORDS), "--rules", stale, "--quiet"], deps),
    ).resolves.toBe(2);
    expect(stderr()).toContain('rule stale: unknown question "urgency"');
    expect(client.calls).toEqual([]);
  });
});

// ─── Failures ───────────────────────────────────────────────────────────────────────────

function failing(recorded: string, error: unknown): SystemOneClient {
  const state = JSON.stringify(stateOf(recorded));

  return {
    systemOne: async (request, options) => {
      if (JSON.stringify(request.state) === state) throw error;

      return await replay.systemOne(request, options);
    },
  };
}

describe("a Record the Judge refuses", () => {
  it("names it on stderr, skips it, keeps going and exits 1", async () => {
    const client = failing("si-03", recordedError("probe/over-budget"));
    const { deps, stdout, stderr } = harness(client);

    await expect(
      run(["label", RECIPE_PATH, recordsFile(RECORDS), "--max-in-flight", "6", "--quiet"], deps),
    ).resolves.toBe(1);

    expect(stderr()).toBe("r3: state over the token budget\n");
    expect(labelled(stdout())).toEqual(["r1", "r2", "r4", "r5", "r6"]);
  });

  it("reports the reason for a failure that is not a token budget", async () => {
    const client = failing("si-02", recordedError("probe/unknown-model"));
    const { deps, stderr } = harness(client);

    await expect(
      run(["label", RECIPE_PATH, recordsFile(RECORDS.slice(0, 2)), "--quiet"], deps),
    ).resolves.toBe(1);
    expect(stderr()).toBe("r2: the API refused the request\n");
  });

  it("aborts the whole run on an exhausted Judge, exit 1", async () => {
    const exhausted = Object.assign(new Error("429 slow down"), {
      status: 429,
      retryAfterMs: 1000,
    });

    const { deps, stderr } = harness(failing("si-01", exhausted));

    await expect(
      run(["label", RECIPE_PATH, recordsFile(RECORDS), "--max-in-flight", "6", "--quiet"], deps),
    ).resolves.toBe(1);
    expect(stderr()).toContain("siftline: 429 slow down");
  });
});

describe("SIGINT", () => {
  it("aborts waiting and in-flight calls and exits 130", async () => {
    const controller = new AbortController();

    const sample = harness({
      systemOne: async (_request, options) => {
        controller.abort();
        options?.signal?.throwIfAborted();
        throw new Error("the call outlived the abort");
      },
    });

    const deps = { ...sample.deps, signal: controller.signal };

    await expect(
      run(["label", RECIPE_PATH, recordsFile(RECORDS), "--max-in-flight", "2"], deps),
    ).resolves.toBe(130);
    expect(sample.stdout()).toBe("");
    expect(sample.stderr()).toContain("siftline: interrupted");
  });
});

// ─── Progress and drift ─────────────────────────────────────────────────────────────────

const MANY: Record[] = Array.from({ length: 120 }, (_unused, offset) => ({
  id: `r${offset + 1}`,
  state: stateOf("si-01"),
}));

function onATty(sample: Harness): Harness {
  return {
    ...sample,
    deps: { ...sample.deps, stderr: { ...sample.deps.stderr, isTTY: true } },
  };
}

describe("progress on stderr", () => {
  it("rewrites the counter in place on a TTY", async () => {
    const { deps, stderr } = onATty(harness(replay));

    await run(["label", RECIPE_PATH, recordsFile(RECORDS), "--max-in-flight", "1"], deps);

    expect(stderr()).toBe("\r1/6\r2/6\r3/6\r4/6\r5/6\r6/6\n");
  });

  it("writes one line per 50 when stderr is not a TTY", async () => {
    const { deps, stderr } = harness(replay);

    await run(["label", RECIPE_PATH, recordsFile(MANY), "--max-in-flight", "1"], deps);

    expect(stderr()).toBe("50/120\n100/120\n");
  });

  it("is silenced by --quiet, which leaves stdout alone", async () => {
    const { deps, stdout, stderr } = onATty(harness(replay));

    await expect(run(["label", RECIPE_PATH, recordsFile(RECORDS), "--quiet"], deps)).resolves.toBe(
      0,
    );
    expect(stderr()).toBe("");
    expect(labelled(stdout())).toEqual(IN_ORDER);
  });
});

const drifted: ReplayLine[] = recordings.map((line) =>
  "response" in line ? { ...line, response: { ...line.response, model: "jev-1.14.0" } } : line,
);

describe("the drift warning", () => {
  it("names both model ids once per run, --quiet or not", async () => {
    const { deps, stderr } = harness(createReplayClient(drifted));

    await run(["label", RECIPE_PATH, recordsFile(RECORDS), "--quiet"], deps);

    expect(stderr()).toBe(
      "siftline: model drift: the Recipe asks for jev-1.13.0, the Decisions came back from jev-1.14.0\n",
    );
  });
});

// ─── Options ────────────────────────────────────────────────────────────────────────────

describe("option handling", () => {
  it("needs a recipe", async () => {
    const { deps, stderr } = harness(replay);

    await expect(run(["label"], deps)).resolves.toBe(2);
    expect(stderr()).toContain("siftline: label needs a recipe");
  });

  it("takes at most two positionals", async () => {
    const { deps, stderr } = harness(replay);

    await expect(run(["label", RECIPE_PATH, recordsFile(RECORDS), "extra"], deps)).resolves.toBe(2);
    expect(stderr()).toContain("label takes at most two positionals");
  });

  it.each([
    ["--json", "Unknown option '--json'"],
    ["--min-accuracy=0.9", "Unknown option '--min-accuracy'"],
  ])("refuses %s", async (flag, message) => {
    const { deps, stderr } = harness(replay);

    await expect(run(["label", RECIPE_PATH, recordsFile(RECORDS), flag], deps)).resolves.toBe(2);
    expect(stderr()).toContain(`siftline: ${message}`);
  });

  it("exits 2 naming an unreadable Records file", async () => {
    const { deps, stderr } = harness(replay);

    await expect(run(["label", RECIPE_PATH, "/no/such/records.jsonl"], deps)).resolves.toBe(2);
    expect(stderr()).toContain("cannot read the records /no/such/records.jsonl");
  });
});
