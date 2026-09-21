import { readFile } from "node:fs/promises";

import { parseFixtures, parseRecipe, validateFixtures } from "@siftline/core";
import type { Fixture, Recipe } from "@siftline/core";

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
  const text = await readTextFile(path, "fixtures");

  let fixtures: Fixture[];
  try {
    fixtures = parseFixtures(text);
  } catch (cause) {
    throw new InputError(`${path} does not hold valid Fixtures: ${reason(cause)}`, { cause });
  }

  const problems = validateFixtures(fixtures, recipe);
  const first = problems[0];
  if (first) {
    const more = problems.length === 1 ? "" : ` (and ${problems.length - 1} more)`;
    throw new InputError(
      `${path} does not fit the Recipe: fixture ${first.fixture}: ${first.problem}${more}`,
    );
  }

  return fixtures;
}

interface Issue {
  path: readonly PropertyKey[];
  message: string;
}

/** Zod's issues by duck typing: the CLI states no opinion on the validator core uses. */
function issuesOf(value: unknown): Issue[] | undefined {
  if (typeof value !== "object" || value === null || !("issues" in value)) return undefined;
  const raw: unknown = value.issues;
  if (!Array.isArray(raw)) return undefined;

  const issues: Issue[] = [];
  for (const candidate of raw) if (isIssue(candidate)) issues.push(candidate);
  return issues.length === 0 ? undefined : issues;
}

function isIssue(value: unknown): value is Issue {
  return (
    typeof value === "object" &&
    value !== null &&
    "message" in value &&
    typeof value.message === "string" &&
    "path" in value &&
    Array.isArray(value.path)
  );
}

function reason(cause: unknown): string {
  const issues = issuesOf(cause);
  if (issues) return describe(issues);

  if (cause instanceof Error) {
    const nested = issuesOf(cause.cause);
    return nested ? `${cause.message}: ${describe(nested)}` : cause.message;
  }

  return String(cause);
}

function describe(issues: readonly Issue[]): string {
  const first = issues[0];
  if (!first) return "invalid";
  const where = first.path.length === 0 ? "" : `${first.path.join(".")}: `;
  const head = `${where}${first.message}`;
  return issues.length === 1 ? head : `${head} (and ${issues.length - 1} more)`;
}
