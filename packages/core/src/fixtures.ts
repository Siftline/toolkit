import { z } from "zod";

import type { Answers, Decision } from "./decision";
import { SiftlineError } from "./errors";
import type { Judge } from "./judge";
import { entryType, questionName } from "./recipe";
import type { EntryType, Questions, Recipe } from "./recipe";

// ─── The line ───────────────────────────────────────────────────────────────────────────

const answerValue = z.union([z.string(), z.boolean(), z.number()]);

export const fixtureSchema = z
  .object({
    id: z.string().min(1).optional(),
    origin: z.string().min(1).optional(),
    by: z.string().min(1).optional(),
    state: entryType,
    expect: z
      .record(questionName, answerValue)
      .refine((e) => Object.keys(e).length >= 1, "at least one expectation"),
  })
  .strict();

/**
 * One labelled Fixture. `expect` is `Answers<Q>` made partial, so it carries the Recipe's
 * literal labels and level indices and needs no second mapping.
 */
export interface Fixture<Q extends Questions = Questions> {
  state: EntryType;
  expect: Partial<Answers<Q>>;
  id?: string;
  origin?: string;
  by?: string;
}

/** A bad line, named by its 1-based position. Core never reads files, so there is no path. */
export class FixtureParseError extends SiftlineError {
  readonly line: number;

  constructor(message: string, line: number, options?: ErrorOptions) {
    super(message, "fixture_invalid", false, options);
    this.line = line;
  }
}

export function parseFixture(line: string): Fixture {
  return fixtureSchema.parse(JSON.parse(line));
}

/** The only writer. One compact line, no trailing newline, absent optionals omitted. */
export function serializeFixture(fixture: Fixture): string {
  const line: { [key: string]: unknown } = {};
  if (fixture.id !== undefined) line["id"] = fixture.id;
  if (fixture.origin !== undefined) line["origin"] = fixture.origin;
  if (fixture.by !== undefined) line["by"] = fixture.by;
  line["state"] = fixture.state;
  line["expect"] = fixture.expect;
  return JSON.stringify(line);
}

export function parseFixtures(text: string): Fixture[] {
  const fixtures: Fixture[] = [];
  const lines = text.split("\n");

  for (const [offset, line] of lines.entries()) {
    if (line.trim() === "") continue;
    try {
      fixtures.push(parseFixture(line));
    } catch (cause) {
      throw new FixtureParseError(`fixture line ${offset + 1} is not a valid Fixture`, offset + 1, {
        cause,
      });
    }
  }

  return fixtures;
}

// ─── Validation ─────────────────────────────────────────────────────────────────────────

/** One Fixture that no longer fits its Recipe, keyed by its id or 1-based index. */
export interface FixtureProblem {
  fixture: string;
  problem: string;
}

export class FixtureValidationError extends SiftlineError {
  readonly problems: FixtureProblem[];

  constructor(problems: FixtureProblem[], options?: ErrorOptions) {
    super(describe(problems), "fixture_invalid", false, options);
    this.problems = problems;
  }
}

function describe(problems: FixtureProblem[]): string {
  const first = problems[0];
  if (!first) return "the Fixtures do not fit the Recipe";
  const head = `${first.fixture}: ${first.problem}`;
  return problems.length === 1 ? head : `${head} (and ${problems.length - 1} more)`;
}

/** The portal's stale-Fixture warning, and what the runner refuses to start on. */
export function validateFixtures(fixtures: Fixture[], recipe: Recipe): FixtureProblem[] {
  const problems: FixtureProblem[] = [];
  const seen = new Set<string>();

  for (const [offset, fixture] of fixtures.entries()) {
    const named = fixture.id ?? String(offset + 1);
    const report = (problem: string): void => {
      problems.push({ fixture: named, problem });
    };

    if (fixture.id !== undefined) {
      if (seen.has(fixture.id)) report(`duplicate id "${fixture.id}"`);
      seen.add(fixture.id);
    }

    for (const [question, expected] of Object.entries(fixture.expect)) {
      const asked = recipe.questions[question];
      if (!asked) {
        report(`unknown question "${question}"`);
        continue;
      }

      if (asked.type === "choice") {
        if (typeof expected !== "string" || !Object.hasOwn(asked.criteria, expected)) {
          report(`unknown label ${JSON.stringify(expected)} for question "${question}"`);
        }
        continue;
      }

      if (asked.type === "noul") {
        if (typeof expected !== "boolean") {
          report(`value ${JSON.stringify(expected)} for question "${question}" is not a boolean`);
        }
        continue;
      }

      const last = asked.criteria.length - 1;
      if (
        typeof expected !== "number" ||
        !Number.isInteger(expected) ||
        expected < 0 ||
        expected > last
      ) {
        const shown = JSON.stringify(expected);
        report(`level index ${shown} for question "${question}" is out of range (0-${last})`);
      }
    }
  }

  return problems;
}

