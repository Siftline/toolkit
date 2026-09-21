// Type-level assertions. Nothing runs; `typecheck` is the test. Every `@ts-expect-error`
// marks a line that MUST fail to compile, every `Expect<…>` a type that MUST come out exact.
// Each slice of core appends a section; the helpers below are declared once.

// `Equal` compares two types by the identity of a generic signature, so each `T` is used
// once on purpose — which is what the rule flags.
// oxlint-disable typescript/no-unnecessary-type-parameters

import { choice, defineRecipe, noul, parseRecipe, recipeSchema, score } from "@siftline/core";
import type { Question, Questions, Recipe, SystemOneClient } from "@siftline/core";
import type { TypeSafeClient } from "@typesafe-ai/sdk";
import type { z } from "zod";

type Expect<T extends true> = T;
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

// ─── Recipe ─────────────────────────────────────────────────────────────────────────────

type ParsedRecipe = z.infer<typeof recipeSchema>;

type _ParsedIsQuestions = Expect<ParsedRecipe["questions"] extends Questions ? true : false>;
// @ts-expect-error — the other way round fails on the readonly tuple
type _QuestionsIsParsed = Expect<Questions extends ParsedRecipe["questions"] ? true : false>;

const recipe = defineRecipe({
  name: "feedback-widget",
  version: 3,
  model: "jev-1.13.0",
  reviewThreshold: 0.6,
  questions: {
    team: choice("Route to the team that owns the problem", {
      billing: "Charges, invoices, refunds",
      product: "Bugs and missing features",
      sales: "Pricing questions before buying",
    }),
    angry: noul("Is the sender angry?", { true: "Insults", false: "Neutral" }),
    urgency: score("How soon does this need a reply?", [
      "Can wait a week",
      "This week",
      "Today",
      "The service is down for them",
    ]),
  },
});

type _TeamLabels = Expect<
  Equal<keyof (typeof recipe)["questions"]["team"]["criteria"], "billing" | "product" | "sales">
>;
type _UrgencyLength = Expect<
  Equal<(typeof recipe)["questions"]["urgency"]["criteria"]["length"], 4>
>;
type _AngryIsNoul = Expect<Equal<(typeof recipe)["questions"]["angry"]["type"], "noul">>;

// @ts-expect-error — no such question
void recipe.questions.teem;

// Raw object literals, no helpers: `const Q` on `defineRecipe` alone keeps the literals.
const rawRecipe = defineRecipe({
  name: "raw",
  version: 1,
  model: "jev-1.13.0",
  questions: {
    lang: { type: "choice", instructions: "Language?", criteria: { en: "English", cs: "Czech" } },
    urgency: { type: "score", instructions: "How soon?", criteria: ["Later", "Now"] },
  },
});

type _RawLabels = Expect<
  Equal<keyof (typeof rawRecipe)["questions"]["lang"]["criteria"], "en" | "cs">
>;
type _RawLevels = Expect<
  Equal<(typeof rawRecipe)["questions"]["urgency"]["criteria"]["length"], 2>
>;

// A typed Recipe narrows to the erased one, so every `Recipe`-taking function accepts it.
const erased: Recipe = recipe;
void erased;

// A Recipe read from disk is erased, and `noUncheckedIndexedAccess` shows on its question map.
const fromDisk = parseRecipe("{}");
type _FromDisk = Expect<Equal<typeof fromDisk, Recipe>>;
const anyQuestion = fromDisk.questions.anything;
type _FromDiskQuestion = Expect<Equal<typeof anyQuestion, Question | undefined>>;

// ─── Testing client ─────────────────────────────────────────────────────────────────────

// The seam's whole point: the real SDK client satisfies the interface core declares, so a
// portal passes one straight to `createJudge`. `systemOne` is a property, not a method, so
// this is a contravariant check on the request and options types, not a bivariant one.
type _SdkClientIsSystemOneClient = Expect<TypeSafeClient extends SystemOneClient ? true : false>;

// Not the other way round: `TypeSafeClient` is a class with private state and a whole API
// surface besides.
// @ts-expect-error — core's interface is the narrower of the two
type _SystemOneClientIsSdkClient = Expect<SystemOneClient extends TypeSafeClient ? true : false>;
