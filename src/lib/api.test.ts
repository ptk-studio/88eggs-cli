import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const loadCredentials = vi.fn();
const saveCredentials = vi.fn();
vi.mock("./credentials.js", () => ({
  loadCredentials: (...args: unknown[]) => loadCredentials(...args),
  saveCredentials: (...args: unknown[]) => saveCredentials(...args),
}));

const refreshSession = vi.fn();
vi.mock("./supabase-client.js", () => ({
  createAuthClient: () => ({ auth: { refreshSession } }),
}));

const fetchMock = vi.fn();

const { apiFetch, handleApiResponse, isErrorBody } = await import("./api.js");

describe("apiFetch", () => {
  beforeEach(() => {
    loadCredentials.mockReset();
    saveCredentials.mockReset();
    refreshSession.mockReset();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("throws a clear error when not signed in", async () => {
    loadCredentials.mockResolvedValue(null);
    await expect(apiFetch("/projects")).rejects.toThrow("88eggs login");
  });

  it("uses the stored access token without refreshing when it's not near expiry", async () => {
    const now = Math.floor(Date.now() / 1000);
    loadCredentials.mockResolvedValue({
      access_token: "tok",
      refresh_token: "r",
      expires_at: now + 3600,
      email: "a@example.com",
    });
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));

    await apiFetch("/projects");

    expect(refreshSession).not.toHaveBeenCalled();
    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Headers).get("Authorization")).toBe("Bearer tok");
  });

  it("refreshes and persists the new session when the token is near/at expiry", async () => {
    const now = Math.floor(Date.now() / 1000);
    loadCredentials.mockResolvedValue({
      access_token: "old",
      refresh_token: "r",
      expires_at: now + 10,
      email: "a@example.com",
    });
    refreshSession.mockResolvedValue({
      data: {
        session: {
          access_token: "new",
          refresh_token: "r2",
          expires_at: now + 3600,
          expires_in: 3600,
          user: { email: "a@example.com" },
        },
      },
      error: null,
    });
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));

    await apiFetch("/projects");

    expect(refreshSession).toHaveBeenCalledWith({ refresh_token: "r" });
    expect(saveCredentials).toHaveBeenCalledWith(
      expect.objectContaining({ access_token: "new", refresh_token: "r2" }),
    );
    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Headers).get("Authorization")).toBe("Bearer new");
  });

  it("throws a clear error telling the user to log in again when refresh fails", async () => {
    const now = Math.floor(Date.now() / 1000);
    loadCredentials.mockResolvedValue({
      access_token: "old",
      refresh_token: "r",
      expires_at: now - 10,
      email: "a@example.com",
    });
    refreshSession.mockResolvedValue({
      data: { session: null },
      error: { message: "invalid refresh token" },
    });

    await expect(apiFetch("/projects")).rejects.toThrow("88eggs login");
  });
});

describe("handleApiResponse", () => {
  const originalExitCode = process.exitCode;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    process.exitCode = undefined;
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    process.exitCode = originalExitCode;
    errorSpy.mockRestore();
  });

  it("returns the parsed body on a 2xx response", async () => {
    const result = await handleApiResponse<{ ok: boolean }>(
      Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 })),
    );
    expect(result).toEqual({ ok: true });
    expect(process.exitCode).toBeUndefined();
  });

  it("prints the backend's error message and returns null on a non-2xx response", async () => {
    const result = await handleApiResponse(
      Promise.resolve(
        new Response(JSON.stringify({ error: "Not found" }), { status: 404 }),
      ),
    );
    expect(result).toBeNull();
    expect(process.exitCode).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith("Error: Not found");
  });

  it("falls back to a generic message when the error body doesn't match the expected shape", async () => {
    const result = await handleApiResponse(
      Promise.resolve(new Response("not json", { status: 500 })),
    );
    expect(result).toBeNull();
    expect(process.exitCode).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith("Error: Request failed with status 500");
  });

  it("prints the error and returns null when the fetch itself rejects", async () => {
    const result = await handleApiResponse(Promise.reject(new Error("network down")));
    expect(result).toBeNull();
    expect(process.exitCode).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith("network down");
  });
});

describe("isErrorBody", () => {
  it("recognizes a valid error body", () => {
    expect(isErrorBody({ error: "Unauthorized" })).toBe(true);
  });

  it("rejects non-matching shapes", () => {
    expect(isErrorBody(null)).toBe(false);
    expect(isErrorBody({})).toBe(false);
    expect(isErrorBody({ error: 42 })).toBe(false);
    expect(isErrorBody("Unauthorized")).toBe(false);
  });
});
