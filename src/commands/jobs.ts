import { apiFetch, handleApiResponse } from "../lib/api.js";

type Job = {
  id: string;
  workflow_id: string;
  project_id: string;
  created_by: string;
  parameters: Record<string, unknown>;
  status: "queued" | "running" | "succeeded" | "failed";
  error: string | null;
  cost_usd: number | null;
  result_media_id: string | null;
  created_at: string;
  updated_at: string;
};

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
