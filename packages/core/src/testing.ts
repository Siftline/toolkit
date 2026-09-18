/**
 * A stand-in for the TypeSafe client the Engine will judge through. Test code depends
 * on this shape so that swapping the real client in never reaches a test file.
 */
export interface FakeTypeSafeClient {
  readonly kind: "fake";
}

/**
 * Walking-skeleton factory for the `./testing` entry. It proves the second export
 * condition resolves for consumers; the real fake arrives with the Engine.
 */
export function createFakeTypeSafeClient(): FakeTypeSafeClient {
  return { kind: "fake" };
}
