# `@typesafe-ai/sdk`: re-verification against the current release

Resolves `.scratch/toolkit-mvp/issues/01-sdk-current-facts.md`. Re-verified 2026-09-21.
Prior research: `../cloud/docs/research/typesafe-sdk-workers.md` (2026-09-18, SDK 0.6.0).

Verdict: **nothing changed.** The newest published version is still `0.6.0`, the tarball is
the same one the prior research inspected, and every fact re-checked below matches. Two
corrections are to the prior file's own citations, not to the facts: the helper declarations
sit at `dist/index.d.mts` lines 388-402 (the prior file said "~343-365"), and the answer
interfaces at lines 87-117 (prior "~95-130").

Sources:

- npm registry via `npm view @typesafe-ai/sdk` and `npm pack @typesafe-ai/sdk@latest`,
  extracted to `package/`. Line numbers below are for `package/dist/index.d.mts` (types)
  and `package/dist/index.mjs` (runtime).
- Live docs at https://docs.typesafe.ai/llms.txt, pages fetched with `.md` appended, all
  HTTP 200 on 2026-09-21.

## 1. Version and breaking changes

| Fact | Value | Source |
| --- | --- | --- |
| `dist-tags.latest` | `0.6.0` | `npm view @typesafe-ai/sdk dist-tags` |
| All versions | `0.0.0-bootstrap.0`, `0.5.7`, `0.6.0` | `npm view @typesafe-ai/sdk versions` |
| `time.0.6.0` | `2026-09-15T18:17:19.263Z`; `time.modified` is the same instant | `npm view @typesafe-ai/sdk time` |
| Tarball | 9 files, shasum `dbba30689e77c317e7619fbee006caa18f37a76a` | `npm view @typesafe-ai/sdk dist` |
| `engines` | `node >= 20`; no `dependencies` | `package/package.json` |
| `VERSION` | `"0.6.0"` | `index.d.mts` line 405; `index.mjs` line 390 |

