import { defineLibraryConfig } from "@siftline/config/tsdown";

// Two entries: the importable module and the shebang bin that wraps it. tsdown's shebang
// plugin chmods any entry chunk whose first line is `#!`.
export default defineLibraryConfig(["src/index.ts", "src/cli.ts"]);
