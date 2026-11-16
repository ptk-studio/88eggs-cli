import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const loadCredentials = vi.fn();
const saveCredentials = vi.fn();
vi.mock("./credentials.js", () => ({
  loadCredentials: (...args: unknown[]) => loadCredentials(...args),
  saveCredentials: (...args: unknown[]) => saveCredentials(...args),
}));


const fetchMock = vi.fn();

const { apiFetch, handleApiResponse, isErrorBody } = await import("./api.js");

describe("apiFetch", () => {
  beforeEach(() => {
    loadCredentials.mockReset();
    saveCredentials.mockReset();
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

  it("sends the stored session token to api.88eggs.com", async () => {
    loadCredentials.mockResolvedValue({ token: "sess-1", email: "a@example.com" });
    fetchMock.mockResolvedValue(new Response("{}"));
    await apiFetch("/projects");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.88eggs.com/projects");
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer sess-1");
    expect(saveCredentials).not.toHaveBeenCalled();
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

describe("handleApiResponse: an ended session", () => {
  it("tells the user to sign in again on a 401", async () => {
    const errors: string[] = [];
    const spy = vi.spyOn(console, "error").mockImplementation((m: string) => { errors.push(m); });
    const body = await handleApiResponse(
      Promise.resolve(new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })),
    );
    spy.mockRestore();
    process.exitCode = 0;
    expect(body).toBeNull();
    expect(errors.join(" ")).toContain("88eggs login");
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
