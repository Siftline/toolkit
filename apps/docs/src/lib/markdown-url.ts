import { createGetUrl } from "fumadocs-core/source";

import { docsRoute } from "./site";

// `getPageMarkdownUrl` and `decodeMarkdownUrl` are only ever correct as a pair.
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

export function decodeMarkdownUrl(segments: string[]) {
  const last = segments.at(-1);
  if (last === undefined) return [];

  const out = [...segments.slice(0, -1), last.replace(/\.md$/, "")];
  if (out.length === 1 && out[0] === "index") out.pop();
  return out;
}
