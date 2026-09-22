import { ActionFailedError, perform, webhook } from "@siftline/actions";
import type { ActionFetch, ActionFetchInit, ActionRequest } from "@siftline/actions";
import { beforeEach, describe, expect, it } from "vitest";

import { feedbackWidget, routedDecision } from "./fixtures";

const calls: { url: string; init: ActionFetchInit }[] = [];

let request: ActionRequest;

beforeEach(async () => {
  calls.length = 0;
  request = await webhook.build(
    routedDecision(),
    { url: "https://hooks.example.com/siftline" },
    feedbackWidget(),
  );
});

function responder(body: string | Uint8Array, status = 200): ActionFetch {
  return (url, init) => {
    calls.push({ url, init });

    return Promise.resolve(new Response(body, { status }));
  };
}

function rejecter(error: unknown): ActionFetch {
  return (url, init) => {
    calls.push({ url, init });

    return Promise.reject(error);
  };
}

describe("perform", () => {
  it("sends the built request as it stands", async () => {
    const signal = new AbortController().signal;
    const response = await perform(request, responder("ok"), { signal });

    expect(response).toEqual({ status: 200, body: "ok", truncated: false });
    expect(calls[0]?.url).toBe(request.url);
    expect(calls[0]?.init.method).toBe("POST");
    expect(calls[0]?.init.headers).toEqual(request.headers);
    expect(calls[0]?.init.body).toBe(request.body);
    expect(calls[0]?.init.signal).toBe(signal);
  });

  it("keeps a body of exactly the limit whole", async () => {
    const body = "a".repeat(4096);
    const response = await perform(request, responder(body));

    expect(response.truncated).toBe(false);
    expect(response.body).toBe(body);
  });

  it("cuts a longer body on a code-point boundary", async () => {
    // 4097 bytes: the byte at the 4096 limit is the second half of the final character.
    const response = await perform(request, responder(`${"a".repeat(4095)}é`));

    expect(response.truncated).toBe(true);
    expect(response.body).toBe("a".repeat(4095));
    expect(Buffer.byteLength(response.body, "utf8")).toBe(4095);
  });

  it("keeps a character that ends exactly on the limit", async () => {
    // 4098 bytes: the limit falls between two two-byte characters.
    const response = await perform(request, responder(`${"a".repeat(4094)}éé`));

    expect(response.truncated).toBe(true);
    expect(response.body).toBe(`${"a".repeat(4094)}é`);
    expect(Buffer.byteLength(response.body, "utf8")).toBe(4096);
  });

  it("fails on a non-2xx status, retryable only where redelivery can help", async () => {
    const cases = [
      [404, false],
      [400, false],
      [408, true],
      [429, true],
      [500, true],
      [503, true],
    ] as const;

    await Promise.all(
      cases.map(async ([status, retryable]) => {
        const sending = perform(request, responder("nope", status));

        await expect(sending).rejects.toBeInstanceOf(ActionFailedError);
        await expect(sending).rejects.toMatchObject({
          code: "action_failed",
          status,
          retryable,
        });
      }),
    );
  });

  it("fails retryably when fetch itself throws", async () => {
    const cause = new Error("ECONNRESET");
    const sending = perform(request, rejecter(cause));

    await expect(sending).rejects.toMatchObject({
      name: "ActionFailedError",
      code: "action_failed",
      status: null,
      retryable: true,
      cause,
    });
  });

  it("neither retries nor times out", async () => {
    await expect(perform(request, responder("nope", 500))).rejects.toThrow(ActionFailedError);

    expect(calls).toHaveLength(1);
  });
});
