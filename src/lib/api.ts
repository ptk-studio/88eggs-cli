import { createAuthClient } from "./supabase-client.js";
import { loadCredentials, saveCredentials } from "./credentials.js";
import { BACKEND_API_URL } from "./constants.js";

// Refreshes silently when the stored access token is at or near expiry
// (within 60s) -- every command that hits the API goes through this
// rather than each one separately checking expiry.
async function getAccessToken(): Promise<string> {
  const credentials = await loadCredentials();
  if (!credentials) {
    throw new Error("Not signed in. Run `88eggs login` first.");
  }

  const now = Math.floor(Date.now() / 1000);
  if (credentials.expires_at - now > 60) {
    return credentials.access_token;
  }

  const supabase = createAuthClient();
  const { data, error } = await supabase.auth.refreshSession({
    refresh_token: credentials.refresh_token,
  });

  if (error || !data.session) {
    throw new Error(
      `Session expired and refresh failed (${error?.message ?? "unknown error"}). Run \`88eggs login\` again.`,
    );
  }

  await saveCredentials({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at: data.session.expires_at ?? now + data.session.expires_in,
    email: data.session.user.email ?? credentials.email,
  });

  return data.session.access_token;
}

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = await getAccessToken();
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Content-Type", "application/json");
  return fetch(`${BACKEND_API_URL}${path}`, { ...init, headers });
}

export function isErrorBody(body: unknown): body is { error: string } {
  return (
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof (body as { error: unknown }).error === "string"
  );
}
