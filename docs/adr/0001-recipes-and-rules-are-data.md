# Recipes and Rules are data; code builders produce the same data

Date: 2026-09-21
Status: accepted

A Recipe written by the hosted wizard must round-trip to a file without loss, be stored by
version in the app's database, and be read by the CLI. So the canonical Recipe is a JSON
document validated by a zod schema exported from `@siftline/core`. `defineRecipe()` is a
typed builder for the code door: it returns that same object with literal answer types and
adds nothing the JSON cannot express. Rules follow the same rule: a Rule is a data structure
over a closed set of comparators, evaluated by the Engine; a Rule is never a function.

## Considered options

- A TypeScript module as the canonical form, serialised by the app. Rejected: the app would
  have to evaluate or parse code, and the wizard could not round-trip it.
- Predicate-function Rules for code users. Rejected: cannot be stored, versioned or shown in a
  UI. Code users who need more branch on the Decision themselves.
- YAML. Rejected: a parser dependency in a published package for no gain over JSON.
