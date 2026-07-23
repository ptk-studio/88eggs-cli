import { apiFetch, handleApiResponse } from "../lib/api.js";

type TaskRun = {
  id: string;
  task_id: string;
  project_id: string;
  created_by: string;
  // The task run's submitted field values and its outputs (non-asset result
  // JSON, e.g. a published YouTube URL -- null until produced).
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown> | null;
  name: string | null;
  status: "queued" | "accepted" | "running" | "succeeded" | "failed";
  error: string | null;
  cost_usd: number | null;
  created_at: string;
  updated_at: string;
};

// GET /task-runs/:taskRunId adds the model call's own fields, stamped by the
// worker as it runs the task run.
type TaskRunDetail = TaskRun & {
  model: string | null;
  model_provider: string | null;
  result_asset_id: string | null;
};

type TaskRunListResponse = {
  task_runs: TaskRun[];
  page: number;
  limit: number;
  total: number;
};

function formatTaskRunLine(taskRun: TaskRun): string {
  const name = taskRun.name ? ` "${taskRun.name}"` : "";
  return `${taskRun.id}${name} -- ${taskRun.status} -- task ${taskRun.task_id} -- project ${taskRun.project_id}`;
}

// No project -> GET /task-runs (every accessible project); with one ->
// GET /projects/:projectId/task-runs -- same split as listAssets.
export async function listTaskRuns(options: {
  project?: string;
  page?: string;
  limit?: string;
}): Promise<void> {
  const params = new URLSearchParams();
  if (options.page) params.set("page", options.page);
  if (options.limit) params.set("limit", options.limit);
  const query = params.toString() ? `?${params.toString()}` : "";
  const path = options.project ? `/projects/${options.project}/task-runs` : "/task-runs";

  const body = await handleApiResponse<TaskRunListResponse>(apiFetch(`${path}${query}`));
  if (!body) {
    return;
  }

  if (body.task_runs.length === 0) {
    console.log("No task runs found.");
    return;
  }

  for (const taskRun of body.task_runs) {
    console.log(formatTaskRunLine(taskRun));
  }
  console.log(`-- page ${body.page} (limit ${body.limit}, total ${body.total})`);
}

export async function taskRunStatus(taskRunId: string): Promise<void> {
  const taskRun = await handleApiResponse<TaskRunDetail>(apiFetch(`/task-runs/${taskRunId}`));
  if (!taskRun) {
    return;
  }

  console.log(`Task run: ${taskRun.id}`);
  if (taskRun.name) {
    console.log(`Name: ${taskRun.name}`);
  }
  console.log(`Task: ${taskRun.task_id}`);
  console.log(`Project: ${taskRun.project_id}`);
  console.log(`Status: ${taskRun.status}`);
  if (taskRun.model) {
    console.log(`Model: ${taskRun.model}${taskRun.model_provider ? ` (${taskRun.model_provider})` : ""}`);
  }
  if (taskRun.cost_usd !== null) {
    console.log(`Cost: $${taskRun.cost_usd}`);
  }
  if (taskRun.result_asset_id) {
    console.log(`Result asset: ${taskRun.result_asset_id}`);
  }
  if (taskRun.error) {
    console.log(`Error: ${taskRun.error}`);
  }
  console.log(`Updated: ${taskRun.updated_at}`);

  if (taskRun.outputs && Object.keys(taskRun.outputs).length > 0) {
    console.log(`Outputs: ${JSON.stringify(taskRun.outputs)}`);
  }
}
