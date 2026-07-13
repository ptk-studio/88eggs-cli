import { apiFetch, handleApiResponse } from "../lib/api.js";

type PipelineDefinitionParameter = {
  name: string;
  type: "text" | "textarea" | "select";
  label: string;
  default: unknown;
  required: boolean;
  options?: { value: string; label: string }[];
};

type PipelineDefinitionSummary = {
  id: string;
  slug: string;
  name: string;
  description: string;
  created_at: string;
};

type PipelineDefinitionDetail = PipelineDefinitionSummary & {
  parameters: PipelineDefinitionParameter[];
};

type PipelineSummary = {
  id: string;
  pipeline_definition_id: string;
  project_id: string;
  name: string | null;
  status: "running" | "to_be_reviewed" | "completed" | "failed";
  current_step_key: string | null;
  error: string | null;
  cost_usd: string | number | null;
  created_at: string;
  updated_at: string;
};

// step_state: one entry per started step. A task_definition/evaluation step
// records its child task; a review step records the decision.
type StepState = {
  status?: string;
  task_id?: string;
  outputs?: Record<string, unknown> | null;
  review?: { state?: string; fields?: Record<string, unknown> } | null;
  started_at?: string;
  finished_at?: string;
};

type PipelineDetail = PipelineSummary & {
  inputs: Record<string, unknown>;
  steps: { key: string; type: string; label?: string }[];
  step_state: Record<string, StepState>;
};

type PipelineListResponse = {
  pipelines: PipelineSummary[];
  page: number;
  limit: number;
  total: number;
};

async function resolveDefinitionBySlug(
  slug: string,
): Promise<PipelineDefinitionDetail | null> {
  const list = await handleApiResponse<{ pipeline_definitions: PipelineDefinitionSummary[] }>(
    apiFetch("/pipeline-definitions"),
  );
  if (!list) {
    return null;
  }
  const match = list.pipeline_definitions.find((definition) => definition.slug === slug);
  if (!match) {
    console.error(`Error: No pipeline definition found with slug "${slug}".`);
    process.exitCode = 1;
    return null;
  }
  return handleApiResponse<PipelineDefinitionDetail>(
    apiFetch(`/pipeline-definitions/${match.id}`),
  );
}

export async function listPipelineDefinitions(): Promise<void> {
  const body = await handleApiResponse<{ pipeline_definitions: PipelineDefinitionSummary[] }>(
    apiFetch("/pipeline-definitions"),
  );
  if (!body) {
    return;
  }
  if (body.pipeline_definitions.length === 0) {
    console.log("No pipeline definitions found.");
    return;
  }
  for (const definition of body.pipeline_definitions) {
    console.log(`${definition.slug} -- ${definition.name} -- ${definition.description}`);
  }
}

