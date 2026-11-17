import { apiFetch, handleApiResponse, isErrorBody } from "../lib/api.js";

// The Feedback app's inbox (88eggs-backend#341, step 3): read it, triage it,
// delete items. Used for the weekly FEEDBACK.md readings (R31).

type Item = {
  id: string;
  app_id: string;
  kind: string;
  message: string;
  rating: number | null;
  source: string;
  status: string;
  created_at: string;
  contact_email: string | null;
};

export const FEEDBACK_STATUSES = ["new", "triaged", "planned", "done", "wont_do", "spam"];

export function oneLine(text: string, max = 80): string {
  const s = text.replace(/\s+/g, " ").trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

export async function listFeedback(options: {
  project: string;
  app?: string;
  kind?: string;
  status?: string;
  source?: string;
  search?: string;
  since?: string;
  limit?: string;
  json?: boolean;
}): Promise<void> {
  const params = new URLSearchParams();
  if (options.app) params.set("app", options.app);
  if (options.kind) params.set("kind", options.kind);
  if (options.status) params.set("status", options.status);
  if (options.source) params.set("source", options.source);
  if (options.search) params.set("q", options.search);
  if (options.since) params.set("from", sinceToDate(options.since));
  params.set("limit", options.limit ?? "50");
  const body = await handleApiResponse<{ items: Item[]; next_cursor: string | null; counts?: Record<string, number> }>(
    apiFetch(`/projects/${options.project}/feedback?${params}`),
  );
  if (!body) return;
  if (options.json) {
    console.log(JSON.stringify(body, null, 2));
    return;
  }
  if (body.counts) {
    console.log(FEEDBACK_STATUSES.map((s) => `${s} ${body.counts?.[s] ?? 0}`).join(" · "));
  }
  if (body.items.length === 0) {
    console.log("No feedback matches.");
    return;
  }
  for (const i of body.items) {
    const stars = i.rating ? ` ${"★".repeat(i.rating)}` : "";
    console.log(`${i.id}  ${String(i.created_at).slice(0, 10)}  ${i.status.padEnd(8)} ${i.kind.padEnd(8)} ${i.source.padEnd(6)}${stars}  ${oneLine(i.message)}`);
  }
  if (body.next_cursor) console.log(`(more: raise --limit, up to 200)`);
}

// "7d" / "24h" / an ISO date -> an ISO date-time for the API's `from`.
export function sinceToDate(since: string, now: number = Date.now()): string {
  const m = /^(\d+)([dh])$/.exec(since.trim());
  if (!m) return since;
  const ms = Number(m[1]) * (m[2] === "d" ? 86_400_000 : 3_600_000);
  return new Date(now - ms).toISOString();
}

export async function setFeedbackStatus(id: string, status: string): Promise<void> {
  if (!FEEDBACK_STATUSES.includes(status)) {
    console.error(`Error: status must be one of ${FEEDBACK_STATUSES.join(", ")}`);
    process.exitCode = 1;
    return;
  }
  const body = await handleApiResponse<{ item: Item }>(
    apiFetch(`/feedback/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
  );
  if (body) console.log(`Feedback ${id} is now ${body.item.status}.`);
}

// DELETE answers 204 with no body, so it's handled here rather than through
// handleApiResponse (which reads a JSON body).
export async function deleteFeedback(id: string): Promise<void> {
  let response: Response;
  try {
    response = await apiFetch(`/feedback/${id}`, { method: "DELETE" });
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Request failed.");
    process.exitCode = 1;
    return;
  }
  if (response.status === 204) {
    console.log(`Deleted feedback ${id}.`);
    return;
  }
  const body: unknown = await response.json().catch(() => null);
  console.error(`Error: ${isErrorBody(body) ? body.error : `Request failed with status ${response.status}`}`);
  process.exitCode = 1;
}
