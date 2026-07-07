import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

export type Credentials = {
  access_token: string;
  refresh_token: string;
  expires_at: number; // unix seconds
  email: string;
};

// Overridable so tests don't touch a real developer's ~/.rainbow.
const CONFIG_DIR = process.env.RAINBOW_CONFIG_DIR ?? join(homedir(), ".rainbow");
const CREDENTIALS_PATH = join(CONFIG_DIR, "credentials.json");

export async function saveCredentials(credentials: Credentials): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true });
  await writeFile(CREDENTIALS_PATH, JSON.stringify(credentials, null, 2), {
    mode: 0o600,
  });
}

export async function loadCredentials(): Promise<Credentials | null> {
  try {
    const raw = await readFile(CREDENTIALS_PATH, "utf-8");
    return JSON.parse(raw) as Credentials;
  } catch {
    return null;
  }
}

export async function clearCredentials(): Promise<void> {
  await rm(CREDENTIALS_PATH, { force: true });
}
