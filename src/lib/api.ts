import { loadCredentials } from "./credentials.js";
import { BACKEND_API_URL } from "./constants.js";

const SIGN_IN_AGAIN = "Not signed in, or your session ended. Run `88eggs login`.";

async function getToken(): Promise<string> {
  const credentials = await loadCredentials();
  if (!credentials) throw new Error(SIGN_IN_AGAIN);
  return credentials.token;
}

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = await getToken();
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

// Every command's fetch-then-report boilerplate (network error -> print
// + exit 1; non-2xx -> print the backend's `error` message + exit 1;
// otherwise return the parsed body) collapses to one call. Returns null
// after already printing and setting process.exitCode on failure, so a
// command can just `if (!body) return;`. A 401 means the session ended.
export async function handleApiResponse<T>(
  fetchPromise: Promise<Response>,
): Promise<T | null> {
  let response: Response;
  try {
    response = await fetchPromise;
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Request failed.");
    process.exitCode = 1;
    return null;
  }

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      response.status === 401
        ? SIGN_IN_AGAIN
        : isErrorBody(body)
          ? body.error
          : `Request failed with status ${response.status}`;
    console.error(`Error: ${message}`);
    process.exitCode = 1;
    return null;
  }

  return body as T;
}
