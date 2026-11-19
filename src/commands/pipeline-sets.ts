import { apiFetch, handleApiResponse } from "../lib/api.js";

// Pipeline Sets (88eggs-backend /pipeline-sets and /pipeline-set-runs; ptk-studio#264): READ-ONLY commands. Nothing here starts a run,
// publishes, edits or deletes. 88eggs-cli#37.
type SetSummary = {
  id: string;
  project_id: string;
  slug: string;
  name: string;
  description: string;
  status: string;
  step_count?: number;
  runs_30d?: number | string;
  updated_at?: string;
};

type SetStep = { key: string; label?: string; pipeline?: string; review?: boolean; pause_after?: boolean };
type SetDetail = SetSummary & {
  inputs?: { name: string; label?: string; required?: boolean }[];
  steps?: SetStep[];
  settings?: { max_cost_usd?: number; pause_mode?: string };
  published_version?: number;
  is_published?: boolean;
  validation?: { valid: boolean; errors: { path: string; message: string }[] };
  estimate?: { steps: { key: string; est_usd: number | null }[]; total_usd: number; lower_bound: boolean };
};

type SetRunSummary = {
  id: string;
  set_id: string;
  set_name?: string | null;
  project_id: string;
  name: string | null;
  status: string;
  pause_mode?: string;
  current_step_key: string | null;
  cost_usd: string | number | null;
  max_cost_usd: string | number | null;
  error: string | null;
  error_code?: string | null;
  created_at: string;
  step_count?: number | string;
  steps_done?: number | string;
};

type SetRunDetail = SetRunSummary & {
  needs_me?: boolean;
  est_to_finish_usd?: number;
  est_is_lower_bound?: boolean;
  steps: { key: string; label?: string; status: string; state?: string; cost_usd?: number; error?: string | null; needs_me?: boolean }[];
};

const money = (v: string | number | null | undefined): string => (v === null || v === undefined || v === "" ? "-" : `$${Number(v).toFixed(2)}`);

function fail(message: string): null {
  console.error(`Error: ${message}`);
  process.exitCode = 1;
  return null;
}

// A set by its id or its slug. A slug is only unique inside one project, so two matches means: say which project (--project).
async function resolveSet(ref: string, project?: string): Promise<SetSummary | null> {
  // Page through every set (100 a page) so a set beyond the first page is still found.
  const all: SetSummary[] = [];
  for (let page = 1; page <= 50; page++) {
    const q = new URLSearchParams({ limit: "100", page: String(page) });
    if (project) q.set("projectId", project);
    const body = await handleApiResponse<{ sets: SetSummary[]; total: number }>(apiFetch(`/pipeline-sets?${q}`));
    if (!body) return null;
    all.push(...body.sets);
    if (body.sets.length === 0 || all.length >= body.total) break;
  }
  const byId = all.find((s) => s.id === ref);
  if (byId) return byId;
  const bySlug = all.filter((s) => s.slug === ref);
  if (bySlug.length === 1) return bySlug[0]!;
  if (bySlug.length > 1) {
    return fail(`The slug "${ref}" is in ${bySlug.length} projects (${bySlug.map((s) => s.project_id).join(", ")}). Add --project <projectId>.`);
  }
  return fail(`No pipeline set found with id or slug "${ref}"${project ? ` in project ${project}` : ""} (archived sets are not listed; use their id).`);
}

export async function listPipelineSets(options: { project?: string; status?: string; query?: string; json?: boolean }): Promise<void> {
  const q = new URLSearchParams({ limit: "100" });
  if (options.project) q.set("projectId", options.project);
  if (options.status) q.set("status", options.status);
  if (options.query) q.set("q", options.query);
  const body = await handleApiResponse<{ sets: SetSummary[]; total: number }>(apiFetch(`/pipeline-sets?${q}`));
  if (!body) return;
  if (options.json) {
    console.log(JSON.stringify(body.sets, null, 2));
    return;
  }
  if (body.sets.length === 0) {
    console.log("No pipeline sets found.");
    return;
  }
  for (const s of body.sets) {
    console.log(`${s.slug} -- ${s.status} -- ${s.name} -- ${s.step_count ?? "?"} steps, ${s.runs_30d ?? 0} runs in 30 days -- project ${s.project_id} -- ${s.id}`);
  }
  if (body.total > body.sets.length) console.log(`(showing ${body.sets.length} of ${body.total}; narrow with --project, --status or --query)`);
}

async function loadSet(ref: string, project?: string): Promise<SetDetail | null> {
  const found = await resolveSet(ref, project);
  if (!found) return null;
  return handleApiResponse<SetDetail>(apiFetch(`/pipeline-sets/${encodeURIComponent(found.id)}`));
}

