import { afterEach, describe, expect, it, vi } from "vitest";

const apiFetch = vi.fn();
vi.mock("../lib/api.js", async () => {
  const actual = await vi.importActual<typeof import("../lib/api.js")>("../lib/api.js");
  return { ...actual, apiFetch: (...args: unknown[]) => apiFetch(...args) };
});

const { showTask, startTask } = await import("./tasks.js");

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

describe("tasks show", () => {
  const task = {
    id: "t1", slug: "ptk-studio/x", name: "X", description: "Does X", created_at: "",
    published: true, has_external_effect: true, price_in_credit: 3,
    outputs: [{ name: "video_id", type: "text" }, { name: "url", type: "text" }],
    inputs: [{ name: "title", type: "text", label: "Title", default: "", required: true }],
  };
  const api = (detail: unknown) => (path: string) => {
    if (path === "/tasks") return json({ tasks: [{ id: "t1", slug: "ptk-studio/x", name: "X", description: "", created_at: "" }] });
    if (path === "/tasks/t1") return json(detail);
    throw new Error("unexpected " + path);
  };
  const lines = (spy: ReturnType<typeof vi.spyOn>) => spy.mock.calls.map((c: unknown[]) => String(c[0]));
  afterEach(() => { apiFetch.mockReset(); vi.restoreAllMocks(); process.exitCode = 0; });

  it("--json prints the API's task object unchanged", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    apiFetch.mockImplementation(api(task));
    await showTask("ptk-studio/x", { json: true });
    expect(JSON.parse(lines(log).join("\n"))).toEqual(task);
  });

  it("the text shows published, external effect, price and outputs", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    apiFetch.mockImplementation(api(task));
    await showTask("ptk-studio/x");
    const out = lines(log).join("\n");
    expect(out).toContain("Published: yes");
    expect(out).toContain("Has external effect: yes");
    expect(out).toContain("Price: 3 credits");
    expect(out).toContain("Outputs: video_id (text), url (text)");
    expect(out).toContain("--param title=<value>");
  });

  it("an older backend without those fields prints exactly the old text", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    apiFetch.mockImplementation(api({ id: "t1", slug: "ptk-studio/x", name: "X", description: "Does X", created_at: "", inputs: [] }));
    await showTask("ptk-studio/x");
    expect(lines(log)).toEqual(["X (ptk-studio/x)", "Does X", "Parameters:"]);
  });

  it("no price is shown as none, no outputs as none", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    apiFetch.mockImplementation(api({ ...task, price_in_credit: null, outputs: [], published: false, has_external_effect: false }));
    await showTask("ptk-studio/x");
    const out = lines(log).join("\n");
    expect(out).toContain("Price: none");
    expect(out).toContain("Outputs: none");
    expect(out).toContain("Published: no");
  });
});
