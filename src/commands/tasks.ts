import { apiFetch, handleApiResponse } from "../lib/api.js";

type TaskParameter = {
  name: string;
  type: "text" | "textarea" | "select";
  label: string;
  default: unknown;
  required: boolean;
  options?: { value: string; label: string }[];
};

type TaskSummary = {
  id: string;
  slug: string;
  name: string;
  description: string;
  created_at: string;
};

type TaskDetail = TaskSummary & {
  // The backend renamed the spec field `parameters` -> `inputs`
  // (88eggs-backend#246, 2026-07-25); `parameters` is read only as a fallback.
  inputs?: TaskParameter[];
  parameters?: TaskParameter[];
  // GET /tasks/:id also returns these (88eggs-backend src/app/tasks/[taskId]/route.ts).
  // All optional here: an older backend may not send them.
  outputs?: unknown;
  published?: boolean;
  has_external_effect?: boolean;
  price_in_credit?: number | null;
};

type TaskRun = {
  id: string;
  task_id: string;
  project_id: string;
  created_by: string;
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown> | null;
  name: string | null;
  status: "queued" | "accepted" | "running" | "succeeded" | "failed" | "blocked";
  error: string | null;
  cost_usd: number | null;
  created_at: string;
  updated_at: string;
};

// The API takes a task's id, not its slug -- every command here
// takes a human-friendly slug on the command line, so this is the one
// lookup they all share: list the catalog, find the matching slug, error
// out clearly if there's no such task. Returns null after already
// printing/exiting on failure, same convention as handleApiResponse.
async function resolveTaskBySlug(
  slug: string,
): Promise<TaskDetail | null> {
  const list = await handleApiResponse<{ tasks: TaskSummary[] }>(
    apiFetch("/tasks"),
  );
  if (!list) {
    return null;
  }

  const match = list.tasks.find((task) => task.slug === slug);
  if (!match) {
    console.error(`Error: No task found with slug "${slug}".`);
    process.exitCode = 1;
    return null;
  }

  return handleApiResponse<TaskDetail>(
    apiFetch(`/tasks/${match.id}`),
  );
}

export async function listTasks(): Promise<void> {
  const body = await handleApiResponse<{ tasks: TaskSummary[] }>(
    apiFetch("/tasks"),
  );
  if (!body) {
    return;
  }

  if (body.tasks.length === 0) {
    console.log("No tasks found.");
    return;
  }

  for (const task of body.tasks) {
    console.log(`${task.slug} -- ${task.name} -- ${task.description}`);
  }
}

// The outputs the task reports, as "name (type)"; the backend stores a list of
// {name, type, ...} objects, anything else is shown as nothing rather than guessed.
function outputsText(outputs: unknown): string {
  if (!Array.isArray(outputs) || outputs.length === 0) {
    return "none";
  }
  return outputs
    .map((o) => {
      const item = o as { name?: unknown; type?: unknown };
      return typeof item?.name === "string" ? `${item.name} (${typeof item.type === "string" ? item.type : "?"})` : "?";
    })
    .join(", ");
}

export async function showTask(slug: string, options: { json?: boolean } = {}): Promise<void> {
  const task = await resolveTaskBySlug(slug);
  if (!task) {
    return;
  }

  // The API's own task object, unchanged, so a reviewer can read published,
  // has_external_effect, price_in_credit and outputs back after a migration.
  if (options.json) {
    console.log(JSON.stringify(task, null, 2));
    return;
  }

  console.log(`${task.name} (${task.slug})`);
  console.log(task.description);
  if (task.published !== undefined) console.log(`Published: ${task.published ? "yes" : "no"}`);
  if (task.has_external_effect !== undefined) console.log(`Has external effect: ${task.has_external_effect ? "yes" : "no"}`);
  if (task.price_in_credit !== undefined) console.log(`Price: ${task.price_in_credit === null ? "none" : `${task.price_in_credit} credits`}`);
  if (task.outputs !== undefined) console.log(`Outputs: ${outputsText(task.outputs)}`);
  console.log("Parameters:");
  for (const param of specOf(task)) {
    const required = param.required ? ", required" : "";
    const options = param.options
      ? ` -- options: ${param.options.map((o) => o.value).join(", ")}`
      : "";
    console.log(
      `  --param ${param.name}=<value>  (${param.type}${required}, default: ${JSON.stringify(param.default)})${options}`,
    );
  }
}

// Splits "key=value" CLI overrides on the first "=" (parameter values are
// always plain strings -- text/textarea/select are the only spec types --
// so no JSON parsing is needed here).
function parseParamOverrides(pairs: string[]): Record<string, string> {
  const overrides: Record<string, string> = {};
  for (const pair of pairs) {
    const separatorIndex = pair.indexOf("=");
    if (separatorIndex === -1) {
      throw new Error(`Invalid --param "${pair}" -- expected key=value.`);
    }
    overrides[pair.slice(0, separatorIndex)] = pair.slice(separatorIndex + 1);
  }
  return overrides;
}

export async function startTask(
  slug: string,
  options: { project?: string; name?: string; param: string[] },
): Promise<void> {
  const task = await resolveTaskBySlug(slug);
  if (!task) {
    return;
  }

  let overrides: Record<string, string>;
  try {
    overrides = parseParamOverrides(options.param);
  } catch (error) {
    console.error(error instanceof Error ? `Error: ${error.message}` : "Error: invalid --param.");
    process.exitCode = 1;
    return;
  }

  // Every spec parameter has a `default` by design -- an unset parameter
  // falls back to it rather than requiring every start to spell out every
  // field, matching how the frontend's form pre-fills from the spec.
  const inputs: Record<string, unknown> = {};
  for (const param of specOf(task)) {
    inputs[param.name] = param.name in overrides ? overrides[param.name] : param.default;
  }

  const taskRun = await handleApiResponse<TaskRun>(
    apiFetch(`/tasks/${task.id}/task-runs`, {
      method: "POST",
      body: JSON.stringify({
        projectId: options.project,
        // Framework-level, not a task parameter -- omitted entirely
        // (not sent as an empty string) so the backend applies its own
        // "<task name> <random word>" default.
        name: options.name,
        inputs,
      }),
    }),
  );
  if (!taskRun) {
    return;
  }

  console.log(
    `Task run ${taskRun.id} "${taskRun.name}" ${taskRun.status} (task: ${slug}, project: ${taskRun.project_id}).`,
  );
  console.log(`Check status with \`88eggs task-runs status ${taskRun.id}\`.`);
}

function specOf(item: { inputs?: TaskParameter[]; parameters?: TaskParameter[] }): TaskParameter[] {
  return item.inputs ?? item.parameters ?? [];
}
