import { createFileRoute, Link } from "@tanstack/react-router";
import { HomeLayout } from "fumadocs-ui/layouts/home";

import { baseOptions } from "@/lib/layout.shared";

export const Route = createFileRoute("/")({
  component: Home,
});

const packages = [
  {
    name: "@siftline/core",
    summary: "The Engine: recipes, rules, fixtures and the judge wrapper.",
  },
  { name: "@siftline/cli", summary: "The siftline bin: run a recipe over fixtures, label a set." },
  { name: "@siftline/actions", summary: "Adapters that turn a decision into something happening." },
];

function Home() {
  return (
    <HomeLayout {...baseOptions()}>
      <main className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-16 text-center">
        <div className="flex flex-col gap-4">
          <h1 className="text-3xl font-medium">Siftline toolkit</h1>
          <p className="max-w-xl text-fd-muted-foreground">
            Turn messy inbound text into decisions you can act on, with a toolchain that runs the
            same way on your laptop and in CI.
          </p>
        </div>
        <ul className="grid w-full max-w-3xl gap-4 text-left sm:grid-cols-3">
          {packages.map((pkg) => (
            <li key={pkg.name} className="rounded-lg border p-4">
              <p className="font-mono text-sm font-medium">{pkg.name}</p>
              <p className="mt-2 text-sm text-fd-muted-foreground">{pkg.summary}</p>
            </li>
          ))}
        </ul>
        <Link
          to="/docs/$"
          params={{ _splat: "" }}
          className="rounded-lg bg-fd-primary px-3 py-2 text-sm font-medium text-fd-primary-foreground"
        >
          Read the docs
        </Link>
      </main>
    </HomeLayout>
  );
}
