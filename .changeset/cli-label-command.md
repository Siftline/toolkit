---
"@siftline/cli": minor
---

Add `siftline label`, which judges real Records and writes Decisions.

`siftline label <recipe.json> [records.jsonl | -]` reads JSONL Records from a file or, with `-`
or no second positional, from stdin. Every line is parsed as a strict Record
`{ id, state, trimmed? }` before the first call, so a bad line exits 2 naming its 1-based number
with no request made. `trimmed` reaches the Decision untouched.

stdout carries exactly one `serializeDecision` line per Record in input order, held in a reorder
buffer over the `--max-in-flight` gate, whatever order the model answers in. Progress on stderr
is a `12/240` counter, rewritten in place on a TTY and one line per 50 otherwise, silenced by
`--quiet`.

`--rules <rules.json>` parses one JSON array through `ruleSchema`, exits 2 on any problem
`validateRules` reports, then routes each Decision with `routeDecision`. Without it `rule` and
`action` stay null. `label` refuses `--json` and `--min-accuracy`.

A `JudgeError` on one Record writes `<id>: <reason>` to stderr — "state over the token budget"
for `max_tokens_exceeded` — skips that Record and leaves the run exiting 1. Anything else, a
`JudgeExhaustedError` included, aborts the rest of the calls and ends the run. A SIGINT through
`deps.signal` aborts waiting and in-flight calls and exits 130.
