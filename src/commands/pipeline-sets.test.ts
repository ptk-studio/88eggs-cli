import { afterEach, describe, expect, it, vi } from "vitest";

const apiFetch = vi.fn();
vi.mock("../lib/api.js", async () => {
  const actual = await vi.importActual<typeof import("../lib/api.js")>("../lib/api.js");
  return { ...actual, apiFetch: (...args: unknown[]) => apiFetch(...args) };
});
const { listPipelineSets, showPipelineSet, validatePipelineSet, listPipelineSetRuns, showPipelineSetRun } = await import("./pipeline-sets.js");

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const set = (over: Record<string, unknown> = {}) => ({ id: "set1", project_id: "p1", slug: "song-story-maker", name: "Song Story Maker", description: "Makes a song.", status: "active", step_count: 3, runs_30d: 4, ...over });
const out = () => {
  const lines: string[] = [];
  vi.spyOn(console, "log").mockImplementation((l) => { lines.push(String(l)); });
  return lines;
};
const errs = () => {
  const lines: string[] = [];
  vi.spyOn(console, "error").mockImplementation((l) => { lines.push(String(l)); });
  return lines;
};

describe("pipeline-sets (read only)", () => {
  afterEach(() => { apiFetch.mockReset(); vi.restoreAllMocks(); process.exitCode = 0; });

  it("list: asks for the filters it was given and prints one line per set", async () => {
    apiFetch.mockResolvedValue(json({ sets: [set()], total: 1 }));
    const lines = out();
    await listPipelineSets({ project: "p1", status: "active", query: "song" });
    const url = String(apiFetch.mock.calls[0][0]);
    expect(url).toContain("/pipeline-sets?");
    expect(url).toContain("projectId=p1");
    expect(url).toContain("status=active");
    expect(url).toContain("q=song");
    expect(lines[0]).toBe("song-story-maker -- active -- Song Story Maker -- 3 steps, 4 runs in 30 days -- project p1 -- set1");
  });
  it("list: says so when there are none, and when the page is cut short", async () => {
    apiFetch.mockResolvedValueOnce(json({ sets: [], total: 0 }));
    let lines = out();
    await listPipelineSets({});
    expect(lines).toEqual(["No pipeline sets found."]);
    vi.restoreAllMocks();
    apiFetch.mockResolvedValueOnce(json({ sets: [set()], total: 150 }));
    lines = out();
    await listPipelineSets({});
    expect(lines[1]).toContain("showing 1 of 150");
  });
  it("show: resolves a slug through the list, then reads the one set by id; prints steps, ceiling, estimate and validation", async () => {
    apiFetch.mockResolvedValueOnce(json({ sets: [set()], total: 1 })).mockResolvedValueOnce(json({
      ...set(), inputs: [{ name: "topic", required: true }], settings: { max_cost_usd: 2, pause_mode: "chosen" },
      steps: [{ key: "lyrics", label: "Write the lyrics", pipeline: "song-lyrics", review: true }, { key: "audio", pipeline: "song-audio" }],
      estimate: { steps: [], total_usd: 0.35, lower_bound: true }, validation: { valid: true, errors: [] }, is_published: false, published_version: 0,
    }));
    const lines = out();
    await showPipelineSet("song-story-maker", {});
    expect(String(apiFetch.mock.calls[1][0])).toBe("/pipeline-sets/set1");
    expect(apiFetch.mock.calls.every((c) => !(c[1] as { method?: string } | undefined)?.method)).toBe(true);   // only GETs
    const text = lines.join("\n");
    expect(text).toContain("Song Story Maker (song-story-maker) -- active");
    expect(text).toContain("Ceiling per run: $2.00 -- pause mode: chosen");
    expect(text).toContain("Inputs: topic*");
    expect(text).toContain("1. lyrics (Write the lyrics) -- pipeline song-lyrics -- pauses for review");
    expect(text).toContain("Estimated cost: at least $0.35");
    expect(text).toContain("Validation: OK");
  });
  it("show: an id works too, and --json prints the set", async () => {
    apiFetch.mockResolvedValueOnce(json({ sets: [set()], total: 1 })).mockResolvedValueOnce(json({ ...set(), steps: [] }));
    const lines = out();
    await showPipelineSet("set1", { json: true });
    expect(JSON.parse(lines.join("\n")).id).toBe("set1");
  });
  it("show: a slug in two projects asks for --project; an unknown one is an error with exit code 1", async () => {
    apiFetch.mockResolvedValueOnce(json({ sets: [set(), set({ id: "set2", project_id: "p2" })], total: 2 }));
    let e = errs();
    await showPipelineSet("song-story-maker", {});
    expect(e[0]).toContain("is in 2 projects (p1, p2). Add --project");
    expect(process.exitCode).toBe(1);
    process.exitCode = 0;
    vi.restoreAllMocks();
    apiFetch.mockResolvedValueOnce(json({ sets: [set()], total: 1 }));
    e = errs();
    await showPipelineSet("nope", { project: "p1" });
    expect(e[0]).toContain('No pipeline set found with id or slug "nope" in project p1');
    expect(process.exitCode).toBe(1);
  });
  it("validate: prints each problem and exits 1; a valid set exits 0", async () => {
    apiFetch.mockResolvedValueOnce(json({ sets: [set()], total: 1 })).mockResolvedValueOnce(json({ ...set(), validation: { valid: false, errors: [{ path: "steps[1].pipeline", message: "pipeline not found" }] } }));
    let lines = out();
    await validatePipelineSet("set1", {});
    expect(lines).toEqual(["Validation: 1 problem", "  - steps[1].pipeline: pipeline not found"]);
    expect(process.exitCode).toBe(1);
    process.exitCode = 0;
    vi.restoreAllMocks();
    apiFetch.mockResolvedValueOnce(json({ sets: [set()], total: 1 })).mockResolvedValueOnce(json({ ...set(), validation: { valid: true, errors: [] } }));
    lines = out();
    await validatePipelineSet("set1", {});
    expect(lines).toEqual(["Validation: OK"]);
    expect(process.exitCode).toBe(0);
  });
});

