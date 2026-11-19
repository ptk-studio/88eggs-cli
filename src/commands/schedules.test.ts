import { afterEach, describe, expect, it, vi } from "vitest";

const apiFetch = vi.fn();
vi.mock("../lib/api.js", async () => {
  const actual = await vi.importActual<typeof import("../lib/api.js")>("../lib/api.js");
  return { ...actual, apiFetch: (...args: unknown[]) => apiFetch(...args) };
});
const { listBlockedSchedules } = await import("./schedules.js");

describe("schedules blocked (#327)", () => {
  afterEach(() => { apiFetch.mockReset(); vi.restoreAllMocks(); process.exitCode = 0; });
  const out = () => { const lines: string[] = []; vi.spyOn(console, "log").mockImplementation((l) => { lines.push(String(l)); }); return lines; };

  it("asks for state=blocked and prints one line per schedule, with the reason in words", async () => {
    apiFetch.mockResolvedValue(new Response(JSON.stringify({ total: 2, schedules: [
      { id: "s1", project_id: "p1", name: "Meme1", pipeline: { name: "Meme" }, cron: "0 */4 * * *", timezone: "UTC", enabled: false,
        next_run_at: null, inputs: {}, blocked_count: 3, blocked_since: "2026-11-18T10:00:00Z", blocked_reason: "insufficient_credits",
        blocked_detail: { needed: 20, balance: 2 }, paused_reason: "insufficient_credits", paused_at: "2026-11-18T18:00:00Z" },
      { id: "s2", project_id: "p2", name: "Songs", cron: "0 9 * * *", timezone: "UTC", enabled: true, next_run_at: null, inputs: {},
        blocked_count: 1, blocked_since: "2026-11-18T17:00:00Z", blocked_reason: "provider_out_of_funds:openrouter",
        blocked_detail: { provider: "openrouter" }, paused_reason: null, paused_at: null },
    ] }), { status: 200 }));
    const lines = out();
    await listBlockedSchedules({});
    expect(String(apiFetch.mock.calls[0][0])).toContain("state=blocked");
    expect(lines[0]).toMatch(/^PAUSED since .* -- s1 -- Meme1 \(Meme\) -- project p1 -- out of credits: needs 20, balance 2$/);
    expect(lines[1]).toMatch(/^blocked 1x since .* -- s2 -- Songs -- project p2 -- the openrouter account is out of funds$/);
  });
  it("one clear line when nothing is blocked (what a sweep checks)", async () => {
    apiFetch.mockResolvedValue(new Response(JSON.stringify({ total: 0, schedules: [] }), { status: 200 }));
    const lines = out();
    await listBlockedSchedules({ project: "p1" });
    expect(String(apiFetch.mock.calls[0][0])).toContain("projectId=p1");
    expect(lines).toEqual(["No blocked schedules."]);
  });
});

describe("schedules create --set (backend#554)", () => {
  afterEach(() => { apiFetch.mockReset(); vi.restoreAllMocks(); process.exitCode = 0; });
  it("sends setSlug and no definitionSlug for a set", async () => {
    const { createSchedule } = await import("./schedules.js");
    apiFetch.mockResolvedValue(new Response(JSON.stringify({ id: "sc1", name: "Songs", cron: "0 9 * * *", timezone: "UTC" }), { status: 201 }));
    vi.spyOn(console, "log").mockImplementation(() => {});
    await createSchedule({ set: "song-story-maker", cron: "0 9 * * *", name: "Songs", param: ["topic=Tahoe"] });
    const body = JSON.parse((apiFetch.mock.calls[0][1] as { body: string }).body);
    expect(body.setSlug).toBe("song-story-maker");
    expect("definitionSlug" in body).toBe(false);
    expect(body.inputs).toEqual({ topic: "Tahoe" });
  });
  it("still sends definitionSlug for a pipeline", async () => {
    const { createSchedule } = await import("./schedules.js");
    apiFetch.mockResolvedValue(new Response(JSON.stringify({ id: "sc1", name: "M", cron: "0 9 * * *", timezone: "UTC" }), { status: 201 }));
    vi.spyOn(console, "log").mockImplementation(() => {});
    await createSchedule({ definition: "meme", cron: "0 9 * * *", name: "M", param: [] });
    const body = JSON.parse((apiFetch.mock.calls[0][1] as { body: string }).body);
    expect(body.definitionSlug).toBe("meme");
    expect("setSlug" in body).toBe(false);
  });
  it("refuses both or neither locally (exit 1, nothing sent)", async () => {
    const { createSchedule } = await import("./schedules.js");
    const e: string[] = [];
    vi.spyOn(console, "error").mockImplementation((l) => { e.push(String(l)); });
    await createSchedule({ definition: "meme", set: "s", cron: "* * * * *", name: "x", param: [] });
    expect(process.exitCode).toBe(1);
    process.exitCode = 0;
    await createSchedule({ cron: "* * * * *", name: "x", param: [] });
    expect(process.exitCode).toBe(1);
    expect(e.every((l) => l.includes("exactly one of --definition"))).toBe(true);
    expect(apiFetch).not.toHaveBeenCalled();
  });
});
