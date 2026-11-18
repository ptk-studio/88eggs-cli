import { afterEach, describe, expect, it, vi } from "vitest";

const apiFetch = vi.fn();
vi.mock("../lib/api.js", async () => {
  const actual = await vi.importActual<typeof import("../lib/api.js")>("../lib/api.js");
  return { ...actual, apiFetch: (...args: unknown[]) => apiFetch(...args) };
});
const { connectionsHealth } = await import("./connections.js");
const { listBlockedSchedules } = await import("./schedules.js");

const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200 });
const c = (o: Record<string, unknown>) => ({ id: "c", project_id: "p1", provider: "youtube", display_name: "X", provider_account_id: "UC", health: "ok", ...o });

describe("connections health (#331)", () => {
  afterEach(() => { apiFetch.mockReset(); vi.restoreAllMocks(); process.exitCode = 0; });
  const out = () => { const lines: string[] = []; vi.spyOn(console, "log").mockImplementation((l) => { lines.push(String(l)); }); return lines; };

  it("every project: only the problems, needs_reconnect first, one line each", async () => {
    apiFetch.mockImplementation(async (url: string) => {
      if (url === "/projects") return json({ projects: [{ id: "p1", name: "Studio" }, { id: "p2", name: "Quiz" }] });
      if (url.includes("projectId=p1")) return json({ connections: [
        c({ id: "c1", display_name: "88eggsStudio", health: "needs_reconnect", needs_reconnect_since: "2026-11-18T18:55:00Z" }),
        c({ id: "c2", provider: "printify", display_name: "Shop", health: "expiring" }),
      ] });
      return json({ connections: [c({ id: "c3", display_name: "HoneyStormQuiz", health: "ok" })] });
    });
    const lines = out();
    await connectionsHealth({});
    expect(lines).toEqual([
      "NEEDS RECONNECT since 2026-11-18 -- youtube -- 88eggsStudio -- c1 -- project Studio",
      "EXPIRING -- printify -- Shop -- c2 -- project Studio",
    ]);
  });
  it("one clear line when everything's healthy; --project asks for that project only", async () => {
    apiFetch.mockResolvedValue(json({ connections: [c({ health: "ok" }), c({ health: "unknown" })] }));
    const lines = out();
    await connectionsHealth({ project: "p9" });
    expect(apiFetch.mock.calls.map((x) => x[0])).toEqual(["/oauth/connections?projectId=p9"]);
    expect(lines).toEqual(["All connections healthy."]);
  });
  it("schedules blocked: a connection pause in words", async () => {
    apiFetch.mockResolvedValue(json({ total: 1, schedules: [
      { id: "s1", project_id: "p1", name: "Songs", cron: "0 9 * * *", timezone: "UTC", enabled: false, next_run_at: null, inputs: {},
        blocked_count: 3, blocked_since: "2026-11-18T17:00:00Z", blocked_reason: "connection_needs_reconnect",
        blocked_detail: { provider: "youtube", connection_id: "c1" }, paused_reason: "connection_needs_reconnect", paused_at: "2026-11-18T18:00:00Z" },
    ] }));
    const lines = out();
    await listBlockedSchedules({});
    expect(lines[0]).toMatch(/-- the youtube connection c1 needs reconnecting$/);
  });
});
