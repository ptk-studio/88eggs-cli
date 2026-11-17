import { afterEach, describe, expect, it, vi } from "vitest";

const apiFetch = vi.fn();
vi.mock("../lib/api.js", async () => {
  const actual = await vi.importActual<typeof import("../lib/api.js")>("../lib/api.js");
  return { ...actual, apiFetch: (...args: unknown[]) => apiFetch(...args) };
});
const fb = await import("./feedback.js");

describe("feedback commands", () => {
  afterEach(() => { apiFetch.mockReset(); vi.restoreAllMocks(); process.exitCode = 0; });

  it("list builds the query and prints counts and rows", async () => {
    const out: string[] = [];
    vi.spyOn(console, "log").mockImplementation((m: string) => { out.push(m); });
    apiFetch.mockResolvedValue(new Response(JSON.stringify({
      items: [{ id: "i1", app_id: "a", kind: "bug", message: "Crash\non open", rating: 2, source: "web", status: "new", created_at: "2026-11-16T21:54:53Z", contact_email: null }],
      next_cursor: null, counts: { new: 1 },
    })));
    await fb.listFeedback({ project: "p1", kind: "bug", search: "crash" });
    expect(apiFetch.mock.calls[0][0]).toBe("/projects/p1/feedback?kind=bug&q=crash&limit=50");
    expect(out[0]).toContain("new 1");
    expect(out[1]).toContain("Crash on open");
    expect(out[1]).toContain("★★");
  });

  it("--since 7d becomes an ISO from-date", () => {
    expect(fb.sinceToDate("7d", Date.parse("2026-11-17T00:00:00Z"))).toBe("2026-11-10T00:00:00.000Z");
    expect(fb.sinceToDate("2026-11-01")).toBe("2026-11-01");
  });

  it("delete treats 204 as success and reports errors", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    apiFetch.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await fb.deleteFeedback("i1");
    expect(apiFetch.mock.calls[0]).toEqual(["/feedback/i1", { method: "DELETE" }]);
    expect(log).toHaveBeenCalledWith("Deleted feedback i1.");
    apiFetch.mockResolvedValueOnce(new Response(JSON.stringify({ error: "Not found" }), { status: 404 }));
    await fb.deleteFeedback("nope");
    expect(err).toHaveBeenCalledWith("Error: Not found");
    expect(process.exitCode).toBe(1);
  });

  it("status rejects an unknown status without calling the API", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    await fb.setFeedbackStatus("i1", "closed");
    expect(apiFetch).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });
});
