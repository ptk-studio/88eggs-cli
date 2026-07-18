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
    console.log(`${project.id} -- ${project.name} -- ${sharing} -- updated ${project.updated_at}`);
  }
}

export async function showProject(projectId: string): Promise<void> {
  const p = await handleApiResponse<
    Project & { permissions?: { canEdit: boolean; canManageSharing: boolean } }
  >(apiFetch(`/projects/${projectId}`));
  if (!p) return;
  const owner = p.owner?.full_name ?? "Unknown";
  console.log(`${p.name} (${p.id})`);
  console.log(p.team ? `Shared with team ${p.team.name}` : `Owner: ${owner}`);
  if (p.description) console.log(`Description: ${p.description}`);
  if (p.permissions) console.log(`You can edit: ${p.permissions.canEdit}`);
}

export async function createProject(
  name: string,
  options: { description?: string; team?: string },
): Promise<void> {
  const p = await handleApiResponse<Project>(
    apiFetch("/projects", {
      method: "POST",
      body: JSON.stringify({ name, description: options.description, teamId: options.team }),
    }),
  );
  if (!p) return;
  console.log(`Created project ${p.id} "${p.name}".`);
}

export async function updateProject(
  projectId: string,
  options: { name?: string; description?: string; team?: string },
): Promise<void> {
  const body: Record<string, unknown> = {};
  if (options.name !== undefined) body.name = options.name;
  if (options.description !== undefined) body.description = options.description;
  if (options.team !== undefined) body.teamId = options.team;
  if (Object.keys(body).length === 0) {
    console.error("Error: nothing to update -- pass --name, --description, or --team.");
    process.exitCode = 1;
    return;
  }
  const p = await handleApiResponse<Project>(
    apiFetch(`/projects/${projectId}`, { method: "PATCH", body: JSON.stringify(body) }),
  );
  if (!p) return;
  console.log(`Updated project ${p.id} "${p.name}".`);
}

export async function deleteProject(projectId: string): Promise<void> {
  const ok = await handleApiResponse<unknown>(
    apiFetch(`/projects/${projectId}`, { method: "DELETE" }),
  );
  if (ok === null) return;
  console.log(`Deleted project ${projectId}.`);
}