export async function showPipelineDefinition(slug: string): Promise<void> {
  const definition = await resolveDefinitionBySlug(slug);
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

export async function startPipeline(
  slug: string,
  options: { project?: string; name?: string; param: string[] },
): Promise<void> {
  const definition = await resolveDefinitionBySlug(slug);
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

  const inputs: Record<string, unknown> = {};
  for (const param of definition.parameters) {
    inputs[param.name] = param.name in overrides ? overrides[param.name] : param.default;
  }

  const pipeline = await handleApiResponse<PipelineSummary>(
    apiFetch("/pipelines", {
      method: "POST",
      body: JSON.stringify({
        definitionSlug: slug,
        projectId: options.project,
        name: options.name,
        inputs,
      }),
    }),
  );
  if (!pipeline) {
    return;
  }

  console.log(
    `Pipeline ${pipeline.id} "${pipeline.name}" ${pipeline.status} (definition: ${slug}, project: ${pipeline.project_id}).`,
  );
  console.log(`Check status with \`88eggs pipelines status ${pipeline.id}\`.`);
}

export async function listPipelines(options: {
  project?: string;
  page?: string;
  limit?: string;
}): Promise<void> {
  const params = new URLSearchParams();
  if (options.project) params.set("projectId", options.project);
  if (options.page) params.set("page", options.page);
  if (options.limit) params.set("limit", options.limit);
  const query = params.toString() ? `?${params.toString()}` : "";

  const body = await handleApiResponse<PipelineListResponse>(
    apiFetch(`/pipelines${query}`),
  );
  if (!body) {
    return;
  }
  if (body.pipelines.length === 0) {
    console.log("No pipelines found.");
    return;
  }
  for (const pipeline of body.pipelines) {
    const name = pipeline.name ? ` "${pipeline.name}"` : "";
    const step = pipeline.current_step_key ? ` -- at ${pipeline.current_step_key}` : "";
    console.log(`${pipeline.id}${name} -- ${pipeline.status}${step} -- project ${pipeline.project_id}`);
  }
  console.log(`-- page ${body.page} (limit ${body.limit}, total ${body.total})`);
}

export async function pipelineStatus(pipelineId: string): Promise<void> {
  const pipeline = await handleApiResponse<PipelineDetail>(
    apiFetch(`/pipelines/${pipelineId}`),
  );
  if (!pipeline) {
    return;
  }

  console.log(`Pipeline: ${pipeline.id}`);
  if (pipeline.name) {
    console.log(`Name: ${pipeline.name}`);
  }
  console.log(`Status: ${pipeline.status}`);
  if (pipeline.current_step_key) {
    console.log(`Current step: ${pipeline.current_step_key}`);
  }
  if (pipeline.error) {
    console.log(`Error: ${pipeline.error}`);
  }
  if (pipeline.cost_usd !== null) {
    console.log(`Cost: $${pipeline.cost_usd}`);
  }
  console.log("Steps:");
  for (const step of pipeline.steps) {
    const state = pipeline.step_state[step.key];
    const status = state?.status ?? (state?.review ? (state.review.state ?? "pending review") : "not started");
    const task = state?.task_id ? ` -- task ${state.task_id}` : "";
    const review =
      step.type === "review" && pipeline.status === "to_be_reviewed" && pipeline.current_step_key === step.key
        ? " -- AWAITING REVIEW (see `pipelines review`)"
        : "";
    console.log(`  ${step.key} (${step.type}) -- ${status}${task}${review}`);
  }
}

// Approve (optionally overriding gate fields) or reject (re-roll) the
// pipeline's current review step.
export async function reviewPipeline(
  pipelineId: string,
  options: { approve?: boolean; reject?: boolean; field: string[] },
): Promise<void> {
  if (options.approve === options.reject) {
    console.error("Error: pass exactly one of --approve or --reject.");
    process.exitCode = 1;
    return;
  }

  let fields: Record<string, string> | undefined;
  if (options.field.length > 0) {
    try {
      fields = parseParamOverrides(options.field);
    } catch (error) {
      console.error(error instanceof Error ? `Error: ${error.message}` : "Error: invalid --field.");
      process.exitCode = 1;
      return;
    }
  }

  const pipeline = await handleApiResponse<PipelineSummary>(
    apiFetch(`/pipelines/${pipelineId}/review`, {
      method: "POST",
      body: JSON.stringify({ approved: Boolean(options.approve), fields }),
    }),
  );
  if (!pipeline) {
    return;
  }
  console.log(`Pipeline ${pipeline.id} ${pipeline.status} -- decision recorded.`);
  console.log(`Check progress with \`88eggs pipelines status ${pipeline.id}\`.`);
}

export async function retryPipeline(pipelineId: string): Promise<void> {
  const pipeline = await handleApiResponse<PipelineSummary>(
    apiFetch(`/pipelines/${pipelineId}/retry`, { method: "POST" }),
  );
  if (!pipeline) {
    return;
  }
  console.log(`Pipeline ${pipeline.id} ${pipeline.status} -- retrying from ${pipeline.current_step_key ?? "the failed step"}.`);
}
