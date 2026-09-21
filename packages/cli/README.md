# @siftline/cli

The Siftline command line: measure a recipe against its fixtures, then label for real.

`siftline test` runs a Recipe against a JSONL file of Fixtures and reports one accuracy per
Question, the fold, the unsure count and the misses. `siftline label` runs the same Recipe over
real Records and writes one Decision line per Record.

```sh
export TYPESAFE_API_KEY=...
npx @siftline/cli test recipe.json fixtures.jsonl
```

```
support-inbox v1 · jev-1.13.0

category      4/5   0.80
wants_human   5/5   1.00

accuracy      0.80  (lowest question)
unsure        1 of 5 would go to Review

fixture:4  category: expected complaint, got question
```

`--json` prints the `TestReport` plus a top-level `drift`, `--min-accuracy <ratio>` fails CI on
the lowest Question accuracy, `--max-in-flight <n>` sets the gate width and `--quiet` silences
progress. `npx @siftline/cli --help` prints the rest.

`label` takes Records as JSONL — `{ "id": "…", "state": …, "trimmed": false }` — from a file or,
with `-` or no second positional, from stdin. Every line is parsed before the first call, so a
bad line costs nothing. Decisions come back on stdout in input order, whatever order the model
answers in, and a Record the model refuses is named on stderr and skipped.

```sh
npx @siftline/cli label recipe.json records.jsonl --rules rules.json > decisions.jsonl
```

`--rules <rules.json>` takes one JSON array of Rules, refuses any that no longer fit the Recipe
and routes every Decision through them. Without it `rule` and `action` stay null.

Exit codes: `0` success, `1` work that ran and failed, `2` usage and input errors, `130` after
a SIGINT.

The library door is `run(argv, deps)`, where `deps` is
`{ client, stdin, stdout, stderr, env, signal }`. The bin is a wrapper around it.

ESM only. Node 22.14 or newer.

## Licence

MIT — see [LICENSE](./LICENSE).
