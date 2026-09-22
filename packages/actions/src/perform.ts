import type { ActionRequest } from "./adapter";
import { ActionFailedError } from "./errors";

export interface ActionResponse {
  status: number;
  body: string;
  truncated: boolean;
}

export interface ActionFetchInit {
  method: "POST";
  headers: { [name: string]: string };
  body: string;
  signal?: AbortSignal;
}

/** Narrower than the global `fetch`, which is assignable to it, so a stub needs no cast. */
export type ActionFetch = (url: string, init: ActionFetchInit) => Promise<Response>;

const BODY_LIMIT = 4096;
const decoder = new TextDecoder();

// A UTF-8 continuation byte is `10xxxxxx`; walking back over them lands on a code-point
// start, so the decoder never sees half a character. No marker is appended.
function truncate(bytes: Uint8Array): ActionResponse["body"] {
  let end = BODY_LIMIT;
  while (end > 0 && ((bytes[end] ?? 0) & 0xc0) === 0x80) end -= 1;
  return decoder.decode(bytes.subarray(0, end));
}

function retryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

/** Sends the request once. No retries, no timeout of its own: both belong to the caller. */
export async function perform(
  request: ActionRequest,
  fetchImpl: ActionFetch,
  options: { signal?: AbortSignal } = {},
): Promise<ActionResponse> {
  let response: Response;
  try {
    response = await fetchImpl(request.url, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      signal: options.signal,
    });
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    throw new ActionFailedError(`POST ${request.url} failed: ${reason}`, null, true, { cause });
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  const truncated = bytes.byteLength > BODY_LIMIT;
  const body = truncated ? truncate(bytes) : decoder.decode(bytes);
  const result: ActionResponse = { status: response.status, body, truncated };

  if (!response.ok) {
    throw new ActionFailedError(
      `POST ${request.url} returned ${response.status}`,
      response.status,
      retryableStatus(response.status),
      { cause: result },
    );
  }

  return result;
}
