import { run } from "@siftline/cli";
import type { TestReport } from "@siftline/core";
import { createReplayClient, createScriptedClient } from "@siftline/core/testing";
import type { ReplayLine } from "@siftline/core/testing";
import { describe, expect, it } from "vitest";

import {
  fixturesFile,
  harness,
  recordings,
  RECIPE_PATH,
  stateOf,
  textFile,
  WORKED_FIXTURES,
} from "./harness";

const replay = createReplayClient(recordings);

function worked(): string {
  return fixturesFile(WORKED_FIXTURES);
}

// ─── The worked example ─────────────────────────────────────────────────────────────────

// The spec's report over Recipe example 1: five Fixtures, one miss, one unsure Decision.
const WORKED_REPORT = `support-inbox v1 · jev-1.13.0

category      4/5   0.80
wants_human   5/5   1.00

accuracy      0.80  (lowest question)
unsure        1 of 5 would go to Review

fixture:4  category: expected complaint, got question
`;

describe("the human report", () => {
  it("matches the spec's worked example byte for byte", async () => {
    const { deps, stdout } = harness(replay);

    await expect(run(["test", RECIPE_PATH, worked()], deps)).resolves.toBe(0);
    expect(stdout()).toBe(WORKED_REPORT);
  });

  it("reads n/a for a Question nothing asserted", async () => {
    const { deps, stdout } = harness(replay);
    const path = fixturesFile([
      { state: stateOf("si-01"), expect: { category: "complaint" } },
      { state: stateOf("si-02"), expect: { category: "question" } },
    ]);

    await expect(run(["test", RECIPE_PATH, path], deps)).resolves.toBe(0);
    expect(stdout()).toBe(
      `support-inbox v1 · jev-1.13.0

category      2/2   1.00
wants_human   n/a   n/a

accuracy      1.00  (lowest question)
unsure        0 of 2 would go to Review
`,
    );
  });

  it("reads n/a throughout with no Fixtures, and exits 0", async () => {
    const { deps, stdout } = harness(replay);

    await expect(run(["test", RECIPE_PATH, textFile("", "empty.jsonl")], deps)).resolves.toBe(0);
    expect(stdout()).toBe(
      `support-inbox v1 · n/a

category      n/a   n/a
wants_human   n/a   n/a

accuracy      n/a   (lowest question)
unsure        0 of 0 would go to Review
`,
    );
  });
});

// ─── Progress ───────────────────────────────────────────────────────────────────────────

describe("progress on stderr", () => {
  it("writes one line per result, with a miss naming both answers", async () => {
    const { deps, stderr } = harness(replay);

    await run(["test", RECIPE_PATH, worked()], deps);

    const lines = stderr().trimEnd().split("\n").toSorted();
    expect(lines).toEqual([
      "miss fixture:4 category: expected complaint, got question",
      "ok fixture:1",
      "ok fixture:2",
      "ok fixture:3",
      "ok fixture:5",
    ]);
  });

  it("is silenced by --quiet, which leaves stdout alone", async () => {
    const { deps, stdout, stderr } = harness(replay);

    await expect(run(["test", RECIPE_PATH, worked(), "--quiet"], deps)).resolves.toBe(0);
    expect(stderr()).toBe("");
    expect(stdout()).toBe(WORKED_REPORT);
  });
});

// ─── Drift ──────────────────────────────────────────────────────────────────────────────

const drifted: ReplayLine[] = recordings.map((line) =>
  "response" in line ? { ...line, response: { ...line.response, model: "jev-1.14.0" } } : line,
);