Changelog (https://docs.typesafe.ai/sdk/javascript/changelog.md) lists only two entries:
v0.6.0 (2026-09-15, breaking: "accept `Score.criteria` as an ordered sequence instead of a
dictionary keyed by integers") and v0.5.7 (2026-09-11, initial public release). **No release
and no breaking change since 0.6.0.** Nothing has been published to npm since the prior
research ran.

## 2. Helper signatures (`index.d.mts` lines 388-402)

```ts
declare const noul:    (instructions?: EntryType, criteria?: NoulQuestion["criteria"]) => NoulQuestion;        // line 388
declare const score$1: <const T extends ScoreCriteria>(instructions: EntryType, criteria: T) => ScoreQuestion<T>; // line 395, exported as `score`
declare const choice:  <const T extends ChoiceCriteria>(instructions: EntryType, criteria: T) => ChoiceQuestion<T>; // line 402
```

JSDoc on each (lines 384-401): `noul` instructions default to `null`, criteria are
"Optional descriptions of the yes and no outcomes"; `score` criteria are "At least two
descriptions indexed by score from zero; entries may be `null`"; `choice` criteria are
"Labels mapped to descriptions, or `null` for undescribed labels". Confirmed unchanged
against https://docs.typesafe.ai/sdk/javascript/api/functions/{noul,score,choice}.md.

## 3. `systemOne` (`index.d.mts` line 299)

```ts
systemOne<const Q extends Questions>(request: SystemOneRequest<Q>, options?: RequestOptions): APIPromise<SystemOneResult<Q>>;
```

- `SystemOneRequest` (lines 147-154): `state: EntryType`, `questions: Q` (nonempty),
  `model?: string` ("omitted values inherit `defaultModel`").
- `SystemOneRequestPayload` (lines 156-158): same with `model: string` resolved; this is the
  body of `POST /v1/systemone` (`index.mjs` line 554).
- `RequestOptions` (lines 181-190): `signal?`, `timeout?` (per attempt, "there is no total
  retry budget"), `retry?: Partial<RetryPolicy>`, `headers?`.
- `SystemOneResult` (lines 128-135): `model: string`, `answers`, `usage: Usage`
  (`input_tokens`, `output_tokens`, lines 121-126).

Docs: https://docs.typesafe.ai/sdk/javascript/api/classes/TypeSafeClient.md. Unchanged.

## 4. Answer shapes (`index.d.mts` lines 87-117)

```ts
interface NoulResponse   { readonly type: "noul";   readonly noul: number; }                         // lines 87-91, NO confidence
interface ChoiceResponse<T> { readonly type: "choice"; readonly choice: keyof T & string;
                              readonly confidence: number; readonly probabilities: {...} }          // lines 93-101
interface ScoreResponse<T>  { readonly type: "score";  readonly score: number; readonly confidence: number;
                              readonly legend: ScoreLegend<T>; readonly probabilities: {...} }      // lines 107-117
```

**Noul still returns no `confidence`.** Confirmed in three places:
`index.d.mts` lines 87-91; https://docs.typesafe.ai/sdk/javascript/api/interfaces/NoulResponse.md
(only `noul` and `type`); https://docs.typesafe.ai/api.md line 223: "Choice and Score
answers also carry a `confidence` between 0 to 1, derived from the answer's probability
distribution." The `noul` value is "Probability of a yes answer, from zero to one".

`ScoreOf<T>` (line 103) yields tuple indices for a fixed-length rubric, otherwise `number`.

## 5. Retry defaults

`DEFAULT_RETRY_POLICY`, `index.mjs` lines 73-89; JSDoc defaults in `index.d.mts` lines
160-179; docs at https://docs.typesafe.ai/sdk/javascript/api/interfaces/RetryPolicy.md.
All three agree:

| Field | Default |
| --- | --- |
| `maxRetries` | 2 |
| `backoffInitialMs` | 500 |
| `backoffMaxMs` | 5000 |
| `backoffJitter` | 0.25 |
| `httpStatuses` | 408, 429, 500-599 (`range(500, 600)`, `index.mjs` line 82) |
| `respectRetryAfter` | true (`Retry-After` and `retry-after-ms`) |
| `maxRetryAfterMs` | 60000 |
| `apiConnectionError` | true |
| `apiTimeoutError` | true |

Per-attempt `timeout` default 10000 ms (`index.mjs` line 518: `config.timeout ?? 1e4`;
`index.d.mts` line 220-221). Backoff formula unchanged (`index.mjs` lines 114-119):
server `Retry-After` when present and `<= maxRetryAfterMs`, else
`min(backoffInitialMs * 2^attempt, backoffMaxMs) * (1 - random * backoffJitter)`.

## 6. `fetch` injection seam

- Type: `type Fetch = (input: string, init?: RequestInit) => Promise<Response>;`
  (`index.d.mts` line 192).
- Config: `fetch?: Fetch;` with JSDoc "Custom HTTP fetch implementation for transport
  configuration or tests. Default: global `fetch`." (`index.d.mts` lines 226-227; same text at
  https://docs.typesafe.ai/sdk/javascript/api/interfaces/TypeSafeClientConfig.md lines 73-79).
- Runtime: `const defaultFetch = (input, init) => globalThis.fetch(input, init);`
  (`index.mjs` line 401); constructor throws via `missingFetch()` when neither a custom
  `fetch` nor a global one exists (line 520) and stores `this.fetch = config.fetch ?? defaultFetch`
  (line 521); every attempt calls `this.fetch(url, {...})` (line 641).
- Endpoints hit: `POST /v1/systemone` (line 554) and `GET /v1/models` (line 365). Unchanged.

## 7. Model ids, rate limits, token budget

From https://docs.typesafe.ai/models.md (fetched 2026-09-21):

| Fact | Value |
| --- | --- |
| Current versioned model | `jev-1.13.0` (the only row under "Current models") |
| Aliases | `jev-latest` -> `jev-1.13.0`; `jev-preview` -> `jev-1.13.0` ("There is no preview build available right now") |
| SDK default model | `jev-latest` (`index.mjs` line 514; `index.d.mts` line 209) |
| Rate limits | 250,000 tokens per second / 1,200 requests per minute; over either returns `429`; "adjusting dynamically … can change without notice" |
| Context length | 64k tokens per request (`state` plus all questions); 32k tokens for `state` plus the single longest question |
| Price | $42 per Btok / $0.042 per Mtok, input tokens only; output tokens free |
| Input | Text only: string, JSON object, or array of text values |
| `GET /v1/models` | lists aliases only; versioned ids accepted by `model` regardless |

https://docs.typesafe.ai/api.md lines 333-338 still document `429` and `529 Overloaded`
and state the SDKs retry both by default. Unchanged from the prior research.

## 8. Implications for the toolkit specs

None of the prior file's recommendations need revising:

- Pin `"jev-1.13.0"` in the Recipe, pass it as `request.model`, assert `result.model`.
- Core's narrow interface stays `{ systemOne(req, opts?) }`; the `/testing` fake uses the
  `fetch` seam with `apiKey: "test"`, `logLevel: "off"`.
- Noul has no `confidence`; any Rule comparator over confidence applies to Choice and Score
  only. Noul rules threshold `noul` directly.
- The 32k `state`-plus-longest-question budget is the number the "trimming state" open
  question in the map must design against.

Re-run this check whenever `npm view @typesafe-ai/sdk time.modified` moves past
`2026-09-15T18:17:19.633Z` or the changelog page gains an entry.
