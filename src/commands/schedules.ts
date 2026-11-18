import { apiFetch, handleApiResponse } from "../lib/api.js";

// Pipeline schedules: recurring runs of a pipeline definition, fired by the
// worker on a cron. See 88eggs-backend /pipeline-schedules.
type Schedule = {
  id: string;
  project_id: string;
  name: string;
  definition_slug?: string;
  cron: string;
  timezone: string;
  enabled: boolean;
  next_run_at: string | null;
  inputs: Record<string, unknown>;
  // Why it isn't running (88eggs-backend#327).
  blocked_count?: number;
  blocked_since?: string | null;
  blocked_reason?: string | null;
  blocked_detail?: { needed?: number; balance?: number; provider?: string } | null;
  paused_reason?: string | null;
  paused_at?: string | null;
  pipeline?: { name: string } | null;
};

function why(sc: Schedule): string {
  const reason = sc.paused_reason ?? sc.blocked_reason ?? "";
  if (reason === "insufficient_credits") {
    return `out of credits: needs ${sc.blocked_detail?.needed ?? "?"}, balance ${sc.blocked_detail?.balance ?? "?"}`;
  }
  if (reason.startsWith("provider_out_of_funds:")) return `the ${reason.split(":")[1]} account is out of funds`;
  return reason || "-";
}

// `schedules blocked`: every schedule that isn't running for lack of credits or a provider's funds. PAUSED ones first
// (they need a person), then the longest blocked. Prints "No blocked schedules." when there are none, so a sweep can
// check one line. Exit code 0 either way (a blocked schedule is news, not an error of this command).
export async function listBlockedSchedules(options: { project?: string; json?: boolean }): Promise<void> {
  const q = new URLSearchParams({ state: "blocked", limit: "100" });
  if (options.project) q.set("projectId", options.project);
  const body = await handleApiResponse<{ schedules: Schedule[]; total: number }>(apiFetch(`/pipeline-schedules?${q}`));
  if (!body) return;
  if (options.json) {
    console.log(JSON.stringify(body.schedules, null, 2));
    return;
  }
  if (body.schedules.length === 0) {
    console.log("No blocked schedules.");
    return;
  }
  for (const sc of body.schedules) {
    const state = sc.paused_reason ? `PAUSED since ${sc.paused_at}` : `blocked ${sc.blocked_count}x since ${sc.blocked_since}`;
    console.log(`${state} -- ${sc.id} -- ${sc.name}${sc.pipeline?.name ? ` (${sc.pipeline.name})` : ""} -- project ${sc.project_id} -- ${why(sc)}`);
  }
}

function parseParams(pairs: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pair of pairs) {
    const i = pair.indexOf("=");
    if (i === -1) throw new Error(`Invalid --param "${pair}" -- expected key=value.`);
    out[pair.slice(0, i)] = pair.slice(i + 1);
  }
  return out;
}

export async function listSchedules(options: {
  project?: string;
  page?: string;
  limit?: string;
}): Promise<void> {
  const q = new URLSearchParams();
  if (options.project) q.set("projectId", options.project);
  if (options.page) q.set("page", options.page);
  if (options.limit) q.set("limit", options.limit);
  const s = q.toString();
  const body = await handleApiResponse<{ schedules: Schedule[] }>(
    apiFetch(`/pipeline-schedules${s ? `?${s}` : ""}`),
  );
  if (!body) return;
  if (body.schedules.length === 0) {
    console.log("No schedules found.");
    return;
  }
  for (const sc of body.schedules) {
    const state = sc.enabled ? "enabled" : "disabled";
    console.log(
      `${sc.id} -- ${sc.name} -- ${sc.cron} (${sc.timezone}, ${state}) -- next: ${sc.next_run_at ?? "-"}`,
    );
  }
}

export async function showSchedule(scheduleId: string): Promise<void> {
  const sc = await handleApiResponse<Schedule>(apiFetch(`/pipeline-schedules/${scheduleId}`));
  if (!sc) return;
  console.log(`${sc.name} (${sc.id})`);
  console.log(`Project: ${sc.project_id}`);
  console.log(`Cron: ${sc.cron} (${sc.timezone}) -- ${sc.enabled ? "enabled" : "disabled"}`);
  console.log(`Next run: ${sc.next_run_at ?? "-"}`);
  console.log(`Inputs: ${JSON.stringify(sc.inputs)}`);
}

export async function createSchedule(options: {
  definition?: string;
  cron?: string;
  timezone?: string;
  name?: string;
  project?: string;
  param: string[];
  disabled?: boolean;
}): Promise<void> {
  if (!options.definition || !options.cron || !options.name) {
    console.error("Error: --definition <slug>, --cron <expr>, and --name are required.");
    process.exitCode = 1;
    return;
  }
  let inputs: Record<string, string>;
  try {
    inputs = parseParams(options.param);
  } catch (error) {
    console.error(error instanceof Error ? `Error: ${error.message}` : "Error: invalid --param.");
    process.exitCode = 1;
    return;
  }
  const sc = await handleApiResponse<Schedule>(
    apiFetch("/pipeline-schedules", {
      method: "POST",
      body: JSON.stringify({
        definitionSlug: options.definition,
        cron: options.cron,
        timezone: options.timezone,
        name: options.name,
        projectId: options.project,
        inputs,
        enabled: options.disabled ? false : undefined,
      }),
    }),
  );
  if (!sc) return;
  console.log(`Created schedule ${sc.id} "${sc.name}" (${sc.cron}, ${sc.timezone}).`);
}

export async function updateSchedule(
  scheduleId: string,
  options: {
    name?: string;
    cron?: string;
    timezone?: string;
    enable?: boolean;
    disable?: boolean;
    param: string[];
  },
): Promise<void> {
  const body: Record<string, unknown> = {};
  if (options.name !== undefined) body.name = options.name;
  if (options.cron !== undefined) body.cron = options.cron;
  if (options.timezone !== undefined) body.timezone = options.timezone;
  if (options.enable) body.enabled = true;
  if (options.disable) body.enabled = false;
  if (options.param.length > 0) {
    try {
      body.inputs = parseParams(options.param);
    } catch (error) {
      console.error(error instanceof Error ? `Error: ${error.message}` : "Error: invalid --param.");
      process.exitCode = 1;
      return;
    }
  }
  if (Object.keys(body).length === 0) {
    console.error("Error: nothing to update -- pass --name/--cron/--timezone/--enable/--disable/--param.");
    process.exitCode = 1;
    return;
  }
  const sc = await handleApiResponse<Schedule>(
    apiFetch(`/pipeline-schedules/${scheduleId}`, { method: "PATCH", body: JSON.stringify(body) }),
  );
  if (!sc) return;
  console.log(`Updated schedule ${sc.id} "${sc.name}" (${sc.enabled ? "enabled" : "disabled"}).`);
}

export async function deleteSchedule(scheduleId: string): Promise<void> {
  const ok = await handleApiResponse<unknown>(
    apiFetch(`/pipeline-schedules/${scheduleId}`, { method: "DELETE" }),
  );
  if (ok === null) return;
  console.log(`Deleted schedule ${scheduleId}.`);
}
