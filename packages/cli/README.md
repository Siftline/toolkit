# @siftline/cli

The Siftline command line: measure a Recipe against its Fixtures, then label for real.

```sh
npm install --save-dev @siftline/cli
export TYPESAFE_API_KEY=...

npx siftline test recipe.json fixtures.jsonl
npx siftline label recipe.json records.jsonl --rules rules.json > decisions.jsonl
```

```
support-inbox v1 · jev-1.13.0

category      4/5   0.80
wants_human   5/5   1.00

accuracy      0.80  (lowest question)
unsure        1 of 5 would go to Review

fixture:4  category: expected complaint, got question
```

`test` reports one accuracy per Question and fails CI with `--min-accuracy`. `label` writes
one Decision line per Record, routed through Rules when `--rules` is given. `npx siftline --help`
prints the rest.

The guide, the options and the exit codes live at
[docs.siftline.dev](https://docs.siftline.dev/docs/packages/cli).

ESM only. Node 22.14 or newer.

## Licence

MIT — see [LICENSE](./LICENSE).
