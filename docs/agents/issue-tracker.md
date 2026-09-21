# Issue tracker: Local Markdown

Issues and specs for this repo live as markdown files in `.scratch/`.

## Conventions

- One feature per directory: `.scratch/<feature-slug>/`
- The spec is `.scratch/<feature-slug>/spec.md`
- Implementation issues are one file per ticket at `.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01` — never a single combined tickets file
- Triage state is recorded as a `Status:` line near the top of each issue file (see `triage-labels.md` for the role strings)
- Comments and conversation history append to the bottom of the file under a `## Comments` heading

## When a skill says "publish to the issue tracker"

Create a new file under `.scratch/<feature-slug>/` (creating the directory if needed).

## When a skill says "fetch the relevant ticket"

Read the file at the referenced path. The user will normally pass the path or the issue number directly.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a file with one **child** file per ticket.

- **Map**: `.scratch/<effort>/map.md` — the Notes / Decisions-so-far / Fog body.
- **Child ticket**: `.scratch/<effort>/issues/NN-<slug>.md`, numbered from `01`, with the question in the body. A `Type:` line records the ticket type (`research`/`prototype`/`grilling`/`task`); a `Status:` line records `claimed`/`resolved`.
- **Blocking**: a `Blocked by: NN, NN` line near the top. A ticket is unblocked when every file it lists is `resolved`.
- **Frontier**: scan `.scratch/<effort>/issues/` for files that are open, unblocked, and unclaimed; first by number wins.
- **Claim**: set `Status: claimed` and save before any work.
- **Resolve**: append the answer under an `## Answer` heading, set `Status: resolved`, then append a context pointer (gist + link) to the map's Decisions-so-far in `map.md`.

## Handoffs from cloud

`Siftline/cloud` (sibling checkout at `../cloud`) hands work to this repo as a ticket in
its own tracker: `../cloud/.scratch/<feature>/issues/NN-toolkit-<slug>.md`, with
`Repo: toolkit` near the top. The session is started with that file's absolute path.

- The handoff file is the spec. Read it first; it links the cloud context it depends on.
- If `## Open questions` is not empty, grill before implementing, and append the
  decisions to the handoff file under `## Comments`.
- Implementation issues for the work live here, under `.scratch/<slug>/issues/`, with the
  spec being a pointer to the handoff file rather than a copy.
- `Delivery:` in the handoff says how cloud consumes the result: `publish` needs a
  changeset, `link` and `source` do not.
- Resolve in the handoff file, not only here: set `Status:` and append a dated comment with
  the commit, the published version if any, and any deviation from the ask.
