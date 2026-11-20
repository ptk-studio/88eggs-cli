import { afterEach, describe, expect, it, vi } from "vitest";

const apiFetch = vi.fn();
vi.mock("../lib/api.js", async () => {
  const actual = await vi.importActual<typeof import("../lib/api.js")>("../lib/api.js");
  return { ...actual, apiFetch: (...args: unknown[]) => apiFetch(...args) };
});
const { showPipeline, startPipelineRun, clonePipeline, archivePipeline, restorePipeline } = await import("./pipelines.js");

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const pl = (n: number, over: Record<string, unknown> = {}) => ({ id: `id${n}`, slug: `slug-${n}`, name: `Pipeline ${n}`, description: "d", project_id: "p1", created_at: "2026-11-19", ...over });
const page = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => pl(from + i));
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

describe("pipelines: a slug is looked up on every page (#44)", () => {
  afterEach(() => { apiFetch.mockReset(); vi.restoreAllMocks(); process.exitCode = 0; });

  it("show: a slug on page 2 is found (100 on page 1, 130 in all)", async () => {
    apiFetch
      .mockResolvedValueOnce(json({ pipelines: page(1, 100), total: 130, page: 1, limit: 100 }))
      .mockResolvedValueOnce(json({ pipelines: page(101, 130), total: 130, page: 2, limit: 100 }))
      .mockResolvedValueOnce(json({ ...pl(125), inputs: [] }));
    const lines = out();
    await showPipeline("slug-125");
    expect(String(apiFetch.mock.calls[0][0])).toContain("limit=100");
    expect(String(apiFetch.mock.calls[0][0])).toContain("page=1");
    expect(String(apiFetch.mock.calls[1][0])).toContain("page=2");
    expect(String(apiFetch.mock.calls[2][0])).toBe("/pipelines/id125");
    expect(lines[0]).toBe("Pipeline 125 (slug-125)");
    expect(process.exitCode).not.toBe(1);
  });

  it("show: stops paging once total is reached, and says not found for a slug that is on no page", async () => {
    apiFetch.mockResolvedValueOnce(json({ pipelines: page(1, 30), total: 30 }));
    const e = errs();
    await showPipeline("nope");
    expect(apiFetch).toHaveBeenCalledTimes(1);
    expect(e[0]).toBe('Error: No pipeline found with slug "nope".');
    expect(process.exitCode).toBe(1);
  });

  it("a slug in two projects without --project is an error naming both, never the first match", async () => {
    apiFetch.mockResolvedValueOnce(json({ pipelines: [pl(1, { slug: "dup", project_id: "pA" }), pl(2, { slug: "dup", project_id: "pB" })], total: 2 }));
    const e = errs();
    await showPipeline("dup");
    expect(apiFetch).toHaveBeenCalledTimes(1);   // no detail read of either one
    expect(e[0]).toContain("pA");
    expect(e[0]).toContain("pB");
    expect(e[0]).toContain("--project");
    expect(e[0]).toContain("id1");   // the match lines carry id, name and project
    expect(e[0]).toContain("Pipeline 2");
    expect(process.exitCode).toBe(1);
  });

  it("clone and archive with a shared slug stop with the list of matches and make no write call (#27)", async () => {
    const two = () => json({ pipelines: [pl(1, { slug: "dup", project_id: "pA" }), pl(2, { slug: "dup", project_id: "pB" })], total: 2 });
    const e = errs();
    apiFetch.mockResolvedValueOnce(two());
    await clonePipeline("dup");
    apiFetch.mockResolvedValueOnce(two());
    await archivePipeline("dup");
    expect(apiFetch).toHaveBeenCalledTimes(2);   // the two list reads only: no POST clone, no PATCH
    for (const call of apiFetch.mock.calls) expect(String(call[0])).toMatch(/^\/pipelines\?/);
    expect(e).toHaveLength(2);
    expect(e[0]).toContain("nothing was changed");
    expect(e[1]).toContain("pB");
    expect(process.exitCode).toBe(1);
  });

  it("clone --project: the one in that project is cloned (the list is scoped), not the other project's", async () => {
    apiFetch
      .mockResolvedValueOnce(json({ pipelines: [pl(2, { slug: "dup", project_id: "pB" })], total: 1 }))
      .mockResolvedValueOnce(json({ ...pl(2, { slug: "dup", project_id: "pB" }), inputs: [] }))
      .mockResolvedValueOnce(json({ id: "new1", slug: "dup-copy", name: "Pipeline 2 copy" }));
    out();
    await clonePipeline("dup", { project: "pB" });
    expect(String(apiFetch.mock.calls[0][0])).toContain("projectId=pB");
    expect(String(apiFetch.mock.calls[2][0])).toBe("/pipelines/id2/clone");
    expect(process.exitCode).not.toBe(1);
  });

  it("an id is accepted: it names one pipeline even when its slug is shared", async () => {
    apiFetch
      .mockResolvedValueOnce(json({ pipelines: [pl(1, { slug: "dup", project_id: "pA" }), pl(2, { slug: "dup", project_id: "pB" })], total: 2 }))
      .mockResolvedValueOnce(json({ ...pl(2, { slug: "dup", project_id: "pB" }), inputs: [] }));
    out();
    await showPipeline("id2");
    expect(String(apiFetch.mock.calls[1][0])).toBe("/pipelines/id2");
    expect(process.exitCode).not.toBe(1);
  });

  it("start --project: passes the project as projectId, so the one in that project is found", async () => {
    apiFetch
      .mockResolvedValueOnce(json({ pipelines: [pl(2, { slug: "dup", project_id: "pB" })], total: 1 }))
      .mockResolvedValueOnce(json({ ...pl(2, { slug: "dup", project_id: "pB" }), inputs: [] }))
      .mockResolvedValueOnce(json({ id: "run1", name: null, status: "running", project_id: "pB" }, 201));
    out();
    await startPipelineRun("dup", { project: "pB", param: [] });
    expect(String(apiFetch.mock.calls[0][0])).toContain("projectId=pB");
    expect(String(apiFetch.mock.calls[1][0])).toBe("/pipelines/id2");
  });

  it("show --project: passes the project, so the slug in that project is found and the other is not an error", async () => {
    apiFetch
      .mockResolvedValueOnce(json({ pipelines: [pl(1, { slug: "dup", project_id: "pA" })], total: 1 }))
      .mockResolvedValueOnce(json({ ...pl(1, { slug: "dup", project_id: "pA" }), inputs: [] }));
    const lines = out();
    await showPipeline("dup", { project: "pA" });
    expect(String(apiFetch.mock.calls[0][0])).toContain("projectId=pA");
    expect(lines[0]).toBe("Pipeline 1 (dup)");
    expect(process.exitCode).not.toBe(1);
  });
});

