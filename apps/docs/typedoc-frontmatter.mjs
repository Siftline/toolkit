import { MarkdownPageEvent } from "typedoc-plugin-markdown";

/** Only `title`-shaped scalars are ever set here, so a quoted JSON string is valid YAML. */
const toYaml = (frontmatter) =>
  [
    "---",
    ...Object.entries(frontmatter).map(
      ([key, value]) => `${key}: ${JSON.stringify(String(value))}`,
    ),
    "---",
    "",
  ].join("\n");

export function load(app) {
  app.renderer.on(MarkdownPageEvent.BEGIN, (page) => {
    // The root page's name is the package name, never "index" — discriminate on the variant.
    const isRoot = page.model?.variant === "project";

    page.frontmatter = {
      title: isRoot ? "API Reference" : (page.model?.name ?? "API"),
      ...page.frontmatter,
    };
  });

  app.renderer.on(MarkdownPageEvent.END, (page) => {
    if (!page.frontmatter) return;

    page.contents = toYaml(page.frontmatter) + (page.contents ?? "");
  });
}
