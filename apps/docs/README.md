# `@siftline/docs`

The Siftline documentation site: [Fumadocs](https://fumadocs.dev) on
[TanStack Start](https://tanstack.com/start), prerendered to static HTML and deployed to
`docs.siftline.dev` as Cloudflare static assets. Scaffolded from `create-fumadocs-app`'s
`tanstack-start-spa` template; lint and format come from the repo root, not from here.

## Scripts

| Script      | What it does                                                        |
| ----------- | ------------------------------------------------------------------- |
| `dev`       | Vite dev server on port 3000.                                       |
| `build`     | `vite build`, then copies `_shell.html` to `index.html`.            |
| `preview`   | `wrangler dev` over `.output/public`, the way Cloudflare serves it. |
| `test`      | Vitest assertions over the built `.output/public`.                  |
| `typecheck` | `tsc --noEmit`.                                                     |
| `lint`      | `oxlint --type-aware --deny-warnings`.                              |
| `deploy`    | `wrangler deploy`.                                                  |

## How the static build works

TanStack Start runs in SPA mode with prerendering and `crawlLinks`, so every page reachable
from `/` is written out as real HTML. Server functions are evaluated at build time by
`@tanstack/start-static-server-functions` and their results are baked into
`.output/public/__tsr/`, so nothing needs a server at request time.

Two details are load-bearing:

- **`_shell.html` is copied to `index.html`.** The prerender never writes a root
  `index.html`; it writes the SPA shell as `_shell.html`. Cloudflare's
  `not_found_handling: single-page-application` serves `/index.html` for any path that is
  not an uploaded asset, so without the copy every non-prerendered route 404s.
- **`public/.assetsignore` is tracked.** Vite copies `public/` verbatim into
  `.output/public/`, which is where wrangler looks for it. Nothing but `.assetsignore`,
  `_headers` and `_redirects` is excluded from upload by default, so this file is the only
  thing stopping a stray `wrangler.json` or `.dev.vars` from being served publicly.

Search is the static Orama index prerendered to `/api/search` (extensionless, served with no
content type). `llms.txt` and `llms-full.txt` are prerendered the same way.

URLs are canonical without a trailing slash (`html_handling: drop-trailing-slash`), which
matches the links TanStack Router generates. `/docs/` 307-redirects to `/docs`. If
prerendered nested pages ever stop resolving, the recorded fallback is flipping
`html_handling` to `auto-trailing-slash`.

## Deploys

Every push to `main` that passes `check` deploys this app: `ci.yml`'s `deploy` job builds it,
then hands `apps/docs` to `cloudflare/wrangler-action@v4`, which runs
`wrangler deploy --dry-run`, then `scripts/assert-no-secret-assets.sh`, then the real
`wrangler deploy`. The job is on its own concurrency group with `cancel-in-progress: false`:
an asset upload is not atomic, so deploys queue rather than interrupt each other.

**The Worker runs no code, so there is nothing to break at request time.** A bad deploy
cannot produce a 500 or a cold-start error; it can only fail the `deploy` job, or succeed and
serve the wrong HTML. The failure surface is the Actions log, not a runtime dashboard — there
are no logs to read after the fact because nothing executes. If the site ever does need a
server, the [SSR escape hatch](#escape-hatch-running-this-app-with-ssr) below is the recipe.

`scripts/assert-no-secret-assets.sh` runs against `.output/public`, the directory wrangler
actually uploads — _not_ against `wrangler deploy --dry-run --outdir`, which for an
assets-only Worker only ever contains the no-op Worker bundle. It refuses to deploy when
`.assetsignore` did not survive the build or when anything `.dev.vars`/`.env`/`wrangler.*`
shaped reached the output. Run it yourself after a build:

```sh
bun run build
./scripts/assert-no-secret-assets.sh
```

### The first deploy is done by a human, not by CI

`wrangler deploy` creates the `docs.siftline.dev` custom domain itself on first deploy —
the DNS record and the certificate too. Do not pre-create a CNAME.

Do that **first** deploy from a terminal, not by pushing to `main`. Interactively, wrangler
prompts before clobbering a conflicting DNS record or taking a custom domain away from
another Worker. In CI stdout is not a TTY, and wrangler then sets
`override_existing_dns_record: true` and `override_existing_origin: true` unconditionally and
silently — the prompts never appear and it overwrites whatever is there. Once the domain
exists and is attached to `siftline-docs`, later deploys are a no-op for DNS and CI is safe.

```sh
bun run build
./scripts/assert-no-secret-assets.sh
bun run deploy   # answer the prompts
```

## Escape hatch: running this app with SSR

Nothing runs on Cloudflare today — `wrangler.jsonc` has no `main`, and the Worker wrangler
substitutes is never reached. If the docs ever need a server (search on a real backend,
authenticated pages, on-demand rendering), the recipe is:

1. Add `@cloudflare/vite-plugin` to `vite.config.ts` **before** `tanstackStart()`. Order
   matters: the Cloudflare plugin has to see the environments the Start plugin registers.
2. Drop the `spa` block (or keep prerendering and add SSR alongside it) and let the build
   emit a server entry.
3. Add `"main"` to `wrangler.jsonc` pointing at that entry, and
   `"compatibility_flags": ["nodejs_compat"]`.
4. Keep `assets.directory`; the Asset Worker still serves the static files and falls through
   to the Worker for everything else.

Deliberately not wired: it costs a Worker invocation per request for a site that is entirely
static, and it puts code on a path that currently has none.
