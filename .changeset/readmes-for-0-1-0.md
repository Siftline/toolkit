---
"@siftline/actions": patch
"@siftline/core": patch
---

Rewrite `@siftline/core`'s README for the 0.1.0 surface: Recipes, the Judge and its in-flight
gate, Rules and routing, Fixtures and the `TestReport`, the three file formats and the
`@siftline/core/testing` entry. No README claims a walking skeleton any more.

Record why `@siftline/actions` depends on zod directly: `Adapter<C>.configSchema` is a
`ZodType<C>`, so zod is in the package's public types and has to resolve from the package
itself.
