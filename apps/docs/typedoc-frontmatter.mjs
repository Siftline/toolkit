import { mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, posix } from "node:path";

import { Converter, ReflectionKind, ReflectionType, RendererEvent, UnionType } from "typedoc";
import { MarkdownPageEvent } from "typedoc-plugin-markdown";

const SITE_BASE = "/docs/api";

/** The entry files in `api-entries/` are named after the module; these are the sidebar titles. */
const MODULE_TITLES = {
  core: "@siftline/core",
  "core-testing": "@siftline/core/testing",
  actions: "@siftline/actions",
};

const KIND_TITLES = {
  classes: "Classes",
  functions: "Functions",
  interfaces: "Interfaces",
  "type-aliases": "Type aliases",
  variables: "Variables",
};

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

/** `../interfaces/Questions.mdx` from `core/functions/defineRecipe.mdx` → `/docs/api/core/interfaces/Questions`. */
function toSiteUrl(pageUrl, target) {
  const resolved = posix.normalize(posix.join(posix.dirname(pageUrl), target));
  const withoutExtension = resolved.replace(/\.mdx$/, "").replace(/(^|\/)index$/, "");

  return withoutExtension === "" ? SITE_BASE : `${SITE_BASE}/${withoutExtension}`;
}

function rewriteLinks(pageUrl, contents) {
  return contents.replace(/\]\(([^)\s]+\.mdx)(#[^)]*)?\)/g, (_match, target, hash = "") => {
    return `](${toSiteUrl(pageUrl, target)}${hash})`;
  });
}

function writeMeta(dir, meta) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "meta.json"), `${JSON.stringify(meta, null, 2)}\n`);
}

export function load(app) {
  // typedoc-plugin-markdown renders a union member's own JSDoc only when some member is an object
  // literal. For a union of literals, such as `RetryMode`, list them under the alias's comment.
  app.converter.on(Converter.EVENT_RESOLVE_END, (context) => {
    for (const alias of context.project.getReflectionsByKind(ReflectionKind.TypeAlias)) {
      const { type, comment } = alias;

      if (!(type instanceof UnionType) || !type.elementSummaries || !comment) continue;

      if (type.types.some((member) => member instanceof ReflectionType)) continue;

      type.types.forEach((member, i) => {
        const summary = type.elementSummaries[i];

        if (!summary?.length) return;

        comment.summary.push(
          { kind: "text", text: "\n\n- " },
          { kind: "code", text: `\`${member.toString()}\`` },
          { kind: "text", text: ": " },
          ...summary,
        );
      });
    }
  });

  app.renderer.on(MarkdownPageEvent.BEGIN, (page) => {
    // The root page's name is the package name, never "index" — discriminate on the variant.
    const isRoot = page.model?.variant === "project";
    const name = page.model?.name ?? "API";

    page.frontmatter = {
      title: isRoot ? "API reference" : (MODULE_TITLES[name] ?? name),
      ...page.frontmatter,
    };
  });

  app.renderer.on(MarkdownPageEvent.END, (page) => {
    if (!page.frontmatter) return;

    page.contents = toYaml(page.frontmatter) + rewriteLinks(page.url, page.contents ?? "");
  });

  // Fumadocs titles a folder by its name unless a meta.json says otherwise.
  app.renderer.on(RendererEvent.END, (event) => {
    const out = event.outputDirectory;
    writeMeta(out, {
      title: "API reference",
      icon: "Code",
      pages: ["index", ...Object.keys(MODULE_TITLES)],
    });

    for (const [module, title] of Object.entries(MODULE_TITLES)) {
      const moduleDir = join(out, module);

      if (!statSync(moduleDir, { throwIfNoEntry: false })?.isDirectory()) continue;
      writeMeta(moduleDir, { title, pages: ["index", "..."] });

      for (const kind of readdirSync(moduleDir)) {
        const kindDir = join(moduleDir, kind);

        if (!statSync(kindDir).isDirectory()) continue;
        writeMeta(kindDir, { title: KIND_TITLES[kind] ?? kind });
      }
    }
  });
}