describe("the drift warning", () => {
  it("names both model ids once per run", async () => {
    const { deps, stderr } = harness(createReplayClient(drifted));

    await run(["test", RECIPE_PATH, worked(), "--quiet"], deps);

    expect(stderr()).toBe(
      "siftline: model drift: the Recipe asks for jev-1.13.0, the Decisions came back from jev-1.14.0\n",
    );
  });

  it("survives --quiet, which silences progress only", async () => {
    const { deps, stderr } = harness(createReplayClient(drifted));

    await run(["test", RECIPE_PATH, worked()], deps);

    expect(
      stderr()
        .split("\n")
        .filter((line) => line.includes("drift")),
    ).toHaveLength(1);
  });

  it("stays out of a run whose model matches", async () => {
    const { deps, stderr } = harness(replay);

    await run(["test", RECIPE_PATH, worked(), "--quiet"], deps);

    expect(stderr()).toBe("");
  });
});

// ─── --json ─────────────────────────────────────────────────────────────────────────────

describe("--json", () => {
  it("prints the TestReport with a top-level drift and nothing else", async () => {
    const { deps, stdout } = harness(replay);

    await expect(run(["test", RECIPE_PATH, worked(), "--json", "--quiet"], deps)).resolves.toBe(0);

    const payload: TestReport & { drift: string | null } = JSON.parse(stdout());
    expect(payload.recipe).toEqual({ name: "support-inbox", version: 1 });
    expect(payload.model).toBe("jev-1.13.0");
    expect(payload.questions).toEqual({
      category: { asserted: 5, matched: 4, accuracy: 0.8 },
      wants_human: { asserted: 5, matched: 5, accuracy: 1 },
    });
    expect(payload.accuracy).toBe(0.8);
    expect(payload.fixtures).toHaveLength(5);
    expect(payload.drift).toBeNull();
    expect(Object.keys(payload).toSorted()).toEqual([
      "accuracy",
      "drift",
      "fixtures",
      "model",
      "questions",
      "recipe",
    ]);
  });

  it("carries the drift sentence when the model moved", async () => {
    const { deps, stdout } = harness(createReplayClient(drifted));

    await run(["test", RECIPE_PATH, worked(), "--json", "--quiet"], deps);

    const payload: { drift: string | null } = JSON.parse(stdout());
    expect(payload.drift).toContain("jev-1.13.0");
    expect(payload.drift).toContain("jev-1.14.0");
  });
});

// ─── --min-accuracy ─────────────────────────────────────────────────────────────────────

describe("--min-accuracy", () => {
  it("exits 0 when the lowest question accuracy meets it", async () => {
    const { deps } = harness(replay);

    await expect(
      run(["test", RECIPE_PATH, worked(), "--min-accuracy", "0.8", "--quiet"], deps),
    ).resolves.toBe(0);
  });

  it("exits 1 with a stderr line when it is below", async () => {
    const { deps, stdout, stderr } = harness(replay);

    await expect(
      run(["test", RECIPE_PATH, worked(), "--min-accuracy", "0.9", "--quiet"], deps),
    ).resolves.toBe(1);
    expect(stderr()).toBe("siftline: accuracy 0.80 is below --min-accuracy 0.9\n");
    expect(stdout()).toBe(WORKED_REPORT);
  });

  it("counts a null accuracy as below, and says so", async () => {
    const { deps, stderr } = harness(replay);

    await expect(
      run(["test", RECIPE_PATH, textFile("", "empty.jsonl"), "--min-accuracy", "0.5"], deps),
    ).resolves.toBe(1);
    expect(stderr()).toContain("no Question was asserted");
  });

  it("is not silenced by --quiet", async () => {
    const { deps, stderr } = harness(replay);

    await run(["test", RECIPE_PATH, worked(), "--min-accuracy", "1", "--quiet"], deps);

    expect(stderr()).toContain("is below --min-accuracy");
  });
});

// ─── Options and inputs ─────────────────────────────────────────────────────────────────

