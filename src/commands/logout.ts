import { clearCredentials, loadCredentials } from "../lib/credentials.js";

export async function logout(): Promise<void> {
  const credentials = await loadCredentials();
  if (!credentials) {
    console.log("Not signed in.");
    return;
  }

  await clearCredentials();
  console.log(`Signed out (was ${credentials.email}).`);
}
