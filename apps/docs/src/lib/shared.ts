import { createGetUrl } from "fumadocs-core/source";

export const appName = "Siftline";
export const docsRoute = "/docs";
export const docsImageRoute = "/og/docs";

export const gitConfig = {
  user: "Siftline",
  repo: "toolkit",
  branch: "main",
};

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
