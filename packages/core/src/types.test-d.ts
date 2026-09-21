// Type-level assertions. Nothing runs; `typecheck` is the test. Every `@ts-expect-error`
// marks a line that MUST fail to compile, every `Expect<…>` a type that MUST come out exact.
// Each slice of core appends a section; the helpers below are declared once.

// `Equal` compares two types by the identity of a generic signature, so each `T` is used
// once on purpose — which is what the rule flags.
// oxlint-disable typescript/no-unnecessary-type-parameters

import {
  choice,
  createJudge,
  defineRecipe,
  evaluateRules,
  noul,
  parseDecision,
  parseRecipe,
  recipeSchema,
  routeDecision,
  ruleSchema,
  score,
} from "@siftline/core";
import type {
  Answers,
  Decision,
  Question,
  Questions,
  Recipe,
  Record,
  Rule,
  RuleCondition,
  SiftlineError,
  SystemOneClient,
} from "@siftline/core";
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

// ─── Decision ───────────────────────────────────────────────────────────────────────────

type _ErasedAnswers = Expect<Equal<Answers, { [x: string]: string | boolean | number }>>;
type _RecordFields = Expect<Equal<keyof Record, "id" | "state" | "trimmed">>;

declare const decision: Decision<(typeof recipe)["questions"]>;

type _Team = Expect<Equal<typeof decision.answers.team, "billing" | "product" | "sales">>;
type _Angry = Expect<Equal<typeof decision.answers.angry, boolean>>;
type _Urgency = Expect<Equal<typeof decision.answers.urgency, 0 | 1 | 2 | 3>>;
type _TeamEvidence = Expect<
  Equal<keyof typeof decision.questions.team.probabilities, "billing" | "product" | "sales">
>;
type _UrgencyEvidence = Expect<
  Equal<keyof (typeof decision)["questions"]["urgency"], "score" | "confidence" | "probabilities">
>;
type _UrgencyProbabilities = Expect<
  Equal<keyof (typeof decision)["questions"]["urgency"]["probabilities"], 0 | 1 | 2 | 3>
>;
type _AngryEvidence = Expect<
  Equal<keyof (typeof decision)["questions"]["angry"], "probability" | "confidence">
>;

// @ts-expect-error — no such question
void decision.answers.teem;

// @ts-expect-error — not one of the labels
const wrong: "nope" = decision.answers.team;
void wrong;

// A Decision read from disk is erased, and indexing it admits `undefined`.
const decisionFromDisk = parseDecision("{}");
type _ErasedDecision = Expect<Equal<typeof decisionFromDisk, Decision>>;
const anyAnswer = decisionFromDisk.answers.anything;
type _ErasedAnswer = Expect<Equal<typeof anyAnswer, string | boolean | number | undefined>>;

type _ErrorCodes = Expect<
  Equal<
    SiftlineError["code"],
    "jev_exhausted" | "jev_error" | "fixture_invalid" | "action_failed" | "action_build"
  >
>;

declare const failure: SiftlineError;
// @ts-expect-error — `code` is readonly
failure.code = "jev_error";
// @ts-expect-error — `retryable` is readonly
failure.retryable = true;

// ─── Testing client ─────────────────────────────────────────────────────────────────────

// The seam's whole point: the real SDK client satisfies the interface core declares, so a
// portal passes one straight to `createJudge`. `systemOne` is a property, not a method, so
// this is a contravariant check on the request and options types, not a bivariant one.
type _SdkClientIsSystemOneClient = Expect<TypeSafeClient extends SystemOneClient ? true : false>;

// Not the other way round: `TypeSafeClient` is a class with private state and a whole API
// surface besides.
// @ts-expect-error — core's interface is the narrower of the two
type _SystemOneClientIsSdkClient = Expect<SystemOneClient extends TypeSafeClient ? true : false>;

// ─── Rules ──────────────────────────────────────────────────────────────────────────────

// Reads in argument order and fails at the constraint, not inside a conditional.
type Narrows<A extends B, B> = A;

