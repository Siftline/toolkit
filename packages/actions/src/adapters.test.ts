import { adapters, webhook } from "@siftline/actions";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

import { feedbackWidget, routedDecision } from "./fixtures";

const config = { url: "https://hooks.example.com/siftline", secret: "test-secret" };

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("adapters", () => {
  it("is keyed by cloud's action kinds", () => {
    expect(Object.keys(adapters)).toEqual(["webhook"]);
    expect(adapters.webhook.kind).toBe("webhook");
  });

  it("rejects a config with no url", () => {
    for (const adapter of Object.values(adapters)) {
      expect(() => adapter.configSchema.parse({})).toThrow(ZodError);
      expect(() => adapter.configSchema.parse({ url: "not a url" })).toThrow(ZodError);
      expect(() => adapter.configSchema.parse({ url: "https://x.example/hook" })).not.toThrow();
    }
  });
});

describe("determinism", () => {
  it("builds deep-equal requests across a moved clock and unused randomness", async () => {
    const randomUUID = vi.spyOn(globalThis.crypto, "randomUUID");
    vi.useFakeTimers();

    vi.setSystemTime(new Date("2026-09-21T14:03:11.204Z"));
    const first = await webhook.build(routedDecision(), config, feedbackWidget());

    vi.setSystemTime(new Date("2031-05-04T09:00:00.000Z"));
    const second = await webhook.build(routedDecision(), config, feedbackWidget());

    expect(second).toEqual(first);
    expect(second.idempotencyKey).toBe(first.idempotencyKey);
    expect(randomUUID).not.toHaveBeenCalled();
  });
});
