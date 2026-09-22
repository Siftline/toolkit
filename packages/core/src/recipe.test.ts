import { readFileSync } from "node:fs";

import {
  choice,
  defineRecipe,
  noul,
  parseRecipe,
  questionSchema,
  recipeSchema,
  score,
  serializeRecipe,
} from "@siftline/core";
import type { JsonValue } from "@siftline/core";
import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

// Imported by package name, not by relative path: this asserts the published `exports` map.

const referenceNames = ["support-inbox", "feedback-widget", "doc-pair-check"] as const;

function readReference(name: string): string {
  return readFileSync(new URL(`../fixtures/recipes/${name}.json`, import.meta.url), "utf8");
}

/** A minimal valid document, so each strictness case varies exactly one thing. */
function valid() {
  return {
    format: 1,
    name: "support-inbox",
    version: 1,
    model: "jev-1.13.0",
    reviewThreshold: 0.7,
    questions: {
      category: { type: "choice", instructions: "Which?", criteria: { a: "A", b: "B" } },
    },
  };
}

describe.each(referenceNames)("the %s reference Recipe", (name) => {
  it("round-trips byte for byte", () => {
    const text = readReference(name);
    expect(serializeRecipe(parseRecipe(text))).toBe(text);
  });

  it("parses under its own name", () => {
    expect(parseRecipe(readReference(name)).name).toBe(name);
  });
});

it("preserves question and label order", () => {
  const recipe = parseRecipe(readReference("feedback-widget"));
  expect(Object.keys(recipe.questions)).toEqual(["team", "angry", "urgency"]);
  const team = recipe.questions.team;
  expect(team?.type === "choice" ? Object.keys(team.criteria) : []).toEqual([
    "billing",
    "product",
    "sales",
  ]);
});

describe("strictness", () => {
  it("rejects an unknown top-level key", () => {
    expect(() => recipeSchema.parse({ ...valid(), benchmarkAccuracy: 0.9 })).toThrow(ZodError);
  });

  it("rejects an unknown key inside a question", () => {
    const questions = { category: { ...choice("Which?", { a: "A", b: "B" }), weight: 1 } };
    expect(() => recipeSchema.parse({ ...valid(), questions })).toThrow(ZodError);
  });

  it.each(["jev-latest", "jev-preview"])("rejects the %s alias", (model) => {
    expect(() => recipeSchema.parse({ ...valid(), model })).toThrow(ZodError);
  });

  it("never defaults a missing reviewThreshold", () => {
    const recipe: { [key: string]: JsonValue } = valid();
    delete recipe.reviewThreshold;
    expect(() => recipeSchema.parse(recipe)).toThrow(ZodError);
  });

  it("rejects a Choice with one label", () => {
    const questions = {
      category: { type: "choice", instructions: "Which?", criteria: { a: "A" } },
    };

    expect(() => recipeSchema.parse({ ...valid(), questions })).toThrow(ZodError);
  });

  it("rejects a Score with one level", () => {
    const questions = { urgency: { type: "score", instructions: "How soon?", criteria: ["Now"] } };
    expect(() => recipeSchema.parse({ ...valid(), questions })).toThrow(ZodError);
  });

  it("rejects a Noul without instructions", () => {
    const questions = { angry: { type: "noul" } };
    expect(() => recipeSchema.parse({ ...valid(), questions })).toThrow(ZodError);
  });

  it("rejects an empty question map", () => {
    expect(() => recipeSchema.parse({ ...valid(), questions: {} })).toThrow(ZodError);
  });

  it("rejects a question name that is not snake_case", () => {
    const questions = { Category: choice("Which?", { a: "A", b: "B" }) };
    expect(() => recipeSchema.parse({ ...valid(), questions })).toThrow(ZodError);
  });

  it("accepts the minimal valid document", () => {
    expect(recipeSchema.parse(valid()).name).toBe("support-inbox");
  });
});

describe("questionSchema", () => {
  it("accepts each question type", () => {
    expect(questionSchema.parse(choice("Which?", { a: "A", b: "B" })).type).toBe("choice");
    expect(questionSchema.parse(noul("Angry?")).type).toBe("noul");
    expect(questionSchema.parse(score("How soon?", ["Later", "Now"])).type).toBe("score");
  });

  it("accepts a structured entry", () => {
    const question = choice({ task: "Route it", steps: ["read", "pick"] }, { a: "A", b: "B" });
    expect(questionSchema.parse(question).type).toBe("choice");
  });

  it("rejects a null description, which the SDK allows", () => {
    expect(() => questionSchema.parse(choice("Which?", { a: null, b: "B" }))).toThrow(ZodError);
  });
});

describe("defineRecipe", () => {
  it("defaults reviewThreshold to 0.7 into the object it returns", () => {
    const recipe = defineRecipe({
      name: "raw",
      version: 1,
      model: "jev-1.13.0",
      questions: { lang: choice("Language?", { en: "English", cs: "Czech" }) },
    });

    expect(recipe.reviewThreshold).toBe(0.7);
    expect(recipe.format).toBe(1);
  });

  it("returns the object it built, not the parsed copy", () => {
    const questions = { angry: noul("Angry?") };
    const recipe = defineRecipe({ name: "raw", version: 1, model: "jev-1.13.0", questions });
    expect(recipe.questions).toBe(questions);
  });

  it("serializes to the reference bytes", () => {
    const recipe = defineRecipe({
      name: "support-inbox",
      version: 1,
      model: "jev-1.13.0",
      questions: {
        category: choice("Which category best describes this message?", {
          complaint: "The sender is unhappy with the product or service",
          question: "The sender asks how something works",
          other: "Anything else, including spam and thanks",
        }),
        wants_human: noul("Does the sender ask to speak to a person?"),
      },
    });

    expect(serializeRecipe(recipe)).toBe(readReference("support-inbox"));
  });

  it("throws on a recipe the schema rejects", () => {
    expect(() =>
      defineRecipe({
        name: "raw",
        version: 0,
        model: "jev-latest",
        questions: { lang: choice("Language?", { en: "English", cs: "Czech" }) },
      }),
    ).toThrow(ZodError);
  });
});