type ParsedRule = z.infer<typeof ruleSchema>;

// A narrowed Rule is always a valid parsed Rule, so the erased `evaluateRules` accepts one.
// The reverse does not hold: a parsed `is` carries all three value types at once.
type _RuleNarrows = Narrows<Rule<(typeof recipe)["questions"]>, ParsedRule>;
type _RuleNarrows2 = Expect<Rule<(typeof recipe)["questions"]> extends ParsedRule ? true : false>;
type _CondNarrows = Narrows<RuleCondition<(typeof recipe)["questions"]>, ParsedRule["condition"]>;
type _ErasedRuleIsParsed = Expect<Rule extends ParsedRule ? true : false>;

const rules: Rule<(typeof recipe)["questions"]>[] = [
  {
    id: "r1",
    condition: { question: "urgency", comparator: "atLeast", value: 3 },
    action: "act_pager",
  },
  {
    id: "r2",
    condition: { question: "team", comparator: "isOneOf", value: ["billing", "sales"] },
    action: "act_slack_revenue",
  },
  { id: "r3", condition: { question: "angry", comparator: "is", value: true }, action: null },
];

const badRules: Rule<(typeof recipe)["questions"]>[] = [
  // @ts-expect-error — unknown question
  { id: "b1", condition: { question: "teem", comparator: "is", value: "billing" }, action: null },
  // @ts-expect-error — unknown label in `is`
  { id: "b2", condition: { question: "team", comparator: "is", value: "support" }, action: null },
  {
    id: "b3",
    // @ts-expect-error — unknown label in `isOneOf`
    condition: { question: "team", comparator: "isOneOf", value: ["billing", "support"] },
    action: null,
  },
  // @ts-expect-error — level index out of range
  { id: "b4", condition: { question: "urgency", comparator: "atLeast", value: 4 }, action: null },
  // @ts-expect-error — boolean on a Choice
  { id: "b5", condition: { question: "team", comparator: "is", value: true }, action: null },
  // @ts-expect-error — `atLeast` on a Choice
  { id: "b6", condition: { question: "team", comparator: "atLeast", value: 1 }, action: null },
];
void badRules;

const routed = routeDecision(decision, rules);
type _Routed = Expect<Equal<typeof routed, Decision<(typeof recipe)["questions"]>>>;

// `NoInfer`: an unannotated array literal at the call site is checked against the Decision's Q.
routeDecision(decision, [
  // @ts-expect-error — unknown label, inferred from `decision`
  { id: "x", condition: { question: "team", comparator: "is", value: "nope" }, action: null },
]);

// Rules read from cloud's rows are erased, and so must the Decision beside them be.
const parsedRules: Rule[] = ruleSchema
  .array()
  .parse([
    { id: "p", condition: { question: "team", comparator: "is", value: "billing" }, action: null },
  ]);
routeDecision(decisionFromDisk, parsedRules);
void evaluateRules(decisionFromDisk.answers, parsedRules);
void evaluateRules(decision.answers, parsedRules);
// @ts-expect-error — an erased Rule is not a Rule<Q>: `value` is too wide
routeDecision(decision, parsedRules);
// ─── Judge ──────────────────────────────────────────────────────────────────────────────

declare const client: SystemOneClient;
declare const record: Record;

const judge = createJudge({ client, retry: "prompt" });

// The Recipe's literals survive the whole round trip, so the portal reads a typed Decision.
const judged = judge(record, recipe);
type _Judged = Expect<Equal<typeof judged, Promise<Decision<(typeof recipe)["questions"]>>>>;
type _JudgedUrgency = Expect<Equal<Awaited<typeof judged>["answers"]["urgency"], 0 | 1 | 2 | 3>>;

// A Recipe read from disk judges to the erased Decision.
const judgedFromDisk = judge(record, fromDisk);
type _JudgedFromDisk = Expect<Equal<typeof judgedFromDisk, Promise<Decision>>>;

// @ts-expect-error — `retry` has no default
createJudge({ client });
