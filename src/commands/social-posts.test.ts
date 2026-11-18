import { afterEach, describe, expect, it, vi } from "vitest";

const apiFetch = vi.fn();
vi.mock("../lib/api.js", async () => {
  const actual = await vi.importActual<typeof import("../lib/api.js")>("../lib/api.js");
  return { ...actual, apiFetch: (...args: unknown[]) => apiFetch(...args) };
});
const sp = await import("./social-posts.js");
const reply = (b: unknown) => Promise.resolve(new Response(JSON.stringify(b), { status: 200 }));
const POST = { id: "p1", account: "x:@PTKStudio88", text: "hi", link: null, planned_at: null, score: "4.5", verdict: "PASS", owner_status: "ok", posted_url: null, intent_url: "https://x.com/intent/post?text=hi" };

afterEach(() => { apiFetch.mockReset(); vi.restoreAllMocks(); });

describe("social-posts (#438)", () => {
  it("lists with the Post to X link for today's OK'd posts", async () => {
    const out: string[] = []; vi.spyOn(console, "log").mockImplementation((m: string) => { out.push(m); });
    apiFetch.mockReturnValue(reply({ posts: [POST] }));
    await sp.listSocialPosts("a1", { view: "today" });
    expect(apiFetch.mock.calls[0][0]).toBe("/apps/a1/social-posts?view=today");
    expect(out.join("\n")).toContain("Post to X: https://x.com/intent/post?text=hi");
  });
  it("adds, scores (verdict upper-cased) and marks posted with the right bodies", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    apiFetch.mockReturnValue(reply({ post: POST }));
    await sp.addSocialPost("a1", { account: "x:@PTKStudio88", text: "hi", link: "https://nurseisangel.com/" });
    expect(JSON.parse(apiFetch.mock.calls[0][1].body)).toEqual({ account: "x:@PTKStudio88", text: "hi", link: "https://nurseisangel.com/" });
    await sp.scoreSocialPost("a1", "p1", { score: "4.5", verdict: "pass" });
    expect(apiFetch.mock.calls[1][0]).toBe("/apps/a1/social-posts/p1/score");
    expect(JSON.parse(apiFetch.mock.calls[1][1].body)).toEqual({ score: 4.5, verdict: "PASS" });
    await sp.markSocialPostPosted("a1", "p1", "https://x.com/PTKStudio88/status/1");
    expect(JSON.parse(apiFetch.mock.calls[2][1].body)).toEqual({ posted_url: "https://x.com/PTKStudio88/status/1" });
  });
  it("has no review command", () => {
    expect(Object.keys(sp).some((k) => /review/i.test(k))).toBe(false);
  });
});
