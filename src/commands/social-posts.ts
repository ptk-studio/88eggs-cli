import { apiFetch, handleApiResponse } from "../lib/api.js";

// social-posts: the Social Posts app's queue (88eggs-backend#438). list, add, edit, score (the manager's), posted (after
// a person pressed Post in X). There is deliberately NO review command: the Owner's OK/change/drop is recorded only
// from app.88eggs.com, and the API refuses it from the CLI.

type Post = {
  id: string; account: string; text: string; link: string | null; planned_at: string | null;
  score: string | null; verdict: string | null; owner_status: string; posted_url: string | null; intent_url?: string | null;
  ab_group?: string | null; variant?: string | null; score_hidden?: boolean; ab_state?: string | null;
};

const base = (appId: string) => `/apps/${encodeURIComponent(appId)}/social-posts`;

function line(p: Post): string {
  const score = p.score_hidden ? "score hidden (A/B, not picked yet)" : p.verdict ? `${p.verdict} ${p.score ?? ""}`.trim() : "unscored";
  const ab = p.ab_group ? ` -- ${p.ab_group} version ${p.variant}${p.ab_state && p.ab_state !== "undecided" ? ` (${p.ab_state.replace("_", " ")})` : ""}` : "";
  const state = p.posted_url ? `posted ${p.posted_url}` : `owner ${p.owner_status}`;
  return `${p.id} -- ${p.account}${ab} -- ${score} -- ${state} -- ${p.planned_at ?? "no time"} -- ${p.text.replace(/\s+/g, " ").slice(0, 80)}`;
}

export async function listSocialPosts(appId: string, options: { view?: string; revealScores?: boolean }): Promise<void> {
  const view = options.view ?? "all";
  const reveal = options.revealScores ? "&reveal_scores=1" : "";
  const body = await handleApiResponse<{ posts: Post[] }>(apiFetch(`${base(appId)}?view=${encodeURIComponent(view)}${reveal}`));
  if (!body) return;
  if (body.posts.length === 0) { console.log(`No posts (${view}).`); return; }
  for (const p of body.posts) {
    console.log(line(p));
    if (p.intent_url) console.log(`   Post to X: ${p.intent_url}`);
  }
}

export async function addSocialPost(
  appId: string,
  options: { account: string; text: string; link?: string; image?: string; alt?: string; at?: string; abGroup?: string; variant?: string },
): Promise<void> {
  const payload: Record<string, unknown> = { account: options.account, text: options.text };
  if (options.abGroup || options.variant) {
    payload.ab_group = options.abGroup;
    payload.variant = options.variant?.toUpperCase();
  }
  if (options.link) payload.link = options.link;
  if (options.image) payload.image_asset_id = options.image;
  if (options.alt) payload.alt_text = options.alt;
  if (options.at) payload.planned_at = options.at;
  const body = await handleApiResponse<{ post: Post }>(apiFetch(base(appId), { method: "POST", body: JSON.stringify(payload) }));
  if (body) console.log(`Added: ${line(body.post)}`);
}

export async function editSocialPost(
  appId: string, postId: string, options: { text?: string; link?: string; image?: string; alt?: string; at?: string },
): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (options.text !== undefined) payload.text = options.text;
  if (options.link !== undefined) payload.link = options.link || null;
  if (options.image !== undefined) payload.image_asset_id = options.image || null;
  if (options.alt !== undefined) payload.alt_text = options.alt || null;
  if (options.at !== undefined) payload.planned_at = options.at || null;
  const body = await handleApiResponse<{ post: Post }>(apiFetch(`${base(appId)}/${encodeURIComponent(postId)}`, { method: "PATCH", body: JSON.stringify(payload) }));
  if (body) console.log(`Edited: ${line(body.post)}`);
}

export async function scoreSocialPost(appId: string, postId: string, options: { score: string; verdict: string; note?: string }): Promise<void> {
  const payload: Record<string, unknown> = { score: Number(options.score), verdict: options.verdict.toUpperCase() };
  if (options.note) payload.note = options.note;
  const body = await handleApiResponse<{ post: Post }>(apiFetch(`${base(appId)}/${encodeURIComponent(postId)}/score`, { method: "POST", body: JSON.stringify(payload) }));
  if (body) console.log(`Scored: ${line(body.post)}`);
}

export async function markSocialPostPosted(appId: string, postId: string, postedUrl: string): Promise<void> {
  const body = await handleApiResponse<{ post: Post }>(apiFetch(`${base(appId)}/${encodeURIComponent(postId)}/posted`, { method: "POST", body: JSON.stringify({ posted_url: postedUrl }) }));
  if (body) console.log(`Posted: ${line(body.post)}`);
}
