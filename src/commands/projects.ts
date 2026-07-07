import { apiFetch, isErrorBody } from "../lib/api.js";

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

  let response: Response;
  try {
    response = await apiFetch(`/projects${query}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Request failed.");
    process.exitCode = 1;
    return;
  }

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const message = isErrorBody(body)
      ? body.error
      : `Request failed with status ${response.status}`;
    console.error(`Error: ${message}`);
    process.exitCode = 1;
    return;
  }

  const { projects } = body as { projects: Project[] };

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
