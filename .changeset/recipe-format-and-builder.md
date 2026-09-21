---
"@siftline/core": minor
"@siftline/actions": patch
---

Add the Recipe format: `recipeSchema`, `questionSchema`, `parseRecipe`, `serializeRecipe`,
`defineRecipe` and the `choice`, `noul` and `score` helpers. `defineRecipe` keeps literal
labels and level indices; `serializeRecipe` is the only writer, so
`serializeRecipe(parseRecipe(text))` returns the same bytes.

Core's walking-skeleton `PLACEHOLDER` is gone. `@siftline/actions` folds in core's `VERSION`
instead.
