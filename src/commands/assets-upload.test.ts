import { afterEach, describe, expect, it, vi } from "vitest";

const apiFetch = vi.fn();
vi.mock("../lib/api.js", async () => {
  const actual = await vi.importActual<typeof import("../lib/api.js")>("../lib/api.js");
  return { ...actual, apiFetch: (...args: unknown[]) => apiFetch(...args) };
});
const { uploadAsset, contentTypeForFile } = await import("./assets.js");
const json = (b: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(b), { status }));

describe("assets upload", () => {
  afterEach(() => { apiFetch.mockReset(); vi.restoreAllMocks(); process.exitCode = 0; });

  it("maps extensions to content types", () => {
    expect(contentTypeForFile("a/clip.MOV")).toBe("video/quicktime");
    expect(contentTypeForFile("x.mp4")).toBe("video/mp4");
    expect(contentTypeForFile("books/interior.PDF")).toBe("application/pdf");
    expect(contentTypeForFile("x.jpeg")).toBe("image/jpeg");
    expect(contentTypeForFile("kindle/star/kindle.EPUB")).toBe("application/epub+zip");
    expect(contentTypeForFile("kindle-create-jpgs.zip")).toBe("application/zip");
    expect(contentTypeForFile("x.avi")).toBeNull();
  });

  it("upload-url → PUT with the content type → confirm", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    apiFetch
      .mockReturnValueOnce(json({ assetId: "a1", path: "projects/p1/assets/a1/original.mov", provider: "r2", uploadUrl: "https://r2/put" }))
      .mockReturnValueOnce(json({ asset: { id: "a1", type: "video", name: "clip.mov" } }, 201));
    const put = vi.fn(async () => new Response(null, { status: 200 }));
    await uploadAsset("dir/clip.mov", { project: "p1" }, { readFile: async () => new Uint8Array(3), put: put as never });
    expect(JSON.parse(apiFetch.mock.calls[0][1].body)).toEqual({ filename: "clip.mov", contentType: "video/quicktime" });
    expect(put).toHaveBeenCalledWith("https://r2/put", expect.objectContaining({ method: "PUT", headers: { "Content-Type": "video/quicktime" } }));
    expect(JSON.parse(apiFetch.mock.calls[1][1].body)).toEqual({ assetId: "a1", path: "projects/p1/assets/a1/original.mov", filename: "clip.mov", provider: "r2" });
  });

  it("reports a 413 from confirm", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    apiFetch
      .mockReturnValueOnce(json({ assetId: "a1", path: "p", provider: "r2", uploadUrl: "u" }))
      .mockReturnValueOnce(json({ error: "Video is too large (max 200 MB)." }, 413));
    await uploadAsset("big.mp4", { project: "p1" }, { readFile: async () => new Uint8Array(1), put: (async () => new Response(null)) as never });
    expect(err).toHaveBeenCalledWith("Error: Video is too large (max 200 MB).");
    expect(process.exitCode).toBe(1);
  });
});
