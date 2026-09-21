import { SiftlineError } from "@siftline/core";

/** A Decision that cannot become a request. Never retryable: nothing about it will change. */
export class ActionBuildError extends SiftlineError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, "action_build", false, options);
  }
}

/** A request that was sent and did not land. `status` is null when `fetch` itself threw. */
export class ActionFailedError extends SiftlineError {
  readonly status: number | null;

  constructor(message: string, status: number | null, retryable: boolean, options?: ErrorOptions) {
    super(message, "action_failed", retryable, options);
    this.status = status;
  }
}
