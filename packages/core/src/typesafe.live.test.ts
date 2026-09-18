import { describe, expect, it } from "vitest";

const apiKey = process.env["TYPESAFE_API_KEY"];

// Real Jev calls cost money and need a key, so this suite skips itself without one.
// `bun run test:live` is the only thing that runs it; Turborepo never does.
describe.skipIf(!apiKey)("live TypeSafe access", () => {
  it("has an API key to call with", () => {
    expect(apiKey).toBeTruthy();
  });
});
