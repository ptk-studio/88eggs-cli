import { createInterface } from "node:readline";
import { Writable } from "node:stream";
import { saveCredentials } from "../lib/credentials.js";
import { BACKEND_API_URL } from "../lib/constants.js";

// Sign in with a username or email and a password, through the API's Better
// Auth route (POST /auth/sign-in). The password is read from the terminal with
// echo off, sent once over HTTPS, and never stored: only the session token is
// saved (~/.88eggs/credentials.json, mode 600).
export async function login(options: { username?: string } = {}): Promise<void> {
  const identifier = options.username ?? (await ask("Username or email: "));
  const password = await ask("Password: ", { hidden: true });
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
export function ask(prompt: string, { hidden = false } = {}): Promise<string> {
  let muted = false;
  const output = new Writable({
    write(chunk, _encoding, callback) {
      if (!muted) process.stdout.write(chunk);
      callback();
    },
  });
  const rl = createInterface({ input: process.stdin, output, terminal: true });
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      if (hidden) process.stdout.write("\n");
      resolve(answer.trim());
    });
    muted = hidden;
  });
}
