import { apiFetch, handleApiResponse } from "../lib/api.js";

type Template = {
  id: string;
  name: string;
  description: string | null;
  type: string;
  created_at: string;
};

function query(params: Record<string, string | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
  const s = q.toString();
  return s ? `?${s}` : "";
}

export async function listTemplates(options: {
  type?: string;
  q?: string;
  page?: string;
  limit?: string;
}): Promise<void> {
  const body = await handleApiResponse<{ templates: Template[] }>(
    apiFetch(`/templates${query(options)}`),
  );
  if (!body) return;
  if (body.templates.length === 0) {
    console.log("No templates found.");
    return;
  }
  for (const t of body.templates) {
    console.log(`${t.id} -- ${t.name} -- [${t.type}] -- ${t.description ?? ""}`);
  }
}

export async function showTemplate(templateId: string): Promise<void> {
  const t = await handleApiResponse<Template & { content?: unknown }>(
    apiFetch(`/templates/${templateId}`),
  );
  if (!t) return;
  console.log(`${t.name} (${t.id})`);
  console.log(`Type: ${t.type}`);
  if (t.description) console.log(t.description);
}

// Materialize a template into a project: pipeline-definition -> a new pipeline
// definition; data-table -> a new data table.
export async function cloneTemplate(
  templateId: string,
  options: { project?: string; name?: string },
): Promise<void> {
  const result = await handleApiResponse<{ id: string; name?: string }>(
    apiFetch(`/templates/${templateId}/clone`, {
      method: "POST",
      body: JSON.stringify({ projectId: options.project, name: options.name }),
    }),
  );
  if (!result) return;
  console.log(`Cloned template into ${result.id}${result.name ? ` "${result.name}"` : ""}.`);
}
