import type { AnswerValue, FixtureResult, Mismatch, TestReport } from "@siftline/core";

import type { OutputStream } from "./deps";
import { writeLine } from "./deps";

const NA = "n/a";

/** Wide enough for `0.00` plus the gap before the note beside it. */
const RATIO_COLUMN = 6;

/** Warns on stderr the first time a Decision names a model other than the Recipe's. */
export interface DriftWatch {
  note: (decisionModel: string) => void;
  readonly message: string | null;
}

export function watchDrift(recipeModel: string, stderr: OutputStream): DriftWatch {
  let message: string | null = null;

  return {
    note: (decisionModel) => {
      if (message !== null || decisionModel === recipeModel) return;
      message = `model drift: the Recipe asks for ${recipeModel}, the Decisions came back from ${decisionModel}`;
      writeLine(stderr, `siftline: ${message}`);
    },
    get message() {
      return message;
    },
  };
}

/** One line per result, or one per miss. `order` is the Recipe's Question order. */
export function progressLines(result: FixtureResult, order: readonly string[]): string[] {
  if (result.mismatches.length === 0) return [`ok ${result.id}`];

  return inOrder(result.mismatches, order).map(
    (miss) => `miss ${result.id} ${describeMismatch(miss)}`,
  );
}

export function renderReport(report: TestReport, order: readonly string[]): string {
  const rows = Object.entries(report.questions).map(([question, tally]) => ({
    question,
    counts: tally.asserted === 0 ? NA : `${tally.matched}/${tally.asserted}`,
    accuracy: ratio(tally.accuracy),
  }));

  const labels =
    Math.max(...rows.map((row) => row.question.length), "accuracy".length, "unsure".length) + 3;

  const counts = Math.max(...rows.map((row) => row.counts.length), NA.length) + 3;

  const lines = [
    `${report.recipe.name} v${report.recipe.version} · ${report.model === "" ? NA : report.model}`,
    "",
    ...rows.map(
      (row) => `${row.question.padEnd(labels)}${row.counts.padEnd(counts)}${row.accuracy}`,
    ),
    "",
    `${"accuracy".padEnd(labels)}${ratio(report.accuracy).padEnd(RATIO_COLUMN)}(lowest question)`,
    `${"unsure".padEnd(labels)}${unsure(report)} of ${report.fixtures.length} would go to Review`,
  ];

  const misses = report.fixtures.flatMap((result) =>
    inOrder(result.mismatches, order).map((miss) => `${result.id}  ${describeMismatch(miss)}`),
  );

  if (misses.length > 0) lines.push("", ...misses);

  return lines.join("\n");
}

function unsure(report: TestReport): number {
  return report.fixtures.filter((result) => result.review).length;
}

function ratio(value: number | null): string {
  return value === null ? NA : value.toFixed(2);
}

function describeMismatch(miss: Mismatch): string {
  return `${miss.question}: expected ${show(miss.expected)}, got ${show(miss.actual)}`;
}

function show(value: AnswerValue | undefined): string {
  return value === undefined ? "nothing" : String(value);
}

// `mismatches` arrive in `expect` insertion order, which is the Fixture author's, not the
// Recipe's. Sorting makes the report read the same whatever order the file was written in.
function inOrder(mismatches: readonly Mismatch[], order: readonly string[]): Mismatch[] {
  return mismatches.toSorted((a, b) => order.indexOf(a.question) - order.indexOf(b.question));
}
