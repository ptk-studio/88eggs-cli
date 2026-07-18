import { apiFetch, handleApiResponse } from "../lib/api.js";

type Model = {
  id: string;
  provider: string;
  capability: string;
  reference_cost_usd?: number | null;
};

export async function listModels(): Promise<void> {
  const body = await handleApiResponse<{ models: Model[] }>(apiFetch("/models"));
  if (!body) return;
  if (body.models.length === 0) {
    console.log("No models found.");
    return;
  }
  for (const m of body.models) {
    console.log(`${m.id} -- ${m.provider} -- ${m.capability}`);
  }
}
