import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const saveCredentials = vi.fn();
vi.mock("../lib/credentials.js", () => ({
  saveCredentials: (...args: unknown[]) => saveCredentials(...args),
}));

const fetchMock = vi.fn();
const { login } = await import("./login.js");

// The password prompt is answered through a stubbed stdin.
describe("login", () => {
  beforeEach(() => {
    saveCredentials.mockReset();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    process.exitCode = 0;
  });

  it("signs in through POST /auth/sign-in and stores only the session token", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ token: "sess-9", user: { email: "a@example.com" } }), { status: 200 }),
    );
    // username via the option; the password prompt is answered by a stubbed stdin line
    const { PassThrough } = await import("node:stream");
    const stdin = new PassThrough();
    Object.defineProperty(process, "stdin", { value: stdin, configurable: true });
    setTimeout(() => stdin.write("pw-123\n"), 10);
    await login({ username: "ada" });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.88eggs.com/auth/sign-in");
    expect(JSON.parse(init.body as string)).toEqual({ identifier: "ada", password: "pw-123" });
    expect(saveCredentials).toHaveBeenCalledWith({ token: "sess-9", email: "a@example.com" });
    expect(JSON.stringify(saveCredentials.mock.calls)).not.toContain("pw-123");
  });

  it("stores nothing and fails on a wrong password", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: "Invalid username or password." }), { status: 401 }),
    );
    const { PassThrough } = await import("node:stream");
    const stdin = new PassThrough();
    Object.defineProperty(process, "stdin", { value: stdin, configurable: true });
    setTimeout(() => stdin.write("wrong\n"), 10);
    await login({ username: "ada" });
    expect(saveCredentials).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });
});
