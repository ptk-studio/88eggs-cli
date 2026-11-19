import { afterEach, describe, expect, it, vi } from "vitest";

const apiFetch = vi.fn();
vi.mock("../lib/api.js", async () => {
  const actual = await vi.importActual<typeof import("../lib/api.js")>("../lib/api.js");
  return { ...actual, apiFetch: (...args: unknown[]) => apiFetch(...args) };
});
const { showPipeline, startPipelineRun } = await import("./pipelines.js");

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
    expect(process.exitCode).toBe(1);
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
