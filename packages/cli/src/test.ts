import { createJudge, testRecipe } from "@siftline/core";

import type { RunDeps } from "./deps";
import { UsageError, writeLine } from "./deps";
import { readFixturesFile, readRecipeFile } from "./input";
import { parseTestArgs } from "./options";
import { progressLines, renderReport, watchDrift } from "./report";

export async function runTest(args: readonly string[], deps: RunDeps): Promise<number> {
  const { positionals, options } = parseTestArgs(args);

  const [recipePath, fixturesPath] = positionals;
  if (recipePath === undefined || fixturesPath === undefined) {
    throw new UsageError("test needs a recipe and a fixtures file");
  }
  if (positionals.length > 2) {
    throw new UsageError(`test takes two positionals, not ${positionals.length}`);
  }

  const recipe = await readRecipeFile(recipePath);
  const fixtures = await readFixturesFile(fixturesPath, recipe);
  const order = Object.keys(recipe.questions);

  const judge = createJudge({
    client: deps.client,
    retry: "patient",
    maxInFlight: options.maxInFlight,
  });

  const drift = watchDrift(recipe.model, deps.stderr);

  const report = await testRecipe(judge, recipe, fixtures, {
    signal: deps.signal,
    onResult: (result) => {
      drift.note(result.decision.model);
      if (options.quiet) return;
      for (const line of progressLines(result, order)) writeLine(deps.stderr, line);
    },
  });

  if (options.json) {
    writeLine(deps.stdout, JSON.stringify({ ...report, drift: drift.message }, null, 2));
  } else {
    writeLine(deps.stdout, renderReport(report, order));
  }

  const floor = options.minAccuracy;
  if (floor === null) return 0;

  if (report.accuracy === null) {
    writeLine(
      deps.stderr,
      `siftline: no Question was asserted, so there is no accuracy to meet --min-accuracy ${floor}`,
    );
    return 1;
  }

  if (report.accuracy < floor) {
    writeLine(
      deps.stderr,
      `siftline: accuracy ${report.accuracy.toFixed(2)} is below --min-accuracy ${floor}`,
    );
    return 1;
  }

  return 0;
}
