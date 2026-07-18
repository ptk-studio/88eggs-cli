import { apiFetch, handleApiResponse } from "../lib/api.js";

type Team = { id: string; name: string; role?: string; created_at: string };
type Member = { user_id: string; email?: string; role: string };
type Invitation = { id: string; email: string; created_at: string };

export async function listTeams(): Promise<void> {
  const body = await handleApiResponse<{ teams: Team[] }>(apiFetch("/teams"));
  if (!body) return;
  if (body.teams.length === 0) {
    console.log("You're not in any teams.");
    return;
  }
  for (const t of body.teams) {
    console.log(`${t.id} -- ${t.name}${t.role ? ` (${t.role})` : ""}`);
  }
}

export async function showTeam(teamId: string): Promise<void> {
  const t = await handleApiResponse<Team & { members: Member[] }>(apiFetch(`/teams/${teamId}`));
  if (!t) return;
  console.log(`${t.name} (${t.id})${t.role ? ` -- you are ${t.role}` : ""}`);
  console.log("Members:");
  for (const m of t.members ?? []) {
    console.log(`  ${m.user_id} -- ${m.email ?? ""} (${m.role})`);
  }
}

export async function createTeam(name: string): Promise<void> {
  const t = await handleApiResponse<Team>(
    apiFetch("/teams", { method: "POST", body: JSON.stringify({ name }) }),
  );
  if (!t) return;
  console.log(`Created team ${t.id} "${t.name}" -- you're the owner.`);
}

export async function updateTeam(teamId: string, options: { name?: string }): Promise<void> {
  if (options.name === undefined) {
    console.error("Error: nothing to update -- pass --name.");
    process.exitCode = 1;
    return;
  }
  const t = await handleApiResponse<Team>(
    apiFetch(`/teams/${teamId}`, { method: "PATCH", body: JSON.stringify({ name: options.name }) }),
  );
  if (!t) return;
  console.log(`Renamed team ${t.id} to "${t.name}".`);
}

export async function deleteTeam(teamId: string): Promise<void> {
  const ok = await handleApiResponse<unknown>(apiFetch(`/teams/${teamId}`, { method: "DELETE" }));
  if (ok === null) return;
  console.log(`Deleted team ${teamId}.`);
}

export async function listTeamMembers(teamId: string): Promise<void> {
  const body = await handleApiResponse<{ members: Member[] }>(
    apiFetch(`/teams/${teamId}/members`),
  );
  if (!body) return;
  for (const m of body.members) {
    console.log(`${m.user_id} -- ${m.email ?? ""} (${m.role})`);
  }
}

export async function removeTeamMember(teamId: string, userId: string): Promise<void> {
  const ok = await handleApiResponse<unknown>(
    apiFetch(`/teams/${teamId}/members/${userId}`, { method: "DELETE" }),
  );
  if (ok === null) return;
  console.log(`Removed ${userId} from team ${teamId}.`);
}

export async function listTeamInvitations(teamId: string): Promise<void> {
  const body = await handleApiResponse<{ invitations: Invitation[] }>(
    apiFetch(`/teams/${teamId}/invitations`),
  );
  if (!body) return;
  if (body.invitations.length === 0) {
    console.log("No pending invitations.");
    return;
  }
  for (const i of body.invitations) {
    console.log(`${i.id} -- ${i.email} -- ${i.created_at}`);
  }
}

export async function inviteToTeam(teamId: string, email: string): Promise<void> {
  const i = await handleApiResponse<Invitation>(
    apiFetch(`/teams/${teamId}/invitations`, { method: "POST", body: JSON.stringify({ email }) }),
  );
  if (!i) return;
  console.log(`Invited ${email} to team ${teamId} (invitation ${i.id}).`);
}

export async function revokeTeamInvitation(teamId: string, invitationId: string): Promise<void> {
  const ok = await handleApiResponse<unknown>(
    apiFetch(`/teams/${teamId}/invitations/${invitationId}`, { method: "DELETE" }),
  );
  if (ok === null) return;
  console.log(`Revoked invitation ${invitationId}.`);
}

export async function acceptInvitation(invitationId: string): Promise<void> {
  const ok = await handleApiResponse<unknown>(
    apiFetch(`/invitations/${invitationId}/accept`, { method: "POST" }),
  );
  if (ok === null) return;
  console.log(`Accepted invitation ${invitationId}.`);
}

export async function declineInvitation(invitationId: string): Promise<void> {
  const ok = await handleApiResponse<unknown>(
    apiFetch(`/invitations/${invitationId}/decline`, { method: "POST" }),
  );
  if (ok === null) return;
  console.log(`Declined invitation ${invitationId}.`);
}
