import type { Decision, JsonValue, Recipe } from "@siftline/core";
import { z } from "zod";

import type { RecordContext } from "./adapter";
import { ActionBuildError } from "./errors";

type Scalar = string | number | boolean | null;

interface Sources {
  decision: Decision;
  record: RecordContext;
  recipe: Recipe;
}

// The closed set, bar `answers.<name>`, whose names come from the Recipe.
const variables = new Map<string, (sources: Sources) => Scalar>([
  ["record.id", ({ decision }) => decision.recordId],
  ["record.text", ({ record }) => record.text],
  ["record.sender", ({ record }) => record.sender ?? null],
  ["record.source", ({ record }) => record.source ?? null],
  ["decision.id", ({ decision }) => decision.id],
  ["recipe.name", ({ recipe }) => recipe.name],
  ["rule", ({ decision }) => decision.rule],
]);

// Core's Question name grammar.
const answerVariable = /^answers\.([a-z][a-z0-9_]*)$/;

const anyVariable = /\{\{([^{}]*)\}\}/g;

const onlyVariable = /^\{\{([^{}]*)\}\}$/;

const stringValue = z.string();

function isKnown(name: string): boolean {
  return variables.has(name) || answerVariable.test(name);
}

/**
 * Parses a Body template, calling `leaf` on every string value, never on a key. The reviver
 * visits a value before its parent, so what `leaf` returns lands in place.
 */
function walk(source: string, leaf: (value: string) => Scalar): string {
  const parsed = JSON.parse(source, (_key, value: JsonValue) => {
    const string = stringValue.safeParse(value);

    return string.success ? leaf(string.data) : value;
  });

  return JSON.stringify(parsed);
}

function checkLeaf(value: string): string {
  for (const [match, name = ""] of value.matchAll(anyVariable)) {
    if (!isKnown(name.trim())) throw new SyntaxError(`unknown variable ${match}`);
  }

  if (value.replaceAll(anyVariable, "").includes("{{")) {
    throw new SyntaxError(`stray "{{" in ${JSON.stringify(value)}`);
  }

  return value;
}

/** The reason `source` is not a Body template, or `null` when it is one. */
export function bodyTemplateProblem(source: string): string | null {
  try {
    JSON.parse(source);
  } catch (error) {
    return `not valid JSON (${error instanceof Error ? error.message : String(error)})`;
  }

  try {
    walk(source, checkLeaf);
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }

  return null;
}

/**
 * Renders a Body template that `bodyTemplateProblem` accepted. A string value that is exactly one
 * variable becomes the typed value; a variable inside other text becomes text. An absent value is
 * `null` on its own and `""` inside text.
 *
 * @throws ActionBuildError when the template names a Question the Recipe does not ask.
 */
export function renderBody(source: string, sources: Sources): string {
  const { decision, recipe } = sources;

  const lookup = (name: string): Scalar => {
    const variable = variables.get(name);

    if (variable !== undefined) return variable(sources);

    const [, question = ""] = answerVariable.exec(name) ?? [];

    if (!Object.hasOwn(recipe.questions, question)) {
      throw new ActionBuildError(
        `Action "${decision.action ?? ""}": config.body: Recipe "${recipe.name}" has no Question "${question}"`,
      );
    }

    // Own keys only: `answers.constructor` is a legal Question name.
    return Object.hasOwn(decision.answers, question) ? (decision.answers[question] ?? null) : null;
  };

  return walk(source, (value) => {
    const [, only] = onlyVariable.exec(value) ?? [];

    if (only !== undefined) return lookup(only.trim());

    return value.replaceAll(anyVariable, (_, name: string) => String(lookup(name.trim()) ?? ""));
  });
}
