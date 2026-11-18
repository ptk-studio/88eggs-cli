import { afterEach, describe, expect, it, vi } from "vitest";

const apiFetch = vi.fn();
vi.mock("../lib/api.js", async () => {
  const actual = await vi.importActual<typeof import("../lib/api.js")>("../lib/api.js");
  return { ...actual, apiFetch: (...args: unknown[]) => apiFetch(...args) };
});
const { pipelineRunStatus } = await import("./pipelines.js");

describe("a blocked pipeline run is reported as capped, not as an error (88eggs-backend#384)", () => {
  afterEach(() => { apiFetch.mockReset(); vi.restoreAllMocks(); });
  it("prints 'Blocked (upload cap …)' instead of 'Error'", async () => {
    apiFetch.mockResolvedValue(new Response(JSON.stringify({
      id: "pr1", pipeline_id: "pl", project_id: "p", name: "Quiz upload", status: "blocked", current_step_key: "upload",
      error: 'Step "upload": Blocked: the daily upload cap for this youtube channel is reached (6/6).',
      cost_usd: 0, created_at: "", updated_at: "", steps: [], step_state: {},
    }), { status: 200 }));
    const lines: string[] = [];
    vi.spyOn(console, "log").mockImplementation((l) => { lines.push(String(l)); });
    await pipelineRunStatus("pr1");
    expect(lines).toContain("Status: blocked");
    expect(lines.some((l) => l.startsWith("Blocked (upload cap; the item goes back in the queue): "))).toBe(true);
    expect(lines.some((l) => l.startsWith("Error:"))).toBe(false);
  });
});
