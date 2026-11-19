import { readFileSync } from "node:fs";

// One source for the CLI version: package.json. From src/lib (tsx, vitest) and
// from dist/lib (built or packed install) the file is two levels up, and npm
// always packs package.json, so no change to "files" is needed.
const packageJsonUrl = new URL("../../package.json", import.meta.url);

export const cliVersion: string = (
  JSON.parse(readFileSync(packageJsonUrl, "utf8")) as { version: string }
).version;
