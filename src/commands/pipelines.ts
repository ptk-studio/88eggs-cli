import { apiFetch, handleApiResponse } from "../lib/api.js";

type PipelineParameter = {
  name: string;
  type: "text" | "textarea" | "select";
  label: string;
  default: unknown;
  required: boolean;
  options?: { value: string; label: string }[];
};

type PipelineSummary = {
  id: string;
  slug: string;
  name: string;
  description: string;
  created_at: string;
};

type PipelineDetail = PipelineSummary & {
  parameters: PipelineParameter[];
};

type PipelineRunSummary = {
  id: string;
  pipeline_id: string;
  project_id: string;
  name: string | null;
  status: "running" | "to_be_reviewed" | "completed" | "failed";
  current_step_key: string | null;
  error: string | null;
  cost_usd: string | number | null;
  created_at: string;
  updated_at: string;
};

// step_state: one entry per started step. A task/evaluation step
// records its child task run; a review step records the decision.
type StepState = {
  status?: string;
  task_run_id?: string;
  outputs?: Record<string, unknown> | null;
  review?: { state?: string; fields?: Record<string, unknown> } | null;
  started_at?: string;
  finished_at?: string;
};

type PipelineRunDetail = PipelineRunSummary & {
  inputs: Record<string, unknown>;
  steps: { key: string; type: string; label?: string }[];
  step_state: Record<string, StepState>;
};

type PipelineRunListResponse = {
  pipeline_runs: PipelineRunSummary[];
  page: number;
  limit: number;
  total: number;
};

async function resolvePipelineBySlug(
  slug: string,
): Promise<PipelineDetail | null> {
  const list = await handleApiResponse<{ pipelines: PipelineSummary[] }>(
    apiFetch("/pipelines"),
  );
  if (!list) {
    return null;
  }
  const match = list.pipelines.find((pipeline) => pipeline.slug === slug);
  if (!match) {
    console.error(`Error: No pipeline found with slug "${slug}".`);
    process.exitCode = 1;
    return null;
  }
  return handleApiResponse<PipelineDetail>(
    apiFetch(`/pipelines/${match.id}`),
  );
}

export async function listPipelines(
  options: { project?: string } = {},
): Promise<void> {
  const query = options.project
    ? `?projectId=${encodeURIComponent(options.project)}`
    : "";
  const body = await handleApiResponse<{ pipelines: PipelineSummary[] }>(
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
    console.log(`${pipeline.slug} -- ${pipeline.name} -- ${pipeline.description}`);
  }
}

