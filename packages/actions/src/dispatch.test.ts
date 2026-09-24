import {
  ActionBuildError,
  ActionFailedError,
  defineActions,
  dispatch,
  webhook,
} from "@siftline/actions";
import type { ActionFetch, ActionFetchInit } from "@siftline/actions";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { feedbackWidget, routedDecision, routedRecord } from "./fixtures";

// Imported by package name, not by relative path: this asserts the published `exports` map.

const calls: { url: string; init: ActionFetchInit }[] = [];

const actions = defineActions({
  act_revenue: { kind: "webhook", config: { url: "https://hooks.example.com/revenue" } },
  act_ticket: {
    kind: "webhook",
    config: { url: "https://hooks.example.com/siftline", secret: "shared-secret" },
  },
});

beforeEach(() => {
  calls.length = 0;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function responder(body: string, status = 200): ActionFetch {
  return (url, init) => {
    calls.push({ url, init });

    return Promise.resolve(new Response(body, { status }));
  };
}

function rejecter(error: Error): ActionFetch {
  return (url, init) => {
    calls.push({ url, init });

    return Promise.reject(error);
  };
}

describe("dispatch", () => {
  it("sends nothing for a Decision that went to Review", async () => {
    const decision = { ...routedDecision(), review: true };

    await expect(
      dispatch(decision, routedRecord(), actions, feedbackWidget(), { fetch: responder("ok") }),
    ).resolves.toBeNull();
    expect(calls).toHaveLength(0);
  });

  it("sends nothing for a Decision that selected no Action", async () => {
    const decision = { ...routedDecision(), action: null };

    await expect(
      dispatch(decision, routedRecord(), actions, feedbackWidget(), { fetch: responder("ok") }),
    ).resolves.toBeNull();
    expect(calls).toHaveLength(0);
  });

  it("throws for an Action id it was not given", async () => {
    const cases = ["act_pager", "toString"];

    await Promise.all(
      cases.map(async (id) => {
        const decision = { ...routedDecision(), action: id };

        const sending = dispatch(decision, routedRecord(), actions, feedbackWidget(), {
          fetch: responder("ok"),
        });

        await expect(sending).rejects.toBeInstanceOf(ActionBuildError);
        await expect(sending).rejects.toMatchObject({
          code: "action_build",
          retryable: false,
          message: `Decision ${decision.id} selected unknown Action "${id}"`,
        });
      }),
    );

    expect(calls).toHaveLength(0);
  });

  it("hands the Record to a Body template", async () => {
    const templated = defineActions({
      act_revenue: {
        kind: "webhook",
        config: {
          url: "https://hooks.example.com/revenue",
          body: '{ "content": "{{record.text}}" }',
        },
      },
    });

    await dispatch(routedDecision(), routedRecord(), templated, feedbackWidget(), {
      fetch: responder("ok"),
    });

    expect(calls.map((call) => JSON.parse(call.init.body))).toEqual([
      { content: 'Charged twice, "refund" now\nplease' },
    ]);
  });

  it("sends the webhook request build produces, once", async () => {
    const decision = { ...routedDecision(), action: "act_ticket" };
    const recipe = feedbackWidget();
    const built = await webhook.build(decision, routedRecord(), actions.act_ticket.config, recipe);

    const sent = await dispatch(decision, routedRecord(), actions, recipe, {
      fetch: responder("ok"),
    });

    expect(sent).toEqual({
      action: "act_ticket",
      request: built,
      response: { status: 200, body: "ok", truncated: false },
    });
    expect(built.headers["X-Siftline-Signature"]).toMatch(/^sha256=[0-9a-f]{64}$/);
    expect(built.idempotencyKey).toBe(`${decision.id}:act_ticket`);
    expect(calls).toEqual([
      { url: built.url, init: { method: "POST", headers: built.headers, body: built.body } },
    ]);
  });

  it("sends through the global fetch when none is passed", async () => {
    vi.stubGlobal("fetch", responder("ok"));

    await dispatch(routedDecision(), routedRecord(), actions, feedbackWidget());

    expect(calls).toHaveLength(1);
  });

  it("hands the signal to fetch", async () => {
    const signal = new AbortController().signal;

    await dispatch(routedDecision(), routedRecord(), actions, feedbackWidget(), {
      fetch: responder("ok"),
      signal,
    });

    expect(calls[0]?.init.signal).toBe(signal);
  });

  it("fails as perform does on a non-2xx status, without retrying", async () => {
    const cases = [
      [404, false],
      [408, true],
      [429, true],
      [503, true],
    ] as const;

    await Promise.all(
      cases.map(async ([status, retryable]) => {
        const sending = dispatch(routedDecision(), routedRecord(), actions, feedbackWidget(), {
          fetch: responder("nope", status),
        });

        await expect(sending).rejects.toBeInstanceOf(ActionFailedError);
        await expect(sending).rejects.toMatchObject({ code: "action_failed", status, retryable });
      }),
    );

    expect(calls).toHaveLength(cases.length);
  });

  it("fails retryably when fetch itself throws", async () => {
    const cause = new Error("ECONNRESET");

    const sending = dispatch(routedDecision(), routedRecord(), actions, feedbackWidget(), {
      fetch: rejecter(cause),
    });

    await expect(sending).rejects.toMatchObject({
      name: "ActionFailedError",
      code: "action_failed",
      status: null,
      retryable: true,
      cause,
    });
    expect(calls).toHaveLength(1);
  });
});
