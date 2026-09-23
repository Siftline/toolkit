import {
  ActionBuildError,
  ActionFailedError,
  defineActions,
  dispatch,
  slackIncomingWebhook,
  webhook,
} from "@siftline/actions";
import type { ActionFetch, ActionFetchInit } from "@siftline/actions";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { feedbackWidget, routedDecision } from "./fixtures";

// Imported by package name, not by relative path: this asserts the published `exports` map.

const calls: { url: string; init: ActionFetchInit }[] = [];

const actions = defineActions({
  act_slack_revenue: {
    kind: "slack_incoming_webhook",
    config: { url: "https://hooks.slack.com/services/T0/B0/X" },
  },
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
      dispatch(decision, actions, feedbackWidget(), { fetch: responder("ok") }),
    ).resolves.toBeNull();
    expect(calls).toHaveLength(0);
  });

  it("sends nothing for a Decision that selected no Action", async () => {
    const decision = { ...routedDecision(), action: null };

    await expect(
      dispatch(decision, actions, feedbackWidget(), { fetch: responder("ok") }),
    ).resolves.toBeNull();
    expect(calls).toHaveLength(0);
  });

  it("throws for an Action id it was not given", async () => {
    const cases = ["act_pager", "toString"];

    await Promise.all(
      cases.map(async (id) => {
        const decision = { ...routedDecision(), action: id };
        const sending = dispatch(decision, actions, feedbackWidget(), { fetch: responder("ok") });

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

  it("sends the Slack request build produces, once", async () => {
    const decision = routedDecision();
    const recipe = feedbackWidget();

    const built = await slackIncomingWebhook.build(
      decision,
      actions.act_slack_revenue.config,
      recipe,
    );

    const sent = await dispatch(decision, actions, recipe, { fetch: responder("ok") });

    expect(sent).toEqual({
      action: "act_slack_revenue",
      request: built,
      response: { status: 200, body: "ok", truncated: false },
    });
    expect(calls).toEqual([
      { url: built.url, init: { method: "POST", headers: built.headers, body: built.body } },
    ]);
  });

  it("sends the webhook request build produces, once", async () => {
    const decision = { ...routedDecision(), action: "act_ticket" };
    const recipe = feedbackWidget();
    const built = await webhook.build(decision, actions.act_ticket.config, recipe);

    const sent = await dispatch(decision, actions, recipe, { fetch: responder("ok") });

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

    await dispatch(routedDecision(), actions, feedbackWidget());

    expect(calls).toHaveLength(1);
  });

  it("hands the signal to fetch", async () => {
    const signal = new AbortController().signal;

    await dispatch(routedDecision(), actions, feedbackWidget(), {
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
        const sending = dispatch(routedDecision(), actions, feedbackWidget(), {
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

    const sending = dispatch(routedDecision(), actions, feedbackWidget(), {
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
