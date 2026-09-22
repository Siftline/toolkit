---
"@siftline/core": minor
---

Add a second type parameter to `Rule`: `Rule<Q, A extends string = string>`, with `action: A | null`.
Pass your Action ids as `A` and a Rule naming any other id fails to compile; `null` is always
allowed. The default keeps existing code and Rules read from JSON compiling unchanged, and
`routeDecision` accepts `Rule<Q, A>[]` as it is. `Decision` is not parameterised. Add an optional
third argument to `validateRules(rules, recipe, actionIds?)`: given a list, each non-null `action`
outside it is reported as `unknown Action "<id>"`, alongside the Recipe checks. Without the list it
behaves exactly as in 0.1.
