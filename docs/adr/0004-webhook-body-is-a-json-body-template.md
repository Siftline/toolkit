# The webhook body is a JSON Body template

Date: 2026-09-24
Status: accepted

Webhook is the only Action kind (ADR 0002), and receivers such as Discord want their own JSON,
not the Decision line. So a webhook Action MAY carry a Body template: a string that MUST be valid
JSON, whose string values may hold variables from a closed set (`record.*`, `answers.*`,
`decision.id`, `recipe.name`, `rule`). The renderer walks the parsed template and substitutes
only in string values. A value that is exactly one variable becomes the typed value; a variable
inside other text becomes text, and `JSON.stringify` escapes it. A Record's quotes and newlines
cannot break the body, and no template can produce invalid JSON.

## Considered options

- String interpolation over the raw template. Rejected: one quote in a Record's text breaks the
  body, and escaping would fall to the author.
- A template language with filters and conditions. Rejected: logic belongs in Rules (ADR 0001),
  and a closed set can be checked at startup.
- The Engine's Record as the render context. Rejected: it has no sender or Source. `build` and
  `dispatch` take a `RecordContext` the caller supplies instead, required on every call.

## Consequences

- `defineActions` checks the JSON and every variable's grammar at startup. It never sees a
  Recipe, so it cannot check Question names: `build` rejects an `answers.<name>` the Recipe
  does not ask, with a non-retryable `ActionBuildError`, before anything is sent.
- An absent value is `null` on its own and `""` inside text. A Score answer renders as its level
  index, as Answers are (ADR 0003).
- The whole template is parsed and serialised again, so its other values are not kept byte for
  byte: whitespace is compacted, a repeated key keeps its last value, and a number JavaScript
  cannot hold exactly loses precision.
- The signature covers the rendered body. The idempotency key does not change.
- Without a Body template the body is the Decision line, and receivers keep using
  `parseDecision`.
