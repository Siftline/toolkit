import { SiftlineError } from "@siftline/core";
import { expect, it } from "vitest";

// Imported by package name, not by relative path: this asserts the published `exports` map.

class JudgeExhaustedError extends SiftlineError {
  constructor(message: string) {
    super(message, "jev_exhausted", true);
  }
}

it("carries a code and a retryable flag", () => {
  const error = new SiftlineError("the model refused", "jev_error", false);
  expect(error).toBeInstanceOf(Error);
  expect(error.name).toBe("SiftlineError");
  expect(error.message).toBe("the model refused");
  expect(error.code).toBe("jev_error");
  expect(error.retryable).toBe(false);
});

it("keeps the cause it is given", () => {
  const cause = new Error("socket hang up");
  expect(new SiftlineError("gave up", "jev_exhausted", true, { cause }).cause).toBe(cause);
});

it("lets a subclass fix the code and name itself", () => {
  const error = new JudgeExhaustedError("out of attempts");
  expect(error).toBeInstanceOf(SiftlineError);
  expect(error.name).toBe("JudgeExhaustedError");
  expect(error.code).toBe("jev_exhausted");
  expect(error.retryable).toBe(true);
});
