import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

describe("credentials", () => {
  let tmpDir: string;
  let credentialsModule: typeof import("./credentials.js");

  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "rainbow-cli-test-"));
    process.env.RAINBOW_CONFIG_DIR = tmpDir;
    credentialsModule = await import("./credentials.js");
  });

  afterAll(async () => {
    delete process.env.RAINBOW_CONFIG_DIR;
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("returns null when no credentials file exists", async () => {
    await expect(credentialsModule.loadCredentials()).resolves.toBeNull();
  });

  it("saves and loads credentials", async () => {
    const creds = {
      access_token: "access-1",
      refresh_token: "refresh-1",
      expires_at: 1234567890,
      email: "person@example.com",
    };

    await credentialsModule.saveCredentials(creds);
    await expect(credentialsModule.loadCredentials()).resolves.toEqual(creds);
  });

  it("overwrites previously saved credentials", async () => {
    const updated = {
      access_token: "access-2",
      refresh_token: "refresh-2",
      expires_at: 987654321,
      email: "person@example.com",
    };

    await credentialsModule.saveCredentials(updated);
    await expect(credentialsModule.loadCredentials()).resolves.toEqual(updated);
  });

  it("clears credentials", async () => {
    await credentialsModule.clearCredentials();
    await expect(credentialsModule.loadCredentials()).resolves.toBeNull();
  });

  it("clearing when nothing exists is a no-op, not an error", async () => {
    await expect(credentialsModule.clearCredentials()).resolves.toBeUndefined();
  });
});