describe("pipelines restore finds an archived pipeline (#46)", () => {
  afterEach(() => { apiFetch.mockReset(); vi.restoreAllMocks(); process.exitCode = 0; });

  // The backend lists active pipelines unless ?status=archived; a fake that honours that.
  const backend = (archived: unknown[], active: unknown[] = []) => (path: string, init?: RequestInit) => {
    if (path.startsWith("/pipelines?")) {
      const list = new URLSearchParams(path.split("?")[1]).get("status") === "archived" ? archived : active;
      return Promise.resolve(json({ pipelines: list, total: list.length, page: 1, limit: 100 }));
    }
    if (path === "/pipelines/id7" && !init?.method) return Promise.resolve(json({ ...pl(7), inputs: [] }));
    if (path === "/pipelines/id7" && init?.method === "PATCH") return Promise.resolve(json({ id: "id7", name: "Pipeline 7" }));
    throw new Error("unexpected " + path);
  };

  it("restore finds a slug that only the archived list has, and sets it active", async () => {
    const lines = out();
    apiFetch.mockImplementation(backend([pl(7)]));
    await restorePipeline("slug-7");
    expect(lines).toEqual(['Restored pipeline "Pipeline 7".']);
    const patch = apiFetch.mock.calls.find((c) => c[1]?.method === "PATCH")!;
    expect(JSON.parse(patch[1].body)).toEqual({ status: "active" });
    expect(apiFetch.mock.calls[0]![0]).toContain("status=archived");
  });

  it("restore of a slug that is not archived says so and writes nothing", async () => {
    const e = errs();
    apiFetch.mockImplementation(backend([], [pl(7)]));
    await restorePipeline("slug-7");
    expect(e[0]).toContain('No archived pipeline found with slug "slug-7"');
    expect(process.exitCode).toBe(1);
    expect(apiFetch.mock.calls.some((c) => c[1]?.method === "PATCH")).toBe(false);
  });

  it("archive still looks in the active list only", async () => {
    out();
    apiFetch.mockImplementation(backend([], [pl(7)]));
    await archivePipeline("slug-7");
    expect(apiFetch.mock.calls[0]![0]).not.toContain("status=");
  });
});
