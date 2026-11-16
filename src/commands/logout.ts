import { clearCredentials, loadCredentials } from "../lib/credentials.js";
import { BACKEND_API_URL } from "../lib/constants.js";

// Revoke the session on the API, then forget it locally. The local file is
// removed even if the API can't be reached: "sign out" has to mean it here.
export async function logout(): Promise<void> {
  const credentials = await loadCredentials();
  if (!credentials) {
    await clearCredentials();
    console.log("Not signed in.");
    return;
  }

  await fetch(`${BACKEND_API_URL}/auth/sign-out`, {
    method: "POST",
    headers: { Authorization: `Bearer ${credentials.token}` },
  }).catch(() => null);

  await clearCredentials();
  console.log(`Signed out${credentials.email ? ` (was ${credentials.email})` : ""}.`);
}
