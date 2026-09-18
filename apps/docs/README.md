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
