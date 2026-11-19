import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { cliVersion } from "./version.js";

const readRepoFile = (path: string): string =>
  readFileSync(new URL(path, import.meta.url), "utf8");

describe("cliVersion", () => {
  it("equals the version in package.json", () => {
    const pkg = JSON.parse(readRepoFile("../../package.json")) as { version: string };
    expect(cliVersion).toBe(pkg.version);
    expect(cliVersion).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("is what --version uses: no version string is hard-coded in src/index.ts", () => {
    const index = readRepoFile("../index.ts");
    expect(index).toMatch(/\.version\(cliVersion\)/);
    expect(index).not.toMatch(/\.version\(\s*["'`]/);
  });
});
