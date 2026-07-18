import { apiFetch, handleApiResponse } from "../lib/api.js";

// Task Inputs: saved presets of a task definition's inputs (the caller's own or
// published), reusable when starting a task. See 88eggs-backend /task-inputs.
type TaskInputTemplate = {
  id: string;
  name: string;
  description: string | null;
  inputs: Record<string, unknown>;
  task_definition_name?: string;
  task_definition_slug?: string;
  published?: boolean;
};

export async function listTaskInputs(options: { project?: string }): Promise<void> {
  const q = options.project ? `?projectId=${encodeURIComponent(options.project)}` : "";
  const body = await handleApiResponse<{ templates: TaskInputTemplate[] }>(
    apiFetch(`/task-inputs${q}`),
  );
  if (!body) return;
  if (body.templates.length === 0) {
    console.log("No task inputs found.");
    return;
  }
  for (const t of body.templates) {
    const def = t.task_definition_slug ? ` -- ${t.task_definition_slug}` : "";
    console.log(`${t.id} -- ${t.name}${def}${t.published ? " (published)" : ""}`);
  }
}

export async function showTaskInput(templateId: string): Promise<void> {
  const t = await handleApiResponse<TaskInputTemplate>(apiFetch(`/task-inputs/${templateId}`));
  if (!t) return;
  console.log(`${t.name} (${t.id})`);
  if (t.task_definition_slug) console.log(`Task definition: ${t.task_definition_slug}`);
  if (t.description) console.log(t.description);
  console.log(`Inputs: ${JSON.stringify(t.inputs)}`);
}

// Save a run task's own inputs as a new personal task-input template.
export async function saveTaskInputs(
  taskId: string,
  options: { name?: string; description?: string },
): Promise<void> {
  if (!options.name) {
    console.error("Error: --name is required.");
    process.exitCode = 1;
    return;
  }
  const t = await handleApiResponse<TaskInputTemplate>(
    apiFetch(`/tasks/${taskId}/templates`, {
      method: "POST",
      body: JSON.stringify({ name: options.name, description: options.description }),
    }),
  );
  if (!t) return;
  console.log(`Saved task ${taskId}'s inputs as task input ${t.id} "${t.name}".`);
}
