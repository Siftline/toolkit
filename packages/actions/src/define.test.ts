import { ActionBuildError, defineActions } from "@siftline/actions";
import { describe, expect, it } from "vitest";

// Imported by package name, not by relative path: this asserts the published `exports` map.

function defining() {
  return defineActions({
    good: { kind: "webhook", config: { url: "https://example.com/ok" } },
    tickets: { kind: "webhook", config: { url: "not a url" } },
  });
}

describe("defineActions", () => {
  it("keeps two Actions of the same kind apart by id", () => {
    const actions = defineActions({
      "linear-tickets": { kind: "webhook", config: { url: "https://example.com/tickets" } },
      escalations: {
        kind: "webhook",
        config: { url: "https://example.com/escalations", secret: "s3cret" },
      },
    });

    expect(actions).toEqual({
      "linear-tickets": { kind: "webhook", config: { url: "https://example.com/tickets" } },
      escalations: {
        kind: "webhook",
        config: { url: "https://example.com/escalations", secret: "s3cret" },
      },
    });
  });

  it("names the Action id and the problem when a config is invalid", () => {
    expect(defining).toThrow(ActionBuildError);
    expect(defining).toThrow(/^Action "tickets": config\.url: /);
  });

  it("rejects a key the kind's config does not have", () => {
    expect(() =>
      defineActions({
        alerts: {
          kind: "webhook",
          // @ts-expect-error — a webhook config has `url`, `secret` and `headers`, nothing else
          config: { url: "https://example.com/alerts", token: "t" },
        },
      }),
    ).toThrow(/^Action "alerts": config: /);
  });

  it("throws on an unknown Action kind, never retryable", () => {
    // Parsed JSON is `any`, so it reaches `defineActions` as a JavaScript caller's input would.
    const actions: Parameters<typeof defineActions>[0] = JSON.parse(
      '{ "mail": { "kind": "email", "config": { "to": "a@example.com" } } }',
    );

    expect(() => defineActions(actions)).toThrow(
      expect.objectContaining({
        name: "ActionBuildError",
        code: "action_build",
        retryable: false,
        message: 'Action "mail": unknown Action kind "email"',
      }),
    );
  });

  it("treats an inherited property as an unknown kind", () => {
    const actions: Parameters<typeof defineActions>[0] = JSON.parse(
      '{ "odd": { "kind": "toString", "config": {} } }',
    );

    expect(() => defineActions(actions)).toThrow('Action "odd": unknown Action kind "toString"');
  });

  it("rejects an empty Action id", () => {
    expect(() =>
      defineActions({ "": { kind: "webhook", config: { url: "https://example.com/" } } }),
    ).toThrow(ActionBuildError);
  });
});