describe("pipeline-set-runs (read only)", () => {
  afterEach(() => { apiFetch.mockReset(); vi.restoreAllMocks(); process.exitCode = 0; });
  const run = (over: Record<string, unknown> = {}) => ({ id: "run1", set_id: "set1", set_name: "Song Story Maker", project_id: "p1", name: "Lake song", status: "paused", current_step_key: "lyrics", cost_usd: "0.4", max_cost_usd: "2", error: null, created_at: "2026-11-19T10:00:00Z", step_count: 3, steps_done: 1, ...over });

  it("list: the set filter is resolved to its id; --needs-me and --status go through; one line per run", async () => {
    apiFetch.mockResolvedValueOnce(json({ sets: [set()], total: 1 })).mockResolvedValueOnce(json({ runs: [run()], total: 1 }));
    const lines = out();
    await listPipelineSetRuns({ set: "song-story-maker", needsMe: true, status: "paused" });
    const url = String(apiFetch.mock.calls[1][0]);
    expect(url).toContain("/pipeline-set-runs?");
    expect(url).toContain("setId=set1");
    expect(url).toContain("needs_me=true");
    expect(url).toContain("status=paused");
    expect(lines[0]).toBe('run1 -- paused -- Song Story Maker "Lake song" -- 1/3 steps -- $0.40 of $2.00 -- 2026-11-19T10:00:00Z');
  });
  it("list: none found is said in a line", async () => {
    apiFetch.mockResolvedValue(json({ runs: [], total: 0 }));
    const lines = out();
    await listPipelineSetRuns({});
    expect(lines).toEqual(["No pipeline set runs found."]);
  });
  it("status: reads one run (GET only) and prints the ceiling, the estimate to finish and each step", async () => {
    apiFetch.mockResolvedValue(json({ ...run({ error: "boom", error_code: "step_failed" }), needs_me: true, est_to_finish_usd: 0.6, est_is_lower_bound: true,
      steps: [{ key: "lyrics", label: "Write the lyrics", status: "done", state: "ready", cost_usd: 0.4 }, { key: "audio", status: "not_started", state: "not_started", error: "x" }] }));
    const lines = out();
    await showPipelineSetRun("run1", {});
    expect(String(apiFetch.mock.calls[0][0])).toBe("/pipeline-set-runs/run1");
    expect(apiFetch.mock.calls[0][1]).toBeUndefined();
    const text = lines.join("\n");
    expect(text).toContain("Song Story Maker \"Lake song\" -- paused (needs you)");
    expect(text).toContain("Cost: $0.40 of $2.00 ceiling -- about $0.60 more to finish (at least)");
    expect(text).toContain("Error (step_failed): boom");
    expect(text).toContain("lyrics (Write the lyrics) -- ready -- $0.40");
  });
  it("status: a run that is not found is an error line and exit code 1, no stack", async () => {
    apiFetch.mockResolvedValue(json({ error: "Not found" }, 404));
    const e = errs();
    await showPipelineSetRun("nope", {});
    expect(process.exitCode).toBe(1);
    expect(e.join(" ")).toMatch(/not found/i);
  });
});
