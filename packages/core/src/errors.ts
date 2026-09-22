/** Cloud's error union, plus `action_build`, which only the toolkit raises. */
export type SiftlineErrorCode =
  | "jev_exhausted"
  | "jev_error"
  | "fixture_invalid"
  | "action_failed"
  | "action_build";

/** The base every toolkit error extends, in core and in `@siftline/actions`. */
export class SiftlineError extends Error {
  readonly code: SiftlineErrorCode;
  readonly retryable: boolean;

  constructor(
    message: string,
    code: SiftlineErrorCode,
    retryable: boolean,
    options?: ErrorOptions,
  ) {
    super(message, options);
    // Subclasses report their own constructor name without restating it.
    this.name = new.target.name;
    this.code = code;
    this.retryable = retryable;
  }
}
