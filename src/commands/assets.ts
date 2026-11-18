import { apiFetch, handleApiResponse } from "../lib/api.js";

type AssetRecord = {
  id: string;
  project_id: string;
  created_by: string;
  type: "image" | "video" | "audio";
  // The asset's own name (filterable via --name below) and its optional
  // description. `task_name` is the name of the task that produced it
  // (denormalized).
  name: string | null;
  description: string | null;
  task_name?: string | null;
  created_at: string;
};

type AssetDetail = AssetRecord & { url: string; task_id: string | null };

type AssetListResponse = {
  assets: AssetRecord[];
  page: number;
  limit: number;
  total: number;
};

function formatAssetLine(item: AssetRecord): string {
  const name = item.name ? ` "${item.name}"` : "";
  const taskName = item.task_name ? ` -- task "${item.task_name}"` : "";
  return `${item.id}${name} -- ${item.type}${taskName} -- created ${item.created_at}`;
}

function printAssetList({ assets, page, limit, total }: AssetListResponse): void {
  if (assets.length === 0) {
    console.log("No assets found.");
    return;
  }

  for (const item of assets) {
    console.log(formatAssetLine(item));
  }
  console.log(`-- page ${page} (limit ${limit}, total ${total})`);
}

export async function listAssets(options: {
  project: string;
  name?: string;
  type?: string;
  page?: string;
  limit?: string;
}): Promise<void> {
  const params = new URLSearchParams();
  if (options.name) params.set("name", options.name);
  if (options.type) params.set("type", options.type);
  if (options.page) params.set("page", options.page);
  if (options.limit) params.set("limit", options.limit);
  const query = params.toString() ? `?${params.toString()}` : "";

  const body = await handleApiResponse<AssetListResponse>(
    apiFetch(`/projects/${options.project}/assets${query}`),
  );
  if (!body) {
    return;
  }

  printAssetList(body);
}

export async function showAsset(assetId: string): Promise<void> {
  const asset = await handleApiResponse<AssetDetail>(apiFetch(`/assets/${assetId}`));
  if (!asset) {
    return;
  }

  console.log(`ID: ${asset.id}`);
  if (asset.name) {
    console.log(`Name: ${asset.name}`);
  }
  if (asset.description) {
    console.log(`Description: ${asset.description}`);
  }
  console.log(`Project: ${asset.project_id}`);
  console.log(`Type: ${asset.type}`);
  if (asset.task_name) {
    console.log(`Task: ${asset.task_name}`);
  }
  console.log(`Created: ${asset.created_at}`);
  console.log(`URL: ${asset.url}`);
}

export async function moveAsset(assetId: string, projectId: string): Promise<void> {
  const asset = await handleApiResponse<AssetRecord>(
    apiFetch(`/assets/${assetId}`, {
      method: "PATCH",
      body: JSON.stringify({ projectId }),
    }),
  );
  if (!asset) {
    return;
  }

  console.log(`Moved ${assetId} to project ${asset.project_id}.`);
}

// assets upload <file> -- upload an image, a video or a document (PDF, EPUB, ZIP) through the signed-URL
// path (88eggs-backend#404): upload-url -> PUT the bytes straight to storage
// -> confirm. Videos (mp4/mov, up to 200 MB) can only go this way.
export const UPLOAD_CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  mp4: "video/mp4",
  mov: "video/quicktime",
  // PDFs (books, covers, print files; up to 100 MB, 88eggs-backend#425), stored as type "document".
  pdf: "application/pdf",
  // Kindle EPUBs and ZIPs of page images (88eggs-backend#463), also type "document", up to 100 MB.
  epub: "application/epub+zip",
  zip: "application/zip",
};

export function contentTypeForFile(path: string): string | null {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return UPLOAD_CONTENT_TYPES[ext] ?? null;
}

export async function uploadAsset(
  file: string,
  options: { project: string; name?: string },
  deps: { readFile?: (p: string) => Promise<Uint8Array>; put?: typeof fetch } = {},
): Promise<void> {
  const contentType = contentTypeForFile(file);
  if (!contentType) {
    console.error(`Error: unsupported file type. Allowed: ${Object.keys(UPLOAD_CONTENT_TYPES).join(", ")}`);
    process.exitCode = 1;
    return;
  }
  const readFile = deps.readFile ?? (async (p: string) => new Uint8Array(await (await import("node:fs/promises")).readFile(p)));
  const bytes = await readFile(file);
  const filename = options.name ?? file.split("/").pop() ?? file;

  const minted = await handleApiResponse<{ assetId: string; path: string; provider: string; uploadUrl: string }>(
    apiFetch(`/projects/${encodeURIComponent(options.project)}/assets/upload-url`, {
      method: "POST",
      body: JSON.stringify({ filename, contentType }),
    }),
  );
  if (!minted) return;

  const put = deps.put ?? fetch;
  const res = await put(minted.uploadUrl, { method: "PUT", headers: { "Content-Type": contentType }, body: bytes });
  if (!res.ok) {
    console.error(`Error: the upload to storage failed (HTTP ${res.status}).`);
    process.exitCode = 1;
    return;
  }

  const confirmed = await handleApiResponse<{ asset: { id: string; type: string; name: string } }>(
    apiFetch(`/projects/${encodeURIComponent(options.project)}/assets/confirm`, {
      method: "POST",
      body: JSON.stringify({ assetId: minted.assetId, path: minted.path, filename, provider: minted.provider }),
    }),
  );
  if (!confirmed) return;
  console.log(`Uploaded ${confirmed.asset.type} "${confirmed.asset.name}" as asset ${confirmed.asset.id} (${bytes.length} bytes).`);
}

// assets archive <assetId> -- archive an asset (POST /assets/:id/archive), the
// app's own "delete": hidden from lists, restorable with --restore.
export async function archiveAsset(assetId: string, options: { restore?: boolean }): Promise<void> {
  const body = await handleApiResponse<{ id: string; archived: boolean }>(
    apiFetch(`/assets/${encodeURIComponent(assetId)}/archive`, { method: options.restore ? "DELETE" : "POST" }),
  );
  if (body) console.log(`Asset ${body.id} is now ${body.archived ? "archived" : "restored"}.`);
}