export async function showPipeline(slug: string): Promise<void> {
  const pipeline = await resolvePipelineBySlug(slug);
  if (!pipeline) {
    return;
  }
  console.log(`${pipeline.name} (${pipeline.slug})`);
  console.log(pipeline.description);
  console.log("Parameters:");
  for (const param of pipeline.parameters) {
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

export async function startPipelineRun(
  slug: string,
  options: { project?: string; name?: string; param: string[] },
): Promise<void> {
  const pipeline = await resolvePipelineBySlug(slug);
  if (!pipeline) {
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
  for (const param of pipeline.parameters) {
    inputs[param.name] = param.name in overrides ? overrides[param.name] : param.default;
  }

  const pipelineRun = await handleApiResponse<PipelineRunSummary>(
    apiFetch("/pipeline-runs", {
      method: "POST",
      body: JSON.stringify({
        definitionSlug: slug,
        projectId: options.project,
        name: options.name,
        inputs,
      }),
    }),
  );
  if (!pipelineRun) {
    return;
  }

  console.log(
    `Pipeline run ${pipelineRun.id} "${pipelineRun.name}" ${pipelineRun.status} (pipeline: ${slug}, project: ${pipelineRun.project_id}).`,
  );
  console.log(`Check status with \`88eggs pipeline-runs status ${pipelineRun.id}\`.`);
}

export async function listPipelineRuns(options: {
  project?: string;
  page?: string;
  limit?: string;
}): Promise<void> {
  const params = new URLSearchParams();
  if (options.project) params.set("projectId", options.project);
  if (options.page) params.set("page", options.page);
  if (options.limit) params.set("limit", options.limit);
  const query = params.toString() ? `?${params.toString()}` : "";

  const body = await handleApiResponse<PipelineRunListResponse>(
    apiFetch(`/pipeline-runs${query}`),
  );
  if (!body) {
    return;
  }
  if (body.pipeline_runs.length === 0) {
    console.log("No pipeline runs found.");
    return;
  }
  for (const pipelineRun of body.pipeline_runs) {
    const name = pipelineRun.name ? ` "${pipelineRun.name}"` : "";
    const step = pipelineRun.current_step_key ? ` -- at ${pipelineRun.current_step_key}` : "";
    console.log(`${pipelineRun.id}${name} -- ${pipelineRun.status}${step} -- project ${pipelineRun.project_id}`);
  }
  console.log(`-- page ${body.page} (limit ${body.limit}, total ${body.total})`);
}

export async function pipelineRunStatus(pipelineRunId: string): Promise<void> {
  const pipelineRun = await handleApiResponse<PipelineRunDetail>(
    apiFetch(`/pipeline-runs/${pipelineRunId}`),
  );
  if (!pipelineRun) {
    return;
  }

  console.log(`Pipeline run: ${pipelineRun.id}`);
  if (pipelineRun.name) {
    console.log(`Name: ${pipelineRun.name}`);
  }
  console.log(`Status: ${pipelineRun.status}`);
  if (pipelineRun.current_step_key) {
    console.log(`Current step: ${pipelineRun.current_step_key}`);
  }
  if (pipelineRun.error) {
    console.log(`Error: ${pipelineRun.error}`);
  }
  if (pipelineRun.cost_usd !== null) {
    console.log(`Cost: $${pipelineRun.cost_usd}`);
  }
  console.log("Steps:");
  for (const step of pipelineRun.steps) {
    const state = pipelineRun.step_state[step.key];
    const status = state?.status ?? (state?.review ? (state.review.state ?? "pending review") : "not started");
    const taskRun = state?.task_run_id ? ` -- task run ${state.task_run_id}` : "";
    const review =
      step.type === "review" && pipelineRun.status === "to_be_reviewed" && pipelineRun.current_step_key === step.key
        ? " -- AWAITING REVIEW (see `pipeline-runs review`)"
        : "";
    console.log(`  ${step.key} (${step.type}) -- ${status}${taskRun}${review}`);
  }
}

// Approve (optionally overriding gate fields) or reject (re-roll) the
// pipeline run's current review step.
export async function reviewPipelineRun(
  pipelineRunId: string,
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

  const pipelineRun = await handleApiResponse<PipelineRunSummary>(
    apiFetch(`/pipeline-runs/${pipelineRunId}/review`, {
      method: "POST",
      body: JSON.stringify({ approved: Boolean(options.approve), fields }),
    }),
  );
  if (!pipelineRun) {
    return;
  }
  console.log(`Pipeline run ${pipelineRun.id} ${pipelineRun.status} -- decision recorded.`);
  console.log(`Check progress with \`88eggs pipeline-runs status ${pipelineRun.id}\`.`);
}

export async function retryPipelineRun(pipelineRunId: string): Promise<void> {
  const pipelineRun = await handleApiResponse<PipelineRunSummary>(
    apiFetch(`/pipeline-runs/${pipelineRunId}/retry`, { method: "POST" }),
  );
  if (!pipelineRun) {
    return;
  }
  console.log(`Pipeline run ${pipelineRun.id} ${pipelineRun.status} -- retrying from ${pipelineRun.current_step_key ?? "the failed step"}.`);
}

export async function clonePipeline(slug: string): Promise<void> {
  const def = await resolvePipelineBySlug(slug);
  if (!def) return;
  const clone = await handleApiResponse<{ id: string; slug: string; name: string }>(
    apiFetch(`/pipelines/${def.id}/clone`, { method: "POST" }),
  );
  if (!clone) return;
  console.log(`Cloned "${def.name}" -> ${clone.id} "${clone.name}" (slug: ${clone.slug}).`);
}

export async function publishPipeline(
  slug: string,
  options: { name?: string; description?: string },
): Promise<void> {
  const def = await resolvePipelineBySlug(slug);
  if (!def) return;
  const tpl = await handleApiResponse<{ id: string; name: string }>(
    apiFetch(`/pipelines/${def.id}/publish`, {
      method: "POST",
      body: JSON.stringify({ name: options.name, description: options.description }),
    }),
  );
  if (!tpl) return;
  console.log(`Published "${def.name}" as template ${tpl.id} "${tpl.name}".`);
}

async function setPipelineStatus(slug: string, status: "active" | "archived"): Promise<void> {
  const def = await resolvePipelineBySlug(slug);
  if (!def) return;
  const updated = await handleApiResponse<{ id: string; name: string }>(
    apiFetch(`/pipelines/${def.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  );
  if (!updated) return;
  console.log(`${status === "archived" ? "Archived" : "Restored"} pipeline "${def.name}".`);
}

export async function archivePipeline(slug: string): Promise<void> {
  await setPipelineStatus(slug, "archived");
}

export async function restorePipeline(slug: string): Promise<void> {
  await setPipelineStatus(slug, "active");
}
