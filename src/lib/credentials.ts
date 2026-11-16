import { chmod, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

// A Better Auth session token from POST /auth/sign-in, sent as
// `Authorization: Bearer <token>`. It's opaque and has no refresh token: when
// the session ends the API answers 401 and the user signs in again.
export type Credentials = {
  token: string;
  email: string;
};

// Overridable so tests don't touch a real developer's ~/.88eggs.
const CONFIG_DIR = process.env.EGGS_CONFIG_DIR ?? join(homedir(), ".88eggs");
const CREDENTIALS_PATH = join(CONFIG_DIR, "credentials.json");

export async function saveCredentials(credentials: Credentials): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true, mode: 0o700 });
  await writeFile(CREDENTIALS_PATH, JSON.stringify(credentials, null, 2), {
    mode: 0o600,
  });
  // writeFile's mode only applies when the file is created; an older file
  // (e.g. one written with a looser umask) keeps its mode unless reset here.
  await chmod(CREDENTIALS_PATH, 0o600);
}

// Returns null when there's no file, or when it's an old (pre-0.10) Supabase
// session file: those can't be used any more, so the user is "not signed in".
export async function loadCredentials(): Promise<Credentials | null> {
  try {
    const parsed = JSON.parse(await readFile(CREDENTIALS_PATH, "utf-8")) as Partial<Credentials>;
    if (typeof parsed.token !== "string" || parsed.token === "") return null;
    return { token: parsed.token, email: typeof parsed.email === "string" ? parsed.email : "" };
  } catch {
    return null;
  }
}

export async function clearCredentials(): Promise<void> {
  await rm(CREDENTIALS_PATH, { force: true });
}
