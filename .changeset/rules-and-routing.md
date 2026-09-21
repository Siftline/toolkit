---
"@siftline/core": minor
---

Add Rules: `ruleConditionSchema`, `ruleSchema`, `Rule<Q>`, `RuleCondition`, `Routing`,
`RuleProblem`, `evaluateRules`, `routeDecision` and `validateRules`. Six comparators, closed —
Choice `is`/`isOneOf`, Noul `is`, Score `is`/`atLeast`/`atMost` — with the condition schema a
strict discriminated union on `comparator`, so `value` is typed per comparator at parse time.

`evaluateRules(answers, rules)` is pure, first match wins, and never throws: a missing
Question, a runtime type mismatch and an unknown value each evaluate false and evaluation
continues. `routeDecision(decision, rules)` returns a copy and leaves `rule` and `action` null
when the Decision is under review. `validateRules(rules, recipe)` warns about stale Rules.

A Rule literal written against a `Recipe<Q>` has its question names, labels and level indices
checked at compile time.
