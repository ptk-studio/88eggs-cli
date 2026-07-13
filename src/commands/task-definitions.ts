import { apiFetch, handleApiResponse } from "../lib/api.js";

type TaskDefinitionParameter = {
  name: string;
  type: "text" | "textarea" | "select";
  label: string;
  default: unknown;
  required: boolean;
  options?: { value: string; label: string }[];
};

type TaskDefinitionSummary = {
  id: string;
  slug: string;
  name: string;
  description: string;
  created_at: string;
};

type TaskDefinitionDetail = TaskDefinitionSummary & {
  parameters: TaskDefinitionParameter[];
};

type Task = {
  id: string;
  task_definition_id: string;
  project_id: string;
  created_by: string;
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown> | null;
  name: string | null;
  status: "queued" | "accepted" | "running" | "succeeded" | "failed";
  error: string | null;
  cost_usd: number | null;
  created_at: string;
  updated_at: string;
};

// The API takes a task definition's id, not its slug -- every command here
// takes a human-friendly slug on the command line, so this is the one
// lookup they all share: list the catalog, find the matching slug, error
// out clearly if there's no such definition. Returns null after already
// printing/exiting on failure, same convention as handleApiResponse.
async function resolveTaskDefinitionBySlug(
  slug: string,
): Promise<TaskDefinitionDetail | null> {
  const list = await handleApiResponse<{ task_definitions: TaskDefinitionSummary[] }>(
    apiFetch("/task-definitions"),
  );
  if (!list) {
    return null;
  }

  const match = list.task_definitions.find((definition) => definition.slug === slug);
  if (!match) {
    console.error(`Error: No task definition found with slug "${slug}".`);
    process.exitCode = 1;
    return null;
  }

  return handleApiResponse<TaskDefinitionDetail>(
    apiFetch(`/task-definitions/${match.id}`),
  );
}

export async function listTaskDefinitions(): Promise<void> {
  const body = await handleApiResponse<{ task_definitions: TaskDefinitionSummary[] }>(
    apiFetch("/task-definitions"),
  );
  if (!body) {
    return;
  }

  if (body.task_definitions.length === 0) {
    console.log("No task definitions found.");
    return;
  }

  for (const definition of body.task_definitions) {
    console.log(`${definition.slug} -- ${definition.name} -- ${definition.description}`);
  }
}

export async function showTaskDefinition(slug: string): Promise<void> {
  const definition = await resolveTaskDefinitionBySlug(slug);
  if (!definition) {
    return;
  }

  console.log(`${definition.name} (${definition.slug})`);
  console.log(definition.description);
  console.log("Parameters:");
  for (const param of definition.parameters) {
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
  const definition = await resolveTaskDefinitionBySlug(slug);
  if (!definition) {
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
  for (const param of definition.parameters) {
    inputs[param.name] = param.name in overrides ? overrides[param.name] : param.default;
  }

  const task = await handleApiResponse<Task>(
    apiFetch(`/task-definitions/${definition.id}/tasks`, {
      method: "POST",
      body: JSON.stringify({
        projectId: options.project,
        // Framework-level, not a definition parameter -- omitted entirely
        // (not sent as an empty string) so the backend applies its own
        // "<task definition name> <random word>" default.
        name: options.name,
        inputs,
      }),
    }),
  );
  if (!task) {
    return;
  }

  console.log(
    `Task ${task.id} "${task.name}" ${task.status} (task definition: ${slug}, project: ${task.project_id}).`,
  );
  console.log(`Check status with \`88eggs tasks status ${task.id}\`.`);
}
