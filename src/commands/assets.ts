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
