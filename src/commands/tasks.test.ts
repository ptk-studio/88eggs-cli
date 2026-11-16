import { afterEach, describe, expect, it, vi } from "vitest";

const apiFetch = vi.fn();
vi.mock("../lib/api.js", async () => {
  const actual = await vi.importActual<typeof import("../lib/api.js")>("../lib/api.js");
  return { ...actual, apiFetch: (...args: unknown[]) => apiFetch(...args) };
});

const { startTask } = await import("./tasks.js");

function json(body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
}

describe("tasks start", () => {
  afterEach(() => {
    apiFetch.mockReset();
    vi.restoreAllMocks();
    process.exitCode = 0;
  });

  // 88eggs-backend#246 renamed the spec field parameters -> inputs; reading
  // `parameters` crashed with "task.parameters is not iterable".
  it("builds the run's inputs from the task's `inputs` spec plus overrides", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    apiFetch.mockImplementation((path: string, init?: RequestInit) => {
      if (path === "/tasks") return json({ tasks: [{ id: "t1", slug: "ptk-studio/x", name: "X", description: "", created_at: "" }] });
      if (path === "/tasks/t1") {
        return json({
          id: "t1", slug: "ptk-studio/x", name: "X", description: "", created_at: "",
          inputs: [
            { name: "title", type: "text", label: "Title", default: "", required: true },
            { name: "layout", type: "select", label: "Layout", default: "reflow", required: true },
          ],
        });
      }
      if (path === "/tasks/t1/task-runs") {
        return json({ id: "r1", name: "n", status: "queued", project_id: "p1", sent: JSON.parse(String(init?.body)) });
      }
      throw new Error("unexpected " + path);
    });
    await startTask("ptk-studio/x", { project: "p1", param: ["title=Big Sur"] });
    const runCall = apiFetch.mock.calls.find((c) => c[0] === "/tasks/t1/task-runs")!;
    expect(JSON.parse(String((runCall[1] as RequestInit).body)).inputs).toEqual({ title: "Big Sur", layout: "reflow" });
  });
});
