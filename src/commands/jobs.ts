import { apiFetch, handleApiResponse } from "../lib/api.js";

type Job = {
  id: string;
  workflow_id: string;
  project_id: string;
  created_by: string;
  parameters: Record<string, unknown>;
  status: "queued" | "accepted" | "running" | "succeeded" | "failed";
  error: string | null;
  cost_usd: number | null;
  result_media_id: string | null;
  created_at: string;
  updated_at: string;
};

type JobListResponse = {
  jobs: Job[];
  page: number;
  limit: number;
  total: number;
};

function formatJobLine(job: Job): string {
  const cost = job.cost_usd !== null ? ` -- $${job.cost_usd}` : "";
  return `${job.id} -- ${job.status} -- workflow ${job.workflow_id} -- project ${job.project_id}${cost}`;
}

// No project -> GET /jobs (every accessible project); with one ->
// GET /projects/:projectId/jobs -- same split as listMedia/
// listLikedMedia above.
export async function listJobs(options: {
  project?: string;
  page?: string;
  limit?: string;
}): Promise<void> {
  const params = new URLSearchParams();
  if (options.page) params.set("page", options.page);
  if (options.limit) params.set("limit", options.limit);
  const query = params.toString() ? `?${params.toString()}` : "";
  const path = options.project ? `/projects/${options.project}/jobs` : "/jobs";

  const body = await handleApiResponse<JobListResponse>(apiFetch(`${path}${query}`));
  if (!body) {
    return;
  }

  if (body.jobs.length === 0) {
    console.log("No jobs found.");
    return;
  }

  for (const job of body.jobs) {
    console.log(formatJobLine(job));
  }
  console.log(`-- page ${body.page} (limit ${body.limit}, total ${body.total})`);
}

export async function jobStatus(jobId: string): Promise<void> {
  const job = await handleApiResponse<Job>(apiFetch(`/jobs/${jobId}`));
  if (!job) {
    return;
  }

  console.log(`Job: ${job.id}`);
  console.log(`Workflow: ${job.workflow_id}`);
  console.log(`Project: ${job.project_id}`);
  console.log(`Status: ${job.status}`);
  if (job.error) {
    console.log(`Error: ${job.error}`);
  }
  if (job.cost_usd !== null) {
    console.log(`Cost: $${job.cost_usd}`);
  }
  if (job.result_media_id) {
    console.log(`Result media: ${job.result_media_id}`);
  }
  console.log(`Updated: ${job.updated_at}`);
}
