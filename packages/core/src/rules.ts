import { z } from "zod";

import { answerValueProblem } from "./decision";
import type { Answers, Decision, IndexOf } from "./decision";
import { questionName } from "./recipe";
import type { Questions, Recipe } from "./recipe";

// Six comparators, closed. No negation, no compounds. Confidence is not a comparator.
export const ruleConditionSchema = z.discriminatedUnion("comparator", [
  z
    .object({
      question: questionName,
      comparator: z.literal("is"),
      value: z.union([z.string().min(1), z.boolean(), z.number().int().min(0)]),
    })
    .strict(),
  z
    .object({
      question: questionName,
      comparator: z.literal("isOneOf"),
      value: z.array(z.string().min(1)).min(1),
    })
    .strict(),
  z
    .object({
      question: questionName,
      comparator: z.literal("atLeast"),
      value: z.number().int().min(0),
    })
    .strict(),
  z
    .object({
      question: questionName,
      comparator: z.literal("atMost"),
      value: z.number().int().min(0),
    })
    .strict(),
]);

export const ruleSchema = z
  .object({
    id: z.string().min(1),
    condition: ruleConditionSchema,
    action: z.string().min(1).nullable(),
  })
  .strict();

type ParsedCondition = z.infer<typeof ruleConditionSchema>;

type ConditionFor<K, Qn> = Qn extends { type: "choice"; criteria: infer C }
  ?
      | { question: K; comparator: "is"; value: keyof C & string }
      | { question: K; comparator: "isOneOf"; value: (keyof C & string)[] }
  : Qn extends { type: "noul" }
    ? { question: K; comparator: "is"; value: boolean }
    : Qn extends { type: "score"; criteria: infer S extends readonly unknown[] }
      ? { question: K; comparator: "is" | "atLeast" | "atMost"; value: IndexOf<S> }
      : never;

// Distributing over a mapped type indexed by `[keyof Q & string]` is what pairs each question
// with its own value type; flattening it would check the two independently.
export type RuleCondition<Q extends Questions = Questions> = {
  [K in keyof Q & string]: ConditionFor<K, Q[K]>;
}[keyof Q & string];

export interface Rule<Q extends Questions = Questions> {
  id: string;
  condition: RuleCondition<Q>;
  action: string | null;
}

/** What a Decision carries after routing: the Rule that matched and the Action it names. */
export interface Routing {
  rule: string | null;
  action: string | null;
}

/** One stale Rule, keyed by its id. `validateRules` is the only producer. */
export interface RuleProblem {
  rule: string;
  problem: string;
}

// Never throws: an answer that is missing, of the wrong runtime type or not a known value
// makes the condition false so the next Rule gets its turn.
function matches(answers: Answers, condition: ParsedCondition): boolean {
  const actual = answers[condition.question];
  if (actual === undefined) return false;
  if (condition.comparator === "is") return actual === condition.value;
  if (condition.comparator === "isOneOf") {
    return typeof actual === "string" && condition.value.includes(actual);
  }
  if (typeof actual !== "number") return false;
  return condition.comparator === "atLeast" ? actual >= condition.value : actual <= condition.value;
}

/** Pure, first match wins, no review gate. Cloud runs it again on corrected answers. */
export function evaluateRules(answers: Answers, rules: Rule[]): Routing {
  for (const rule of rules) {
    if (matches(answers, rule.condition)) return { rule: rule.id, action: rule.action };
  }
  return { rule: null, action: null };
}

/**
 * `NoInfer` keeps `Q` coming from the Decision alone, so an unannotated Rule literal is checked
 * against it instead of widening it. Inside a generic body TS cannot see that `Rule<Q>` narrows
 * `Rule`, so the public signature is an overload and the implementation is erased.
 */
export function routeDecision<Q extends Questions>(
  decision: Decision<Q>,
  rules: NoInfer<Rule<Q>>[],
): Decision<Q>;
export function routeDecision(decision: Decision, rules: Rule[]): Decision {
  if (decision.review) return { ...decision, rule: null, action: null };
  return { ...decision, ...evaluateRules(decision.answers, rules) };
}

const comparatorsFor = {
  choice: ["is", "isOneOf"],
  noul: ["is"],
  score: ["is", "atLeast", "atMost"],
} as const;

/** The portal's stale-Rule warning. Never runs inside `evaluateRules`. */
export function validateRules(rules: Rule[], recipe: Recipe): RuleProblem[] {
  const problems: RuleProblem[] = [];
  const seen = new Set<string>();

  for (const rule of rules) {
    const report = (problem: string): void => {
      problems.push({ rule: rule.id, problem });
    };

    if (seen.has(rule.id)) report(`duplicate id "${rule.id}"`);
    seen.add(rule.id);

    const { question, comparator, value } = rule.condition;
    const asked = recipe.questions[question];
    if (!asked) {
      report(`unknown question "${question}"`);
      continue;
    }

    if (!(comparatorsFor[asked.type] as readonly string[]).includes(comparator)) {
      report(`comparator "${comparator}" is not valid for a ${asked.type} question`);
      continue;
    }

    // `isOneOf` is the one comparator that carries several values; each is checked alone.
    for (const candidate of Array.isArray(value) ? value : [value]) {
      const problem = answerValueProblem(asked, candidate);
      if (problem !== null) report(problem);
    }
  }

  return problems;
}
