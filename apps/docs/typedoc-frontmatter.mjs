import { MarkdownPageEvent } from "typedoc-plugin-markdown";

/**
 * Fumadocs reads a page's `title` from YAML frontmatter, and typedoc-plugin-markdown emits
 * none. The plugin's `MarkdownPageEvent` carries a `frontmatter` field, but nothing in
 * 4.13.1 serialises it — it is an inter-plugin contract honoured only by the separate
 * `typedoc-plugin-frontmatter` package. So we fill it at BEGIN, keeping the shape any other
 * plugin would expect, and prepend it to the rendered page ourselves at END.
 */

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
    // The root page's model is the project itself, and its name is the package name, never
    // the string "index" — discriminate on the variant instead.
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
