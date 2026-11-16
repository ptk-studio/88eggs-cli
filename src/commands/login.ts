import { createInterface } from "node:readline";
import { Writable } from "node:stream";
import { saveCredentials } from "../lib/credentials.js";
import { BACKEND_API_URL } from "../lib/constants.js";

// Sign in with a username or email and a password, through the API's Better
// Auth route (POST /auth/sign-in). The password is read from the terminal with
// echo off, sent once over HTTPS, and never stored: only the session token is
// saved (~/.88eggs/credentials.json, mode 600).
const NEEDS_TERMINAL =
  "Sign-in needs an interactive terminal (no input was received). Run `88eggs login` in a terminal, or use --username with --password-stdin.";

// A password only ever goes over HTTPS -- plain http is allowed for a local
// backend (EGGS_API_URL=http://localhost:3000) and nothing else.
export function isSafeSignInUrl(apiUrl: string): boolean {
  try {
    const url = new URL(apiUrl);
    if (url.protocol === "https:") return true;
    return (
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    );
  } catch {
    return false;
  }
}

export async function login(
  options: { username?: string; passwordStdin?: boolean } = {},
): Promise<void> {
  if (!isSafeSignInUrl(BACKEND_API_URL)) {
    console.error(
      `Refusing to send a password to ${BACKEND_API_URL}: use https (plain http only for localhost).`,
    );
    process.exitCode = 1;
    return;
  }
  if (options.passwordStdin && !options.username) {
    console.error("--password-stdin needs --username.");
    process.exitCode = 1;
    return;
  }
  // Prompts need a terminal. Without one (a pipe, or a non-interactive shell)
  // readline gets no input and Node would just exit, so say why up front.
  if (!options.passwordStdin && process.stdin.isTTY !== true) {
    console.error(NEEDS_TERMINAL);
    process.exitCode = 1;
    return;
  }
  const identifier = options.username ?? (await ask("Username or email: "));
  const password = options.passwordStdin
    ? await readAllStdin()
    : await ask("Password: ", { hidden: true });
  if (identifier === null || password === null) {
    console.error(`\n${NEEDS_TERMINAL}`);
    process.exitCode = 1;
    return;
  }
  if (!identifier || !password) {
    console.error("Sign-in cancelled: a username/email and a password are required.");
    process.exitCode = 1;
    return;
  }

  let response: Response;
  try {
    response = await fetch(`${BACKEND_API_URL}/auth/sign-in`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, password }),
    });
  } catch (error) {
    console.error(`Sign-in failed: ${error instanceof Error ? error.message : "network error"}`);
    process.exitCode = 1;
    return;
  }

  const body = (await response.json().catch(() => ({}))) as {
    token?: string;
    user?: { email?: string };
    error?: string;
  };
  if (!response.ok || !body.token) {
    console.error(`Sign-in failed: ${body.error ?? `status ${response.status}`}`);
    process.exitCode = 1;
    return;
  }

  const email = body.user?.email ?? (identifier.includes("@") ? identifier : "");
  await saveCredentials({ token: body.token, email });
  console.log(`Signed in as ${email || identifier}.`);
}

// One line from the terminal. With `hidden`, typed characters aren't echoed.
// Resolves null when input ends without a line (no terminal, e.g. a
// non-interactive shell), so the caller can say so instead of exiting silently.
export function ask(prompt: string, { hidden = false } = {}): Promise<string | null> {
  let muted = false;
  const output = new Writable({
    write(chunk, _encoding, callback) {
      if (!muted) process.stdout.write(chunk);
      callback();
    },
  });
  const rl = createInterface({ input: process.stdin, output, terminal: process.stdin.isTTY === true });
  return new Promise((resolve) => {
    let answered = false;
    rl.question(prompt, (answer) => {
      answered = true;
      rl.close();
      if (hidden) process.stdout.write("\n");
      resolve(answer.trim());
    });
    rl.on("close", () => {
      if (!answered) resolve(null);
    });
    muted = hidden;
  });
}

// --password-stdin: the whole of stdin is the password (like `docker login`),
// for scripts that pipe it from a password manager.
export async function readAllStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8").replace(/\r?\n$/, "");
}
