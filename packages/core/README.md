# @siftline/core

The Siftline engine: recipes, rules, fixtures and the judge wrapper.

A Recipe is a document of Questions. The Judge answers them for one Record and returns a
Decision. Rules route that Decision to an Action. Fixtures measure the Recipe before any of it
runs on real text. Every one of those is data with a schema, a parser and a single writer.

```ts
import { choice, createJudge, defineRecipe, noul, serializeDecision } from "@siftline/core";

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

const judge = createJudge({ client, retry: "patient" });
const decision = await judge({ id: "msg-1", state: "…" }, recipe);

console.log(serializeDecision(decision));
```

`choice`, `noul` and `score` build the three Question types, and `defineRecipe` keeps their
literal labels and level indices: `decision.answers.category` is
`"complaint" | "question" | "other"`, not `string`.

## Recipes

`recipeSchema` and `questionSchema` validate a document that arrives from elsewhere.
`parseRecipe` and `serializeRecipe` are the only door to and from JSON, so
`serializeRecipe(parseRecipe(text))` returns the same bytes. `reviewThreshold` defaults to 0.7
in `defineRecipe`; `parseRecipe` never defaults it, so a document on disk carries it or fails to
parse.

## The Judge

`createJudge({ client, retry, maxInFlight, now })` returns `judge(record, recipe, { id, signal })`.
`client` is anything shaped like `SystemOneClient`, which core declares itself rather than
importing an SDK, so nothing here opens a socket of its own. `retry` is `"prompt"` or
`"patient"` and picks the retry policy and the per-attempt timeout. `maxInFlight` gates calls
FIFO and defaults to `DEFAULT_MAX_IN_FLIGHT`, which is 8.

A Decision carries the answers, one evidence block per Question — confidence, probabilities in
Recipe order, and a Score's expected value — the folded confidence, `review` when that
confidence is under the Recipe's threshold, the model that answered and its token usage. `rule`
and `action` come back null; routing fills them. `JudgeExhaustedError` carries `retryAfterMs`
and is the give-up on a 429 or a 529; every other failure is `JudgeError` with a `reason` and a
`status`. Both extend `SiftlineError`, whose `code` and `retryable` are what a caller maps to a
status of its own.

## Rules

A Rules file is a JSON array parsed by `ruleSchema`, over six comparators and no more: Choice
`is` and `isOneOf`, Noul `is`, Score `is`, `atLeast` and `atMost`. `evaluateRules(answers, rules)`
is pure, first match wins, and never throws — an answer that is missing or of the wrong type
makes the condition false and the next Rule gets its turn. `routeDecision(decision, rules)`
returns a copy with `rule` and `action` filled, and leaves both null on a Decision marked for
review. `validateRules(rules, recipe)` reports every Rule the Recipe no longer supports.

## Fixtures

A Fixture is `{ state, expect, id?, origin?, by? }` on one JSONL line, where `expect` is a
partial answer map: a Question left out of it is left out of that Question's denominator.
`parseFixture`, `parseFixtures` and `serializeFixture` are the format's door, and
`defineFixtures(recipe, fixtures)` writes a set in TypeScript, validates it against the
Recipe and returns each `expect` in Recipe order. `testRecipe(judge, recipe, fixtures)` judges them all through the gate and
returns a `TestReport`: one entry per Fixture with its mismatches and its review flag,
accuracy per Question, and the lowest Question accuracy as the report's own. `scoreResults` is
the pure half when you already hold the Decisions, and `compareAnswers` the single-Fixture
comparison.

## File formats

Three formats, each with one strict schema and one serializer as its only writer: the Recipe
document, the Decision line and the Fixture line. `format: 1` marks the first two; a Fixture
carries none. A Rules file is a plain JSON array with no writer of its own. A breaking change to
a format bumps its number.

## `@siftline/core/testing`

The second entry, for tests. `createScriptedClient` answers in call order, `createReplayClient`
matches a request deep-equal against recorded lines and replays the recorded answer or throws
the recorded error, and `createRecordingClient(inner, sink, options?)` wraps a real client to
produce those lines; `options.id` and `options.now` pin the line id and clock for a
byte-stable recording. `replayLineSchema` and `parseReplayLines` are their JSONL door. Nothing in this entry reaches
the network.

ESM only. Node 22.14 or newer.

## Licence

MIT — see [LICENSE](./LICENSE).
