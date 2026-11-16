import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

describe("credentials", () => {
  let tmpDir: string;
  let credentialsModule: typeof import("./credentials.js");

  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "88eggs-cli-test-"));
    process.env.EGGS_CONFIG_DIR = tmpDir;
    credentialsModule = await import("./credentials.js");
  });

  afterAll(async () => {
    delete process.env.EGGS_CONFIG_DIR;
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("returns null when no credentials file exists", async () => {
    await expect(credentialsModule.loadCredentials()).resolves.toBeNull();
  });

  it("saves and loads credentials", async () => {
    const creds = { token: "session-1", email: "person@example.com" };

    await credentialsModule.saveCredentials(creds);
    await expect(credentialsModule.loadCredentials()).resolves.toEqual(creds);
  });

  it("keeps the file at mode 600 even when it already existed with a looser mode", async () => {
    const { chmod, stat } = await import("node:fs/promises");
    const file = join(tmpDir, "credentials.json");
    await chmod(file, 0o644);
    await credentialsModule.saveCredentials({ token: "session-1b", email: "person@example.com" });
    expect((await stat(file)).mode & 0o777).toBe(0o600);
  });

  it("overwrites previously saved credentials", async () => {
    const updated = { token: "session-2", email: "person@example.com" };

    await credentialsModule.saveCredentials(updated);
    await expect(credentialsModule.loadCredentials()).resolves.toEqual(updated);
  });

  // A pre-0.10 file holds a dead Supabase session: treated as signed out.
  it("treats an old Supabase-style credentials file as not signed in", async () => {
    const { writeFile } = await import("node:fs/promises");
    await writeFile(
      join(tmpDir, "credentials.json"),
      JSON.stringify({ access_token: "a", refresh_token: "r", expires_at: 1, email: "x@example.com" }),
    );
    await expect(credentialsModule.loadCredentials()).resolves.toBeNull();
  });

  it("clears credentials", async () => {
    await credentialsModule.clearCredentials();
    await expect(credentialsModule.loadCredentials()).resolves.toBeNull();
  });

  it("clearing when nothing exists is a no-op, not an error", async () => {
    await expect(credentialsModule.clearCredentials()).resolves.toBeUndefined();
  });
});
