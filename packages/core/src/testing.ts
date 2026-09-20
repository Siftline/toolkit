/** Test code depends on this shape, so swapping in the real client never reaches a test file. */
export interface FakeTypeSafeClient {
  readonly kind: "fake";
}

export function createFakeTypeSafeClient(): FakeTypeSafeClient {
  return { kind: "fake" };
}
