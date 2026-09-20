import { describe, expect, it } from "vitest";

const apiKey = process.env["TYPESAFE_API_KEY"];

// Real Jev calls, billed. Only `bun run test:live` runs this; Turborepo never does.
describe.skipIf(!apiKey)("live TypeSafe access", () => {
  it("has an API key to call with", () => {
    expect(apiKey).toBeTruthy();
  });
});
