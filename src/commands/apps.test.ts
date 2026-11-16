import { afterEach, describe, expect, it, vi } from "vitest";

const apiFetch = vi.fn();
vi.mock("../lib/api.js", async () => {
  const actual = await vi.importActual<typeof import("../lib/api.js")>("../lib/api.js");
  return { ...actual, apiFetch: (...args: unknown[]) => apiFetch(...args) };
});

const { feedbackKey } = await import("./apps.js");

function reply(body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
}

describe("apps feedback-key", () => {
  afterEach(() => {
    apiFetch.mockReset();
    vi.restoreAllMocks();
    process.exitCode = 0;
  });

  it("issues the key without changing origins, and prints the key, origins and form URL", async () => {
    const out: string[] = [];
    vi.spyOn(console, "log").mockImplementation((m: string) => { out.push(m); });
    apiFetch.mockReturnValue(reply({ feedback_public_key: "fk_abc", feedback_allowed_origins: [] }));
    await feedbackKey("app1", {});
    const [path, init] = apiFetch.mock.calls[0] as [string, RequestInit];
    expect(path).toBe("/apps/app1/feedback-key");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ rotate: false });
    expect(out.join("\n")).toContain("Feedback key: fk_abc");
    expect(out.join("\n")).toContain("https://api.88eggs.com/f/fk_abc");
    expect(out.join("\n")).toContain("(none:");
  });

  it("sends --rotate and --origin values", async () => {
    const out: string[] = [];
    vi.spyOn(console, "log").mockImplementation((m: string) => { out.push(m); });
    apiFetch.mockReturnValue(reply({ feedback_public_key: "fk_new", feedback_allowed_origins: ["https://ptk-studio.com", "https://all-printable.com"] }));
    await feedbackKey("app1", { rotate: true, origin: ["https://ptk-studio.com", "https://all-printable.com"] });
    const [, init] = apiFetch.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({
      rotate: true,
      allowed_origins: ["https://ptk-studio.com", "https://all-printable.com"],
    });
    expect(out.join("\n")).toContain("Allowed origins: https://ptk-studio.com, https://all-printable.com");
  });
});
