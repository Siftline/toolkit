import { readFile } from "node:fs/promises";

import {
  parseFixtures,
  parseRecipe,
  recordSchema,
  ruleSchema,
  validateFixtures,
  validateRules,
} from "@siftline/core";
import type { Fixture, Recipe, Record, Rule } from "@siftline/core";
import { z } from "zod";

import type { InputStream } from "./deps";
import { InputError } from "./deps";

export async function readTextFile(path: string, what: string): Promise<string> {
  try {
    return await readFile(path, "utf8");
  } catch (cause) {
    throw new InputError(`cannot read the ${what} ${path}: ${reason(cause)}`, { cause });
  }
}

export async function readRecipeFile(path: string): Promise<Recipe> {
  const text = await readTextFile(path, "recipe");

  try {
    return parseRecipe(text);
  } catch (cause) {
    throw new InputError(`${path} is not a valid Recipe: ${reason(cause)}`, { cause });
  }
}

export async function readFixturesFile(path: string, recipe: Recipe): Promise<Fixture[]> {
  return await readChecked(path, "fixtures", "Fixtures", parseFixtures, (fixtures) =>
    validateFixtures(fixtures, recipe).map(
      (problem) => `fixture ${problem.fixture}: ${problem.problem}`,
    ),
  );
}

export async function readRulesFile(path: string, recipe: Recipe): Promise<Rule[]> {
  return await readChecked(
    path,
    "rules",
    "Rules",
    (text) => ruleSchema.array().parse(JSON.parse(text)),
    (rules) =>
      validateRules(rules, recipe).map((problem) => `rule ${problem.rule}: ${problem.problem}`),
  );
}

/** Parse the whole file, then refuse it on the first line that no longer fits the Recipe. */
async function readChecked<T>(
  path: string,
  what: string,
  kind: string,
  parse: (text: string) => T[],
  stale: (items: T[]) => string[],
): Promise<T[]> {
  const text = await readTextFile(path, what);

  let items: T[];

  try {
    items = parse(text);
  } catch (cause) {
    throw new InputError(`${path} does not hold valid ${kind}: ${reason(cause)}`, { cause });
  }

  const problems = stale(items);
  const first = problems[0];

  if (first) {
    throw new InputError(`${path} does not fit the Recipe: ${first}${andMore(problems.length)}`);
  }

  return items;
}

/** `-` and an absent path both mean stdin. Every line is parsed before the caller judges any. */
export async function readRecords(path: string | undefined, stdin: InputStream): Promise<Record[]> {
  const fromStdin = path === undefined || path === "-";
  const source = fromStdin ? "stdin" : path;
  const text = fromStdin ? await readStdin(stdin) : await readTextFile(path, "records");

  const records: Record[] = [];

  for (const [offset, line] of text.split("\n").entries()) {
    if (line.trim() === "") continue;

    try {
      records.push(recordSchema.parse(JSON.parse(line)));
    } catch (cause) {
      throw new InputError(`${source} line ${offset + 1} is not a valid Record: ${reason(cause)}`, {
        cause,
      });
    }
  }

  return records;
}

async function readStdin(stream: InputStream): Promise<string> {
  const decoder = new TextDecoder();
  let text = "";

  for await (const chunk of stream) {
    text += chunk instanceof Uint8Array ? decoder.decode(chunk, { stream: true }) : chunk;
  }

  return text + decoder.decode();
}

const issueSchema = z.object({
  path: z.array(z.union([z.string(), z.number(), z.symbol()])),
  message: z.string(),
});

type Issue = z.infer<typeof issueSchema>;

const issuesHolder = z.object({ issues: z.array(z.unknown()) });

/** Zod's issues by shape, not by class, so a second copy of Zod still reads. */
function issuesOf(cause: unknown): Issue[] | undefined {
  const holder = issuesHolder.safeParse(cause);

  if (!holder.success) return undefined;

  const issues = holder.data.issues.flatMap((candidate) => {
    const issue = issueSchema.safeParse(candidate);

    return issue.success ? [issue.data] : [];
  });

  return issues.length === 0 ? undefined : issues;
}

function reason(cause: unknown): string {
  const issues = issuesOf(cause);

  if (issues) return firstIssue(issues);

  if (cause instanceof Error) {
    const nested = issuesOf(cause.cause);

    return nested ? `${cause.message}: ${firstIssue(nested)}` : cause.message;
  }

  return String(cause);
}

/** The first issue with its path, and how many stand behind it. */
function firstIssue(issues: readonly Issue[]): string {
  const first = issues[0];

  if (!first) return "invalid";
  const where = first.path.length === 0 ? "" : `${first.path.join(".")}: `;

  return `${where}${first.message}${andMore(issues.length)}`;
}

/** The tail every "here is the first of them" sentence in this file ends with. */
function andMore(count: number): string {
  return count === 1 ? "" : ` (and ${count - 1} more)`;
}
