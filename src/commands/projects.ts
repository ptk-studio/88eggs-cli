import { apiFetch, handleApiResponse } from "../lib/api.js";

type Project = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  owner_id: string;
  team_id: string | null;
  owner: { id: string; full_name: string | null } | null;
  team: { id: string; name: string } | null;
};

export async function listProjects(options: { scope?: "mine" | "shared" | "all" }): Promise<void> {
  const query = options.scope && options.scope !== "all" ? `?scope=${options.scope}` : "";

  const body = await handleApiResponse<{ projects: Project[] }>(apiFetch(`/projects${query}`));
  if (!body) {
    return;
  }

  const { projects } = body;

  if (projects.length === 0) {
    console.log("No projects found.");
    return;
  }

  for (const project of projects) {
    const owner = project.owner?.full_name ?? "Unknown";
    const sharing = project.team ? `shared with ${project.team.name}` : `owner: ${owner}`;
    console.log(`${project.name} -- ${sharing} -- updated ${project.updated_at}`);
  }
}
