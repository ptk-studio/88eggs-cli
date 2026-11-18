import { apiFetch, handleApiResponse } from "../lib/api.js";

// `connections health` (88eggs-backend#331): the connected accounts that need attention -- needs_reconnect (the
// provider refused to renew the sign-in, or the token expired; steps that publish through it are held, not charged)
// or expiring (a non-renewable token ends within 7 days). One project with --project, else every accessible project.
// Prints "All connections healthy." when there's nothing, so a sweep can check one line. Exit code 0 either way.

type Connection = {
  id: string;
  project_id: string;
  provider: string;
  display_name: string | null;
  provider_account_id: string;
  health?: "ok" | "expiring" | "needs_reconnect" | "unknown";
  health_checked_at?: string | null;
  needs_reconnect_since?: string | null;
};
type Row = Connection & { project_name: string };

export async function connectionsHealth(options: { project?: string; json?: boolean; all?: boolean }): Promise<void> {
  let projects: { id: string; name: string }[];
  if (options.project) {
    projects = [{ id: options.project, name: options.project }];
  } else {
    const body = await handleApiResponse<{ projects: { id: string; name: string }[] }>(apiFetch("/projects"));
    if (!body) return;
    projects = body.projects;
  }
  const rows: Row[] = [];
  for (const p of projects) {
    const body = await handleApiResponse<{ connections: Connection[] }>(
      apiFetch(`/oauth/connections?projectId=${encodeURIComponent(p.id)}`),
    );
    if (!body) return;
    for (const c of body.connections) rows.push({ ...c, project_name: p.name });
  }
  const shown = options.all ? rows : rows.filter((r) => r.health === "needs_reconnect" || r.health === "expiring");
  // needs_reconnect first, then expiring; oldest problem first.
  const rank = (h?: string) => (h === "needs_reconnect" ? 0 : h === "expiring" ? 1 : 2);
  shown.sort((a, b) => rank(a.health) - rank(b.health) || String(a.needs_reconnect_since ?? "").localeCompare(String(b.needs_reconnect_since ?? "")));
  if (options.json) {
    console.log(JSON.stringify(shown, null, 2));
    return;
  }
  if (shown.length === 0) {
    console.log(options.all ? "No connections." : "All connections healthy.");
    return;
  }
  for (const r of shown) {
    const state = r.health === "needs_reconnect"
      ? `NEEDS RECONNECT${r.needs_reconnect_since ? ` since ${r.needs_reconnect_since.slice(0, 10)}` : ""}`
      : (r.health ?? "unknown").toUpperCase();
    console.log(`${state} -- ${r.provider} -- ${r.display_name ?? r.provider_account_id} -- ${r.id} -- project ${r.project_name}`);
  }
}
