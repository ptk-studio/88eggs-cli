import { loadCredentials } from "../lib/credentials.js";

// Deliberately reads the local credentials file only -- no network call,
// same spirit as `vercel whoami` -- a fast, side-effect-free check a
// skill can run before attempting anything else. It doesn't verify the
// token is still valid server-side (a revoked/expired session still
// reports as "signed in" here); `rainbow projects list` etc. are what
// surface a real auth failure.
export async function whoami(): Promise<void> {
  const credentials = await loadCredentials();
  if (!credentials) {
    console.log("Not signed in. Run `rainbow login`.");
    process.exitCode = 1;
    return;
  }

  console.log(credentials.email);
}
