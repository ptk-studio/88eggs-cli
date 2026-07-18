import { apiFetch, handleApiResponse } from "../lib/api.js";

type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  description: string | null;
};

export async function showProfile(): Promise<void> {
  const p = await handleApiResponse<Profile>(apiFetch("/profile"));
  if (!p) return;
  console.log(`${p.full_name ?? "(no name)"} <${p.email}>`);
  console.log(`Id: ${p.id}`);
  if (p.description) console.log(`Description: ${p.description}`);
}

export async function updateProfile(options: {
  name?: string;
  description?: string;
}): Promise<void> {
  const body: Record<string, unknown> = {};
  if (options.name !== undefined) body.full_name = options.name;
  if (options.description !== undefined) body.description = options.description;
  if (Object.keys(body).length === 0) {
    console.error("Error: nothing to update -- pass --name and/or --description.");
    process.exitCode = 1;
    return;
  }
  const p = await handleApiResponse<Profile>(
    apiFetch("/profile", { method: "PATCH", body: JSON.stringify(body) }),
  );
  if (!p) return;
  console.log(`Updated profile: ${p.full_name ?? "(no name)"} <${p.email}>.`);
}
