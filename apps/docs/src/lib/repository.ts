/**
 * Where this site's source lives. Every GitHub link on the site is built from here, so
 * the coordinates appear once and a fork only has to change this file.
 */
export const repository = {
  owner: "Siftline",
  name: "toolkit",
  branch: "main",
} as const;

/** The repository's home page — the "GitHub" link in the site nav. */
export const repositoryUrl = `https://github.com/${repository.owner}/${repository.name}`;

/**
 * The GitHub blob URL for a page's own MDX file, which is what the "Edit on GitHub" view
 * option opens.
 *
 * @param contentPath - the page's path relative to `content/docs`, as Fumadocs reports it.
 */
export function contentSourceUrl(contentPath: string): string {
  return `${repositoryUrl}/blob/${repository.branch}/content/docs/${contentPath}`;
}
