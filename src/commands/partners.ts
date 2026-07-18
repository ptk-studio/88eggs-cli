import { apiFetch, handleApiResponse } from "../lib/api.js";

// Partner profiles: the publisher identity behind ptk-studio/* task definitions
// and app listings. A user can own partner profiles (start pending review) and
// browse approved ones' public pages. See 88eggs-backend /partner-profiles and
// /partners/:slug.
type PartnerProfile = {
  id: string;
  name: string;
  slug: string;
  status: string;
  description: string | null;
};

type TaskDefinitionSummary = {
  slug: string;
  name: string;
  description: string;
};

export async function listPartnerProfiles(): Promise<void> {
  const body = await handleApiResponse<{ partner_profiles: PartnerProfile[] }>(
    apiFetch("/partner-profiles"),
  );
  if (!body) return;
  if (body.partner_profiles.length === 0) {
    console.log("You don't own any partner profiles.");
    return;
  }
  for (const p of body.partner_profiles) {
    console.log(`${p.id} -- ${p.name} (${p.slug}) -- ${p.status}`);
  }
}

export async function showPartnerProfile(partnerProfileId: string): Promise<void> {
  const p = await handleApiResponse<PartnerProfile>(
    apiFetch(`/partner-profiles/${partnerProfileId}`),
  );
  if (!p) return;
  console.log(`${p.name} (${p.slug}) -- ${p.status}`);
  console.log(`Id: ${p.id}`);
  if (p.description) console.log(p.description);
}

export async function createPartnerProfile(options: {
  name?: string;
  slug?: string;
  email?: string;
  description?: string;
}): Promise<void> {
  if (!options.name || !options.slug || !options.email) {
    console.error("Error: --name, --slug, and --email are required.");
    process.exitCode = 1;
    return;
  }
  const p = await handleApiResponse<PartnerProfile>(
    apiFetch("/partner-profiles", {
      method: "POST",
      body: JSON.stringify({
        name: options.name,
        slug: options.slug,
        email: options.email,
        description: options.description,
      }),
    }),
  );
  if (!p) return;
  console.log(`Created partner profile ${p.id} "${p.name}" (${p.slug}) -- ${p.status}.`);
}

export async function listPartnerProfileTaskDefinitions(
  partnerProfileId: string,
): Promise<void> {
  const body = await handleApiResponse<{ task_definitions: TaskDefinitionSummary[] }>(
    apiFetch(`/partner-profiles/${partnerProfileId}/task-definitions`),
  );
  if (!body) return;
  for (const d of body.task_definitions) {
    console.log(`${d.slug} -- ${d.name} -- ${d.description}`);
  }
}

// Public partner page + its published task definitions, by slug.
export async function showPartner(slug: string): Promise<void> {
  const p = await handleApiResponse<PartnerProfile>(apiFetch(`/partners/${slug}`));
  if (!p) return;
  console.log(`${p.name} (${p.slug})`);
  if (p.description) console.log(p.description);
}

export async function listPartnerTaskDefinitions(slug: string): Promise<void> {
  const body = await handleApiResponse<{ task_definitions: TaskDefinitionSummary[] }>(
    apiFetch(`/partners/${slug}/task-definitions`),
  );
  if (!body) return;
  for (const d of body.task_definitions) {
    console.log(`${d.slug} -- ${d.name} -- ${d.description}`);
  }
}
