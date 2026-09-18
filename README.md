# Siftline toolkit

The open-source half of [Siftline](https://siftline.dev) — sort incoming text into your
categories, then act on it.

This repo holds the published packages and the documentation site. The hosted app lives
elsewhere and is not open source.

| Package | What it is |
| --- | --- |
| `@siftline/core` | The engine: recipes, rules, fixtures, and the judge wrapper. |
| `@siftline/cli` | `siftline` — run a recipe against fixtures from the terminal. |
| `@siftline/actions` | Adapters that carry a decision somewhere (webhook, Slack, email). |

Nothing is released yet. Docs will live at [docs.siftline.dev](https://docs.siftline.dev).

## Contributing

Issues are open. Pull requests are welcome under the
[Developer Certificate of Origin](https://developercertificate.org/) — sign off your
commits with `git commit -s`. There is no CLA.

## Licence

MIT — see [LICENSE](./LICENSE). "Siftline" is a project name, not a licence grant: forks
are free, the name is not.