function printValidation(v: SetDetail["validation"]): void {
  if (!v) return;
  if (v.valid) {
    console.log("Validation: OK");
    return;
  }
  console.log(`Validation: ${v.errors.length} problem${v.errors.length === 1 ? "" : "s"}`);
  for (const e of v.errors) console.log(`  - ${e.path}: ${e.message}`);
}

export async function showPipelineSet(ref: string, options: { project?: string; json?: boolean }): Promise<void> {
  const set = await loadSet(ref, options.project);
  if (!set) return;
  if (options.json) {
    console.log(JSON.stringify(set, null, 2));
    return;
  }
  console.log(`${set.name} (${set.slug}) -- ${set.status}${set.is_published ? `, published v${set.published_version}` : ""}`);
  console.log(`id ${set.id} -- project ${set.project_id}`);
  if (set.description) console.log(set.description);
  if (set.settings) console.log(`Ceiling per run: ${money(set.settings.max_cost_usd)} -- pause mode: ${set.settings.pause_mode ?? "-"}`);
  if (set.inputs?.length) console.log(`Inputs: ${set.inputs.map((i) => `${i.name}${i.required ? "*" : ""}`).join(", ")}`);
  console.log("Steps:");
  for (const [i, s] of (set.steps ?? []).entries()) {
    console.log(`  ${i + 1}. ${s.key}${s.label && s.label !== s.key ? ` (${s.label})` : ""} -- pipeline ${s.pipeline ?? "-"}${s.review || s.pause_after ? " -- pauses for review" : ""}`);
  }
  if (set.estimate) {
    console.log(`Estimated cost: ${set.estimate.lower_bound ? "at least " : "about "}${money(set.estimate.total_usd)} (median of each step's recent runs)`);
  }
  printValidation(set.validation);
}

// Exit code 1 when the set does not validate, so a script can gate on it.
export async function validatePipelineSet(ref: string, options: { project?: string }): Promise<void> {
  const set = await loadSet(ref, options.project);
  if (!set) return;
  printValidation(set.validation);
  if (set.validation && !set.validation.valid) process.exitCode = 1;
}

export async function listPipelineSetRuns(options: { project?: string; set?: string; status?: string; needsMe?: boolean; json?: boolean }): Promise<void> {
  const q = new URLSearchParams({ limit: "50" });
  if (options.project) q.set("projectId", options.project);
  if (options.status) q.set("status", options.status);
  if (options.needsMe) q.set("needs_me", "true");
  if (options.set) {
    const s = await resolveSet(options.set, options.project);
    if (!s) return;
    q.set("setId", s.id);
  }
  const body = await handleApiResponse<{ runs: SetRunSummary[]; total: number }>(apiFetch(`/pipeline-set-runs?${q}`));
  if (!body) return;
  if (options.json) {
    console.log(JSON.stringify(body.runs, null, 2));
    return;
  }
  if (body.runs.length === 0) {
    console.log("No pipeline set runs found.");
    return;
  }
  for (const r of body.runs) {
    console.log(
      `${r.id} -- ${r.status} -- ${r.set_name ?? r.set_id}${r.name ? ` "${r.name}"` : ""} -- ${r.steps_done ?? "?"}/${r.step_count ?? "?"} steps -- ${money(r.cost_usd)} of ${money(r.max_cost_usd)} -- ${r.created_at}${r.error ? ` -- ${r.error}` : ""}`,
    );
  }
  if (body.total > body.runs.length) console.log(`(showing ${body.runs.length} of ${body.total}; narrow with --set, --status or --project)`);
}

export async function showPipelineSetRun(runId: string, options: { json?: boolean }): Promise<void> {
  const run = await handleApiResponse<SetRunDetail>(apiFetch(`/pipeline-set-runs/${encodeURIComponent(runId)}`));
  if (!run) return;
  if (options.json) {
    console.log(JSON.stringify(run, null, 2));
    return;
  }
  console.log(`${run.set_name ?? run.set_id}${run.name ? ` "${run.name}"` : ""} -- ${run.status}${run.needs_me ? " (needs you)" : ""}`);
  console.log(`run ${run.id} -- project ${run.project_id} -- started ${run.created_at}`);
  console.log(`Cost: ${money(run.cost_usd)} of ${money(run.max_cost_usd)} ceiling${run.est_to_finish_usd ? ` -- about ${money(run.est_to_finish_usd)} more to finish${run.est_is_lower_bound ? " (at least)" : ""}` : ""}`);
  if (run.error) console.log(`Error${run.error_code ? ` (${run.error_code})` : ""}: ${run.error}`);
  console.log("Steps:");
  for (const s of run.steps) {
    console.log(`  ${s.key}${s.label && s.label !== s.key ? ` (${s.label})` : ""} -- ${s.state ?? s.status}${s.needs_me ? " (needs you)" : ""} -- ${money(s.cost_usd)}${s.error ? ` -- ${s.error}` : ""}`);
  }
}
