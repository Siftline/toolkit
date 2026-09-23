import { ActionBuildError, VERSION, webhook } from "@siftline/actions";
import { serializeDecision } from "@siftline/core";
import { describe, expect, it } from "vitest";

// `hmacSha256Hex` is package-internal, like core's `questionName`. The pinned vector's body
// is the reference Decision line, which no `build` can produce: it carries no Action.
import { hmacSha256Hex } from "./adapter";
import { feedbackWidget, referenceDecision, referenceLine, routedDecision } from "./fixtures";

const url = "https://hooks.example.com/siftline";

describe("the HMAC vector", () => {
  it("signs the reference Decision line with the pinned secret", async () => {
    expect(await hmacSha256Hex("test-secret", referenceLine)).toBe(
      "92936bbe69da3da8da642edaa6094a71b0f1dbb77c48d680d9f3d23e53143f39",
    );
  });
});

describe("webhook.build", () => {
  it("POSTs the Decision line with no envelope", async () => {
    const decision = routedDecision();
    const request = await webhook.build(decision, { url }, feedbackWidget());

    expect(request.method).toBe("POST");
    expect(request.url).toBe(url);
    expect(request.body).toBe(serializeDecision(decision));
  });

  it("derives the idempotency key from the Decision and its Action", async () => {
    const request = await webhook.build(routedDecision(), { url }, feedbackWidget());

    expect(request.idempotencyKey).toBe("0192f3c2-7b1e-7c4a-9f0e-3a1b2c3d4e5f:act_revenue");
    expect(request.headers["Idempotency-Key"]).toBe(request.idempotencyKey);
  });

  it("writes the headers in the spec's order, extras before the signature", async () => {
    const request = await webhook.build(
      routedDecision(),
      { url, secret: "test-secret", headers: { "X-Tenant": "acme" } },
      feedbackWidget(),
    );

    expect(Object.keys(request.headers)).toEqual([
      "Content-Type",
      "Idempotency-Key",
      "User-Agent",
      "X-Tenant",
      "X-Siftline-Signature",
    ]);
    expect(request.headers["Content-Type"]).toBe("application/json");
    expect(request.headers["User-Agent"]).toBe(`siftline-actions/${VERSION}`);
    expect(request.headers["X-Siftline-Signature"]).toBe(
      `sha256=${await hmacSha256Hex("test-secret", request.body)}`,
    );
  });

  it("signs only when a secret is configured", async () => {
    const request = await webhook.build(routedDecision(), { url }, feedbackWidget());

    expect(request.headers["X-Siftline-Signature"]).toBeUndefined();
  });

  it("refuses a Decision that selected no Action", async () => {
    const build = webhook.build(referenceDecision(), { url }, feedbackWidget());

    await expect(build).rejects.toBeInstanceOf(ActionBuildError);
    await expect(build).rejects.toMatchObject({
      name: "ActionBuildError",
      code: "action_build",
      retryable: false,
    });
  });
});
