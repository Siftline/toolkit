import type { SystemOneClient } from "@siftline/core";

/** `process.stdout` and `process.stderr` satisfy this, and so does a string buffer. */
export interface OutputStream {
  write: (chunk: string) => void;
  readonly isTTY?: boolean;
}

/** `process.stdin`, or any async iterable of chunks. */
export type InputStream = AsyncIterable<string | Uint8Array>;

/** The CLI's only seam. The bin wires the process to it; tests wire strings. */
export interface RunDeps {
  client: SystemOneClient;
  stdin: InputStream;
  stdout: OutputStream;
  stderr: OutputStream;
  env: { readonly [name: string]: string | undefined };
  signal?: AbortSignal;
}

/** A bad invocation. Exit 2, with the usage block. */
export class UsageError extends Error {}

/** A file the arguments named that could not be read or parsed. Exit 2, no usage block. */
export class InputError extends Error {}

export function writeLine(stream: OutputStream, line: string): void {
  stream.write(`${line}\n`);
}