/**
 * `NoInfer` keeps `Q` coming from the Recipe alone, so an unannotated Fixture literal is
 * checked against it instead of widening it. The implementation is erased because inside a
 * generic body TS cannot see that `Fixture<Q>` narrows `Fixture`.
 */
export function defineFixtures<Q extends Questions>(
  recipe: Recipe<Q>,
  fixtures: NoInfer<Fixture<Q>>[],
): Fixture<Q>[];
export function defineFixtures(recipe: Recipe, fixtures: Fixture[]): Fixture[] {
  for (const fixture of fixtures) fixtureSchema.parse(fixture);
  const problems = validateFixtures(fixtures, recipe);
  if (problems.length > 0) throw new FixtureValidationError(problems);
  return fixtures;
}

// ─── Matching ───────────────────────────────────────────────────────────────────────────

/** `actual` is `undefined` when the Decision has no answer for the Question. */
export interface Mismatch {
  question: string;
  expected: string | boolean | number;
  actual: string | boolean | number | undefined;
}

/** Pure. Strict equality per type, no tolerance, in `expect` insertion order. */
export function compareAnswers(expect: Partial<Answers>, answers: Answers): Mismatch[] {
  const mismatches: Mismatch[] = [];

  for (const [question, expected] of Object.entries(expect)) {
    if (expected === undefined) continue;
    const actual = answers[question];
    if (actual !== expected) mismatches.push({ question, expected, actual });
  }

  return mismatches;
}

// ─── The report ─────────────────────────────────────────────────────────────────────────

export interface FixtureResult {
  index: number;
  id: string;
  decision: Decision;
  expect: Partial<Answers>;
  mismatches: Mismatch[];
  review: boolean;
}

export interface QuestionAccuracy {
  asserted: number;
  matched: number;
  accuracy: number | null;
}

export interface TestReport {
  recipe: { name: string; version: number };
  model: string;
  fixtures: FixtureResult[];
  questions: { [question: string]: QuestionAccuracy };
  accuracy: number | null;
}

/**
 * The pure half. A Question absent from a Fixture's `expect` leaves that Question's
 * denominator; an unsure Decision counts on its answers, because the threshold is a routing
 * knob and must not hide errors.
 */
export function scoreResults(results: FixtureResult[], recipe: Recipe): TestReport {
  const questions: { [question: string]: QuestionAccuracy } = {};
  for (const question of Object.keys(recipe.questions)) {
    questions[question] = { asserted: 0, matched: 0, accuracy: null };
  }

  for (const result of results) {
    const missed = new Set(result.mismatches.map((mismatch) => mismatch.question));
    for (const [question, expected] of Object.entries(result.expect)) {
      if (expected === undefined) continue;
      const tally = questions[question];
      if (!tally) continue;
      tally.asserted += 1;
      if (!missed.has(question)) tally.matched += 1;
    }
  }

  const scored: number[] = [];
  for (const tally of Object.values(questions)) {
    if (tally.asserted === 0) continue;
    tally.accuracy = tally.matched / tally.asserted;
    scored.push(tally.accuracy);
  }

  return {
    recipe: { name: recipe.name, version: recipe.version },
    model: results[0]?.decision.model ?? "",
    fixtures: results,
    questions,
    accuracy: scored.length === 0 ? null : Math.min(...scored),
  };
}

export interface TestRecipeOptions {
  signal?: AbortSignal;
  onResult?: (result: FixtureResult) => void;
}

/**
 * Fires every Fixture through the Judge at once and lets the Judge's gate meter concurrency.
 * The first `JudgeError` or `JudgeExhaustedError` aborts the rest and is rethrown: a partial
 * accuracy is worse than none.
 */
export async function testRecipe(
  judge: Judge,
  recipe: Recipe,
  fixtures: Fixture[],
  options: TestRecipeOptions = {},
): Promise<TestReport> {
  const problems = validateFixtures(fixtures, recipe);
  if (problems.length > 0) throw new FixtureValidationError(problems);

  const { onResult } = options;
  const controller = new AbortController();
  const signal = options.signal
    ? AbortSignal.any([options.signal, controller.signal])
    : controller.signal;

  const results = await Promise.all(
    fixtures.map(async (fixture, offset): Promise<FixtureResult> => {
      const index = offset + 1;
      const id = fixture.id ?? `fixture:${index}`;
      let decision: Decision;
      try {
        decision = await judge({ id, state: fixture.state }, recipe, { signal });
      } catch (cause) {
        controller.abort(cause);
        throw cause;
      }

      const result: FixtureResult = {
        index,
        id,
        decision,
        expect: fixture.expect,
        mismatches: compareAnswers(fixture.expect, decision.answers),
        review: decision.review,
      };
      onResult?.(result);
      return result;
    }),
  );

  return scoreResults(results, recipe);
}
