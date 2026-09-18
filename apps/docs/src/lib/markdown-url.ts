import { createGetUrl } from "fumadocs-core/source";

import { docsRoute } from "./site";

/**
 * The codec for the `/docs/<slug>.md` routes: the plain-markdown twin of every docs page,
 * which the copy button links to and agents fetch. `getPageMarkdownUrl` encodes a page's
 * slugs into that URL; `decodeMarkdownUrl` is its inverse, used by the route handler to
 * get back to the page. They are only ever correct as a pair, so they live together.
 */
const getDocsUrl = createGetUrl(docsRoute);

export function getPageMarkdownUrl(page: { slugs: string[]; locale?: string }) {
  const segments = [...page.slugs];
  if (segments.length === 0) {
    segments.push("index.md");
  } else {
    segments[segments.length - 1] += ".md";
  }

  return { segments, url: getDocsUrl(segments, page.locale) };
}

/** @returns page slugs */
export function decodeMarkdownUrl(segments: string[]) {
  const last = segments.at(-1);
  if (last === undefined) return [];

  const out = [...segments.slice(0, -1), last.replace(/\.md$/, "")];
  if (out.length === 1 && out[0] === "index") out.pop();
  return out;
}
