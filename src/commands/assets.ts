import { apiFetch, handleApiResponse } from "../lib/api.js";

type AssetRecord = {
  id: string;
  project_id: string;
  created_by: string;
  type: "image" | "video";
  tags: string[];
  run_name: string | null;
  created_at: string;
};

type AssetWithLiked = AssetRecord & { liked: boolean };
type AssetDetail = AssetWithLiked & { url: string };

type AssetListResponse = {
  assets: AssetWithLiked[];
  page: number;
  limit: number;
  total: number;
};

function formatAssetLine(item: AssetWithLiked): string {
  const tags = item.tags.length > 0 ? item.tags.join(", ") : "(no tags)";
  const runName = item.run_name ? ` -- run "${item.run_name}"` : "";
  const liked = item.liked ? " -- liked" : "";
  return `${item.id} -- ${item.type} -- ${tags}${runName} -- created ${item.created_at}${liked}`;
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
  tag?: string;
  runName?: string;
  page?: string;
  limit?: string;
}): Promise<void> {
  const params = new URLSearchParams();
  if (options.tag) params.set("tag", options.tag);
  if (options.runName) params.set("run_name", options.runName);
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

export async function listLikedAssets(options: { page?: string; limit?: string }): Promise<void> {
  const params = new URLSearchParams();
  if (options.page) params.set("page", options.page);
  if (options.limit) params.set("limit", options.limit);
  const query = params.toString() ? `?${params.toString()}` : "";

  const body = await handleApiResponse<AssetListResponse>(apiFetch(`/assets/liked${query}`));
  if (!body) {
    return;
  }

  printAssetList(body);
}

export async function listAssetTags(options: { project?: string }): Promise<void> {
  const path = options.project ? `/projects/${options.project}/assets/tags` : "/assets/tags";
  const body = await handleApiResponse<{ tags: string[] }>(apiFetch(path));
  if (!body) {
    return;
  }

  if (body.tags.length === 0) {
    console.log("No tags found.");
    return;
  }

  for (const tag of body.tags) {
    console.log(tag);
  }
}

export async function showAsset(assetId: string): Promise<void> {
  const asset = await handleApiResponse<AssetDetail>(apiFetch(`/assets/${assetId}`));
  if (!asset) {
    return;
  }

  console.log(`ID: ${asset.id}`);
  console.log(`Project: ${asset.project_id}`);
  console.log(`Type: ${asset.type}`);
  console.log(`Tags: ${asset.tags.length > 0 ? asset.tags.join(", ") : "(none)"}`);
  if (asset.run_name) {
    console.log(`Run: ${asset.run_name}`);
  }
  console.log(`Liked: ${asset.liked ? "yes" : "no"}`);
  console.log(`Created: ${asset.created_at}`);
  console.log(`URL: ${asset.url}`);
}

export async function moveAsset(assetId: string, projectId: string): Promise<void> {
  const asset = await handleApiResponse<AssetWithLiked>(
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

export async function likeAsset(assetId: string): Promise<void> {
  const result = await handleApiResponse<{ ok: true }>(
    apiFetch(`/assets/${assetId}/like`, { method: "POST" }),
  );
  if (!result) {
    return;
  }

  console.log(`Liked ${assetId}.`);
}

export async function unlikeAsset(assetId: string): Promise<void> {
  const result = await handleApiResponse<{ ok: true }>(
    apiFetch(`/assets/${assetId}/like`, { method: "DELETE" }),
  );
  if (!result) {
    return;
  }

  console.log(`Unliked ${assetId}.`);
}

export async function addAssetTag(assetId: string, tag: string): Promise<void> {
  const asset = await handleApiResponse<AssetRecord>(
    apiFetch(`/assets/${assetId}/tags`, {
      method: "POST",
      body: JSON.stringify({ tag }),
    }),
  );
  if (!asset) {
    return;
  }

  console.log(`Added tag "${tag}" to ${assetId}. Tags: ${asset.tags.join(", ") || "(none)"}`);
}

export async function removeAssetTag(assetId: string, tag: string): Promise<void> {
  const asset = await handleApiResponse<AssetRecord>(
    apiFetch(`/assets/${assetId}/tags/${encodeURIComponent(tag)}`, { method: "DELETE" }),
  );
  if (!asset) {
    return;
  }

  console.log(`Removed tag "${tag}" from ${assetId}. Tags: ${asset.tags.join(", ") || "(none)"}`);
}
