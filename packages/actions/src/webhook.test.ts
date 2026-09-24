import { ActionBuildError, VERSION, webhook } from "@siftline/actions";
import { serializeDecision } from "@siftline/core";
import { describe, expect, it } from "vitest";

// `hmacSha256Hex` is package-internal, like core's `questionName`. The pinned vector's body
// is the reference Decision line, which no `build` can produce: it carries no Action.
import { hmacSha256Hex } from "./adapter";
import {
  feedbackWidget,
  referenceDecision,
  referenceLine,
  routedDecision,
  routedRecord,
} from "./fixtures";

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
    const request = await webhook.build(decision, routedRecord(), { url }, feedbackWidget());

    expect(request.method).toBe("POST");
    expect(request.url).toBe(url);
    expect(request.body).toBe(serializeDecision(decision));
  });

  it("derives the idempotency key from the Decision and its Action", async () => {
    const request = await webhook.build(
      routedDecision(),
      routedRecord(),
      { url },
      feedbackWidget(),
    );

    expect(request.idempotencyKey).toBe("0192f3c2-7b1e-7c4a-9f0e-3a1b2c3d4e5f:act_revenue");
    expect(request.headers["Idempotency-Key"]).toBe(request.idempotencyKey);
  });

  it("writes the headers in the spec's order, extras before the signature", async () => {
    const request = await webhook.build(
      routedDecision(),
      routedRecord(),
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
    const request = await webhook.build(
      routedDecision(),
      routedRecord(),
      { url },
      feedbackWidget(),
    );

    expect(request.headers["X-Siftline-Signature"]).toBeUndefined();
  });

  it("refuses a Decision that selected no Action", async () => {
    const build = webhook.build(referenceDecision(), routedRecord(), { url }, feedbackWidget());

    await expect(build).rejects.toBeInstanceOf(ActionBuildError);
    await expect(build).rejects.toMatchObject({
      name: "ActionBuildError",
      code: "action_build",
      retryable: false,
    });
  });
});

describe("webhook.build with a Body template", () => {
  it("escapes a variable inside other text, so quotes and newlines keep the JSON whole", async () => {
    const body = '{ "content": "New from {{ record.sender }}: {{record.text}}" }';

    const request = await webhook.build(
      routedDecision(),
      routedRecord(),
      { url, body },
      feedbackWidget(),
    );

    expect(JSON.parse(request.body)).toEqual({
      content: 'New from ana@example.com: Charged twice, "refund" now\nplease',
    });
  });

  it("keeps a whole-value variable typed and leaves keys alone", async () => {
    const body = JSON.stringify({
      "{{rule}}": "{{rule}}",
      angry: "{{answers.angry}}",
      urgency: "{{ answers.urgency }}",
      team: "{{answers.team}}",
      ids: ["{{decision.id}}", "{{record.id}}", "{{recipe.name}}"],
      inline: "angry={{answers.angry}} urgency={{answers.urgency}}",
      untouched: [1, false, null],
    });

    const request = await webhook.build(
      routedDecision(),
      routedRecord(),
      { url, body },
      feedbackWidget(),
    );

    expect(JSON.parse(request.body)).toEqual({
      "{{rule}}": "r2",
      angry: true,
      urgency: 2,
      team: "billing",
      ids: ["0192f3c2-7b1e-7c4a-9f0e-3a1b2c3d4e5f", "rec_4c11", "feedback-widget"],
      inline: "angry=true urgency=2",
      untouched: [1, false, null],
    });
  });

  it("renders an absent value as null on its own and as nothing inside text", async () => {
    const body =
      '{ "from": "{{record.sender}}", "line": "from <{{record.source}}>", "rule": "{{rule}}" }';

    const decision = { ...routedDecision(), rule: null };
    const request = await webhook.build(decision, { text: "hi" }, { url, body }, feedbackWidget());

    expect(JSON.parse(request.body)).toEqual({ from: null, line: "from <>", rule: null });
  });

  it("sends a template that is one bare variable as a JSON string", async () => {
    const body = '"{{record.text}}"';

    const request = await webhook.build(
      routedDecision(),
      routedRecord(),
      { url, body },
      feedbackWidget(),
    );

    expect(request.body).toBe('"Charged twice, \\"refund\\" now\\nplease"');
  });

  it("signs the rendered body, not the Decision line", async () => {
    const body = '{ "content": "{{record.text}}" }';

    const request = await webhook.build(
      routedDecision(),
      routedRecord(),
      { url, secret: "test-secret", body },
      feedbackWidget(),
    );

    expect(request.headers["X-Siftline-Signature"]).toBe(
      `sha256=${await hmacSha256Hex("test-secret", '{"content":"Charged twice, \\"refund\\" now\\nplease"}')}`,
    );
  });

  it("refuses a Question the Recipe does not ask, never retryable", async () => {
    const body = '{ "urgent": "{{answers.urgent}}" }';
    const build = webhook.build(routedDecision(), routedRecord(), { url, body }, feedbackWidget());

    await expect(build).rejects.toThrow(
      'Action "act_revenue": config.body: Recipe "feedback-widget" has no Question "urgent"',
    );
    await expect(build).rejects.toMatchObject({ name: "ActionBuildError", retryable: false });
  });
});
