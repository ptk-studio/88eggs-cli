import { apiFetch, handleApiResponse } from "../lib/api.js";

type WorkflowParameter = {
  name: string;
  type: "text" | "textarea" | "select";
  label: string;
  default: unknown;
  required: boolean;
  options?: { value: string; label: string }[];
};

type WorkflowSummary = {
  id: string;
  slug: string;
  name: string;
  description: string;
  created_at: string;
};

type WorkflowDetail = WorkflowSummary & { parameters: WorkflowParameter[] };

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

// The API takes a workflow's id, not its slug (see the feature doc) --
// every command here takes a human-friendly slug on the command line, so
// this is the one lookup they all share: list the catalog, find the
// matching slug, error out clearly if there's no such workflow. Returns
// null after already printing/exiting on failure, same convention as
// handleApiResponse.
async function resolveWorkflowBySlug(slug: string): Promise<WorkflowDetail | null> {
  const list = await handleApiResponse<{ workflows: WorkflowSummary[] }>(
    apiFetch("/workflows"),
  );
  if (!list) {
    return null;
  }

  const match = list.workflows.find((workflow) => workflow.slug === slug);
  if (!match) {
    console.error(`Error: No workflow found with slug "${slug}".`);
    process.exitCode = 1;
    return null;
  }

  return handleApiResponse<WorkflowDetail>(apiFetch(`/workflows/${match.id}`));
}

export async function listWorkflows(): Promise<void> {
  const body = await handleApiResponse<{ workflows: WorkflowSummary[] }>(apiFetch("/workflows"));
  if (!body) {
    return;
  }

  if (body.workflows.length === 0) {
    console.log("No workflows found.");
    return;
  }

  for (const workflow of body.workflows) {
    console.log(`${workflow.slug} -- ${workflow.name} -- ${workflow.description}`);
  }
}

export async function showWorkflow(slug: string): Promise<void> {
  const workflow = await resolveWorkflowBySlug(slug);
  if (!workflow) {
    return;
  }

  console.log(`${workflow.name} (${workflow.slug})`);
  console.log(workflow.description);
  console.log("Parameters:");
  for (const param of workflow.parameters) {
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
// always plain strings -- text/textarea/select are the only spec types,
// see the feature doc -- so no JSON parsing is needed here).
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

export async function runWorkflow(
  slug: string,
  options: { project?: string; name?: string; param: string[] },
): Promise<void> {
  const workflow = await resolveWorkflowBySlug(slug);
  if (!workflow) {
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

  // Every spec parameter has a `default` by design (see the feature
  // doc) -- an unset parameter falls back to it rather than requiring
  // every run to spell out every field, matching how the frontend's run
  // page pre-fills entirely from the spec.
  const parameters: Record<string, unknown> = {};
  for (const param of workflow.parameters) {
    parameters[param.name] = param.name in overrides ? overrides[param.name] : param.default;
  }

  const run = await handleApiResponse<Run>(
    apiFetch(`/workflows/${workflow.id}/runs`, {
      method: "POST",
      body: JSON.stringify({
        projectId: options.project,
        // Framework-level, not a workflow parameter -- omitted entirely
        // (not sent as an empty string) so the backend applies its own
        // "<workflow name> <random word>" default.
        name: options.name,
        parameters,
      }),
    }),
  );
  if (!run) {
    return;
  }

  console.log(`Run ${run.id} "${run.name}" ${run.status} (workflow: ${slug}, project: ${run.project_id}).`);
  console.log(`Check status with \`88eggs runs status ${run.id}\`.`);
}
