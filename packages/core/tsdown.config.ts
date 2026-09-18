import { defineLibraryConfig } from "@siftline/config/tsdown";

// Two entries: the engine and the `./testing` helpers, so the fake TypeSafe client has a
// home from day one.
export default defineLibraryConfig(["src/index.ts", "src/testing.ts"]);
