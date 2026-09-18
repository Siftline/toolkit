#!/usr/bin/env node
import { run } from "./index";

const result = run(process.argv.slice(2));

if (result.stdout !== "") {
  process.stdout.write(result.stdout);
}

if (result.stderr !== "") {
  process.stderr.write(result.stderr);
}

// Set rather than `process.exit()`: the streams above still get to flush.
process.exitCode = result.code;
