import { apiFetch, handleApiResponse } from "../lib/api.js";

// One model call, always owned by exactly one Run -- no "accepted"
// step (a Job is created by its workflow handler already mid-flight,
// unlike a Run sitting in the dispatch queue).
type Job = {
  id: string;
  model: string;
  status: "queued" | "running" | "succeeded" | "failed";
  error: string | null;
  cost_usd: number | null;
  result_asset_id: string | null;
  created_at: string;
  updated_at: string;
};

type Run = {
  id: string;
  workflow_id: string;
  project_id: string;
  created_by: string;
  parameters: Record<string, unknown>;
  name: string | null;
  status: "queued" | "accepted" | "running" | "succeeded" | "failed";
  error: string | null;
  created_at: string;
  updated_at: string;
};

type RunDetail = Run & { jobs: Job[] };

type RunListResponse = {
  runs: Run[];
  page: number;
  limit: number;
  total: number;
};

function formatRunLine(run: Run): string {
  const name = run.name ? ` "${run.name}"` : "";
  return `${run.id}${name} -- ${run.status} -- workflow ${run.workflow_id} -- project ${run.project_id}`;
}

// No project -> GET /runs (every accessible project); with one ->
// GET /projects/:projectId/runs -- same split as listAssets/
// listLikedAssets above.
export async function listRuns(options: {
  project?: string;
  page?: string;
  limit?: string;
}): Promise<void> {
  const params = new URLSearchParams();
  if (options.page) params.set("page", options.page);
  if (options.limit) params.set("limit", options.limit);
  const query = params.toString() ? `?${params.toString()}` : "";
  const path = options.project ? `/projects/${options.project}/runs` : "/runs";

  const body = await handleApiResponse<RunListResponse>(apiFetch(`${path}${query}`));
  if (!body) {
    return;
  }

  if (body.runs.length === 0) {
    console.log("No runs found.");
    return;
  }

  for (const run of body.runs) {
    console.log(formatRunLine(run));
  }
  console.log(`-- page ${body.page} (limit ${body.limit}, total ${body.total})`);
}

export async function runStatus(runId: string): Promise<void> {
  const run = await handleApiResponse<RunDetail>(apiFetch(`/runs/${runId}`));
  if (!run) {
    return;
  }

  console.log(`Run: ${run.id}`);
  if (run.name) {
    console.log(`Name: ${run.name}`);
  }
  console.log(`Workflow: ${run.workflow_id}`);
  console.log(`Project: ${run.project_id}`);
  console.log(`Status: ${run.status}`);
  if (run.error) {
    console.log(`Error: ${run.error}`);
  }
  console.log(`Updated: ${run.updated_at}`);

  if (run.jobs.length > 0) {
    console.log("Jobs:");
    for (const job of run.jobs) {
      const cost = job.cost_usd !== null ? ` -- $${job.cost_usd}` : "";
      const asset = job.result_asset_id ? ` -- asset ${job.result_asset_id}` : "";
      const error = job.error ? ` -- ${job.error}` : "";
      console.log(`  ${job.id} -- ${job.model} -- ${job.status}${cost}${asset}${error}`);
    }
  }
}
