import { apiFetch, handleApiResponse } from "../lib/api.js";

type Task = {
  id: string;
  task_definition_id: string;
  project_id: string;
  created_by: string;
  // The task's submitted field values and its outputs (non-asset result
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

// GET /tasks/:taskId adds the model call's own fields, stamped by the
// worker as it runs the task.
type TaskDetail = Task & {
  model: string | null;
  model_provider: string | null;
  result_asset_id: string | null;
};

type TaskListResponse = {
  tasks: Task[];
  page: number;
  limit: number;
  total: number;
};

function formatTaskLine(task: Task): string {
  const name = task.name ? ` "${task.name}"` : "";
  return `${task.id}${name} -- ${task.status} -- task definition ${task.task_definition_id} -- project ${task.project_id}`;
}

// No project -> GET /tasks (every accessible project); with one ->
// GET /projects/:projectId/tasks -- same split as listAssets.
export async function listTasks(options: {
  project?: string;
  page?: string;
  limit?: string;
}): Promise<void> {
  const params = new URLSearchParams();
  if (options.page) params.set("page", options.page);
  if (options.limit) params.set("limit", options.limit);
  const query = params.toString() ? `?${params.toString()}` : "";
  const path = options.project ? `/projects/${options.project}/tasks` : "/tasks";

  const body = await handleApiResponse<TaskListResponse>(apiFetch(`${path}${query}`));
  if (!body) {
    return;
  }

  if (body.tasks.length === 0) {
    console.log("No tasks found.");
    return;
  }

  for (const task of body.tasks) {
    console.log(formatTaskLine(task));
  }
  console.log(`-- page ${body.page} (limit ${body.limit}, total ${body.total})`);
}

export async function taskStatus(taskId: string): Promise<void> {
  const task = await handleApiResponse<TaskDetail>(apiFetch(`/tasks/${taskId}`));
  if (!task) {
    return;
  }

  console.log(`Task: ${task.id}`);
  if (task.name) {
    console.log(`Name: ${task.name}`);
  }
  console.log(`Task definition: ${task.task_definition_id}`);
  console.log(`Project: ${task.project_id}`);
  console.log(`Status: ${task.status}`);
  if (task.model) {
    console.log(`Model: ${task.model}${task.model_provider ? ` (${task.model_provider})` : ""}`);
  }
  if (task.cost_usd !== null) {
    console.log(`Cost: $${task.cost_usd}`);
  }
  if (task.result_asset_id) {
    console.log(`Result asset: ${task.result_asset_id}`);
  }
  if (task.error) {
    console.log(`Error: ${task.error}`);
  }
  console.log(`Updated: ${task.updated_at}`);

  if (task.outputs && Object.keys(task.outputs).length > 0) {
    console.log(`Outputs: ${JSON.stringify(task.outputs)}`);
  }
}