describe("option handling", () => {
  it("takes an integer of 1 or more for --max-in-flight", async () => {
    const { deps } = harness(replay);

    await expect(
      run(["test", RECIPE_PATH, worked(), "--max-in-flight", "1", "--quiet"], deps),
    ).resolves.toBe(0);
  });

  // `=` rather than a space: `parseArgs` refuses a bare `-1` as an ambiguous option value.
  it.each(["0", "-1", "2.5", "eight", ""])("refuses --max-in-flight %o", async (value) => {
    const { deps, stderr } = harness(replay);

    await expect(
      run(["test", RECIPE_PATH, worked(), `--max-in-flight=${value}`], deps),
    ).resolves.toBe(2);
    expect(stderr()).toContain("--max-in-flight takes an integer of 1 or more");
  });

  it.each(["-0.1", "1.5", "high"])("refuses --min-accuracy %o", async (value) => {
    const { deps, stderr } = harness(replay);

    await expect(
      run(["test", RECIPE_PATH, worked(), `--min-accuracy=${value}`], deps),
    ).resolves.toBe(2);
    expect(stderr()).toContain("--min-accuracy takes a ratio from 0 to 1");
  });

  it("refuses --rules", async () => {
    const { deps, stderr } = harness(replay);

    await expect(run(["test", RECIPE_PATH, worked(), "--rules", "rules.json"], deps)).resolves.toBe(
      2,
    );
    expect(stderr()).toContain("siftline: Unknown option '--rules'");
  });

  it("refuses an unknown option", async () => {
    const { deps, stderr } = harness(replay);

    await expect(run(["test", RECIPE_PATH, worked(), "--trim"], deps)).resolves.toBe(2);
    expect(stderr()).toContain("Unknown option '--trim'");
  });

  it("needs both positionals, and no more", async () => {
    const one = harness(replay);
    await expect(run(["test", RECIPE_PATH], one.deps)).resolves.toBe(2);
    expect(one.stderr()).toContain("test needs a recipe and a fixtures file");

    const three = harness(replay);
    await expect(run(["test", RECIPE_PATH, worked(), "extra"], three.deps)).resolves.toBe(2);
    expect(three.stderr()).toContain("test takes two positionals");
  });
});

describe("input errors", () => {
  it("exits 2 naming an unreadable file", async () => {
    const { deps, stderr } = harness(replay);

    await expect(run(["test", "/no/such/recipe.json", worked()], deps)).resolves.toBe(2);
    expect(stderr()).toContain("cannot read the recipe /no/such/recipe.json");
  });

  it("exits 2 naming what is wrong with the Recipe", async () => {
    const { deps, stderr } = harness(replay);
    const path = textFile(JSON.stringify({ format: 1, name: "x" }), "recipe.json");

    await expect(run(["test", path, worked()], deps)).resolves.toBe(2);
    expect(stderr()).toContain("is not a valid Recipe");
  });

  it("exits 2 naming the bad Fixture line", async () => {
    const { deps, stderr } = harness(replay);
    const path = textFile('{"state":"hi"}', "fixtures.jsonl");

    await expect(run(["test", RECIPE_PATH, path], deps)).resolves.toBe(2);
    expect(stderr()).toContain("fixture line 1");
  });

  it("exits 2 when a Fixture no longer fits the Recipe", async () => {
    const { deps, stderr } = harness(replay);
    const path = textFile('{"state":"hi","expect":{"nope":true}}', "fixtures.jsonl");

    await expect(run(["test", RECIPE_PATH, path], deps)).resolves.toBe(2);
    expect(stderr()).toContain('unknown question "nope"');
  });
});

describe("a failing run", () => {
  it("exits 1 when the Judge gives up", async () => {
    const client = createScriptedClient([{ error: new Error("the wheels came off") }]);
    const { deps, stdout, stderr } = harness(client);

    await expect(
      run(["test", RECIPE_PATH, fixturesFile([WORKED_FIXTURES[0]!]), "--quiet"], deps),
    ).resolves.toBe(1);
    expect(stdout()).toBe("");
    expect(stderr()).toContain("siftline:");
  });
});
