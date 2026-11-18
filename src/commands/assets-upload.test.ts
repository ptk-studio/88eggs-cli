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

describe("assets upload, multipart (88eggs-backend#425)", async () => {
  const { useMultipart, multipartUpload } = await import("./assets.js");
  afterEach(() => { apiFetch.mockReset(); vi.restoreAllMocks(); process.exitCode = 0; });
  const MB = 1024 * 1024;

  it("switches to multipart for documents over 90 MB and PNGs over 10 MB only", () => {
    expect(useMultipart("application/pdf", 90 * MB)).toBe(false);
    expect(useMultipart("application/pdf", 90 * MB + 1)).toBe(true);
    expect(useMultipart("application/epub+zip", 200 * MB)).toBe(true);
    expect(useMultipart("image/png", 11 * MB)).toBe(true);
    expect(useMultipart("image/jpeg", 11 * MB)).toBe(false);
    expect(useMultipart("video/mp4", 150 * MB)).toBe(false);
  });

  it("start -> PUT every part (retrying one) -> complete with the ETags in order", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    apiFetch
      .mockReturnValueOnce(json({ assetId: "a1", path: "projects/p1/assets/a1/original.pdf", uploadId: "U", partSize: 4,
        parts: [{ partNumber: 1, url: "u1" }, { partNumber: 2, url: "u2" }, { partNumber: 3, url: "u3" }] }))
      .mockReturnValueOnce(json({ asset: { id: "a1", type: "document", name: "big.pdf" } }, 201));
    let failedOnce = false;
    const put = vi.fn(async (url: string, init: RequestInit) => {
      if (url === "u2" && !failedOnce) { failedOnce = true; return new Response(null, { status: 500 }); }
      return new Response(null, { status: 200, headers: { etag: `"e-${url}-${(init.body as Uint8Array).length}"` } });
    });
    await multipartUpload(new Uint8Array(10), "application/pdf", "big.pdf", "p1", put as never, { backoffMs: 0 });
    expect(put).toHaveBeenCalledTimes(4);
    const done = JSON.parse(apiFetch.mock.calls[1][1].body);
    expect(apiFetch.mock.calls[1][0]).toBe("/projects/p1/assets/multipart/complete");
    expect(done.parts).toEqual([{ partNumber: 1, etag: '"e-u1-4"' }, { partNumber: 2, etag: '"e-u2-4"' }, { partNumber: 3, etag: '"e-u3-2"' }]);
    expect(process.exitCode).toBe(0);
  });

  it("aborts the upload when a part keeps failing", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    apiFetch
      .mockReturnValueOnce(json({ assetId: "a1", path: "p", uploadId: "U", partSize: 4, parts: [{ partNumber: 1, url: "u1" }] }))
      .mockReturnValueOnce(json({}, 200));
    const put = vi.fn(async () => new Response(null, { status: 503 }));
    await multipartUpload(new Uint8Array(3), "application/pdf", "big.pdf", "p1", put as never, { backoffMs: 0 });
    expect(put).toHaveBeenCalledTimes(3);
    expect(apiFetch.mock.calls[1][0]).toBe("/projects/p1/assets/multipart/abort");
    expect(JSON.parse(apiFetch.mock.calls[1][1].body)).toEqual({ assetId: "a1", path: "p", uploadId: "U" });
    expect(process.exitCode).toBe(1);
  });
});
