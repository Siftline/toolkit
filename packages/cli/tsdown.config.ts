import { defineLibraryConfig } from "@siftline/config/tsdown";

// tsdown's shebang plugin chmods any entry chunk whose first line is `#!`.
export default defineLibraryConfig(["src/index.ts", "src/cli.ts"]);
