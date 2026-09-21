#!/usr/bin/env node
import type { SystemOneClient } from "@siftline/core";
import { TypeSafeClient } from "@typesafe-ai/sdk";

import { API_KEY_ENV, run } from "./index";

const controller = new AbortController();
process.on("SIGINT", () => {
  controller.abort();
});

// Built on first call, so a missing key is `run`'s exit 2 rather than the SDK's own throw.
let client: SystemOneClient | undefined;

process.exitCode = await run(process.argv.slice(2), {
  client: {
    systemOne: (request, options) => {
      client ??= new TypeSafeClient({ apiKey: process.env[API_KEY_ENV] });
      return client.systemOne(request, options);
    },
  },
  stdin: process.stdin,
  stdout: process.stdout,
  stderr: process.stderr,
  env: process.env,
  signal: controller.signal,
});
