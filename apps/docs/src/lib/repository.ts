/** The coordinates appear once: a fork only has to change this file. */
export const repository = {
  owner: "Siftline",
  name: "toolkit",
  branch: "main",
} as const;

export const repositoryUrl = `https://github.com/${repository.owner}/${repository.name}`;

export function contentSourceUrl(contentPath: string): string {
  return `${repositoryUrl}/blob/${repository.branch}/content/docs/${contentPath}`;
}
