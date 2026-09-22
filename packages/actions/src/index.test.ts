import {
  ActionBuildError,
  ActionFailedError,
  adapters,
  defineActions,
  dispatch,
  perform,
  slackIncomingWebhook,
  VERSION,
  webhook,
} from "@siftline/actions";
import { SiftlineError } from "@siftline/core";
import { expect, it } from "vitest";

// Imported by package name, not by relative path: this asserts the published `exports` map.

it("reports the package version", () => {
  expect(VERSION).toMatch(/^\d+\.\d+\.\d+/);
});

it("exposes the adapters, the performer and the dispatcher", () => {
  expect(perform).toBeTypeOf("function");
  expect(defineActions).toBeTypeOf("function");
  expect(dispatch).toBeTypeOf("function");
  expect(webhook.kind).toBe("webhook");
  expect(slackIncomingWebhook.kind).toBe("slack_incoming_webhook");
  expect(Object.values(adapters)).toHaveLength(2);
});

it("puts both errors under the toolkit taxonomy", () => {
  const build = new ActionBuildError("no Action");
  const failed = new ActionFailedError("404", 404, false);

  expect(build).toBeInstanceOf(SiftlineError);
  expect(failed).toBeInstanceOf(SiftlineError);
  expect(build.code).toBe("action_build");
  expect(failed.code).toBe("action_failed");
  expect(build.retryable).toBe(false);
  expect(failed.status).toBe(404);
});
