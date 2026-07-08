import { apiFetch, handleApiResponse } from "../lib/api.js";

type MediaRecord = {
  id: string;
  project_id: string;
  created_by: string;
  type: "image" | "video";
  tags: string[];
  run_name: string | null;
  created_at: string;
};

type MediaWithLiked = MediaRecord & { liked: boolean };
type MediaDetail = MediaWithLiked & { url: string };

type MediaListResponse = {
  media: MediaWithLiked[];
  page: number;
  limit: number;
  total: number;
};

function formatMediaLine(item: MediaWithLiked): string {
  const tags = item.tags.length > 0 ? item.tags.join(", ") : "(no tags)";
  const runName = item.run_name ? ` -- run "${item.run_name}"` : "";
  const liked = item.liked ? " -- liked" : "";
  return `${item.id} -- ${item.type} -- ${tags}${runName} -- created ${item.created_at}${liked}`;
}

function printMediaList({ media, page, limit, total }: MediaListResponse): void {
  if (media.length === 0) {
    console.log("No media found.");
    return;
  }

  for (const item of media) {
    console.log(formatMediaLine(item));
  }
  console.log(`-- page ${page} (limit ${limit}, total ${total})`);
}

export async function listMedia(options: {
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

  const body = await handleApiResponse<MediaListResponse>(
    apiFetch(`/projects/${options.project}/media${query}`),
  );
  if (!body) {
    return;
  }

  printMediaList(body);
}

export async function listLikedMedia(options: { page?: string; limit?: string }): Promise<void> {
  const params = new URLSearchParams();
  if (options.page) params.set("page", options.page);
  if (options.limit) params.set("limit", options.limit);
  const query = params.toString() ? `?${params.toString()}` : "";

  const body = await handleApiResponse<MediaListResponse>(apiFetch(`/media/liked${query}`));
  if (!body) {
    return;
  }

  printMediaList(body);
}

export async function listMediaTags(options: { project?: string }): Promise<void> {
  const path = options.project ? `/projects/${options.project}/media/tags` : "/media/tags";
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

export async function showMedia(mediaId: string): Promise<void> {
  const media = await handleApiResponse<MediaDetail>(apiFetch(`/media/${mediaId}`));
  if (!media) {
    return;
  }

  console.log(`ID: ${media.id}`);
  console.log(`Project: ${media.project_id}`);
  console.log(`Type: ${media.type}`);
  console.log(`Tags: ${media.tags.length > 0 ? media.tags.join(", ") : "(none)"}`);
  if (media.run_name) {
    console.log(`Run: ${media.run_name}`);
  }
  console.log(`Liked: ${media.liked ? "yes" : "no"}`);
  console.log(`Created: ${media.created_at}`);
  console.log(`URL: ${media.url}`);
}

export async function moveMedia(mediaId: string, projectId: string): Promise<void> {
  const media = await handleApiResponse<MediaWithLiked>(
    apiFetch(`/media/${mediaId}`, {
      method: "PATCH",
      body: JSON.stringify({ projectId }),
    }),
  );
  if (!media) {
    return;
  }

  console.log(`Moved ${mediaId} to project ${media.project_id}.`);
}

export async function likeMedia(mediaId: string): Promise<void> {
  const result = await handleApiResponse<{ ok: true }>(
    apiFetch(`/media/${mediaId}/like`, { method: "POST" }),
  );
  if (!result) {
    return;
  }

  console.log(`Liked ${mediaId}.`);
}

export async function unlikeMedia(mediaId: string): Promise<void> {
  const result = await handleApiResponse<{ ok: true }>(
    apiFetch(`/media/${mediaId}/like`, { method: "DELETE" }),
  );
  if (!result) {
    return;
  }

  console.log(`Unliked ${mediaId}.`);
}

export async function addMediaTag(mediaId: string, tag: string): Promise<void> {
  const media = await handleApiResponse<MediaRecord>(
    apiFetch(`/media/${mediaId}/tags`, {
      method: "POST",
      body: JSON.stringify({ tag }),
    }),
  );
  if (!media) {
    return;
  }

  console.log(`Added tag "${tag}" to ${mediaId}. Tags: ${media.tags.join(", ") || "(none)"}`);
}

export async function removeMediaTag(mediaId: string, tag: string): Promise<void> {
  const media = await handleApiResponse<MediaRecord>(
    apiFetch(`/media/${mediaId}/tags/${encodeURIComponent(tag)}`, { method: "DELETE" }),
  );
  if (!media) {
    return;
  }

  console.log(`Removed tag "${tag}" from ${mediaId}. Tags: ${media.tags.join(", ") || "(none)"}`);
}
