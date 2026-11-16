import { loadCredentials } from "../lib/credentials.js";
import { apiFetch, handleApiResponse } from "../lib/api.js";

// Asks the API who the stored session belongs to (GET /profile), so a session
// that ended reports "not signed in" instead of a stale cached email.
export async function whoami(): Promise<void> {
  if (!(await loadCredentials())) {
    console.log("Not signed in. Run `88eggs login`.");
    process.exitCode = 1;
    return;
  }
  const profile = await handleApiResponse<{ email?: string; username?: string }>(
    apiFetch("/profile"),
  );
  if (!profile) return;
  console.log(profile.email ?? profile.username ?? "signed in");
}
