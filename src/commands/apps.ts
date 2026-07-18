import { apiFetch, handleApiResponse } from "../lib/api.js";

// The installable-app catalog (Discover > App Store). Owned by a partner
// profile; only active listings are returned by GET /app-listings.
type AppListing = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon_url: string | null;
  partner_profile_id: string;
  status: "active" | "deprecated";
  created_at: string;
  updated_at: string;
};

// An installed instance of a listing inside a project. 'archived' is the
// v1 "uninstall" -- the row is kept but hidden from the installed list.
type App = {
  id: string;
  project_id: string;
  listing_id: string;
  name: string;
  status: "active" | "archived";
  created_by: string;
  created_at: string;
  updated_at: string;
};

type AppPage = {
  id: string;
  app_id: string;
  title: string | null;
  slug: string;
  status: "active" | "archived";
  created_by: string;
  created_at: string;
  updated_at: string;
};

export async function listAppCatalog(): Promise<void> {
  const body = await handleApiResponse<{ app_listings: AppListing[] }>(
    apiFetch("/app-listings"),
  );
  if (!body) {
    return;
  }

  if (body.app_listings.length === 0) {
    console.log("No apps available in the catalog.");
    return;
  }

  for (const listing of body.app_listings) {
    console.log(`${listing.slug} -- ${listing.name} -- ${listing.description ?? ""}`);
  }
}

// Every install command takes a human-friendly listing slug and resolves
// it against the catalog to the id the API needs -- same convention as
// task-definitions resolving a slug (an id is accepted too, for convenience).
async function resolveListingBySlug(slug: string): Promise<AppListing | null> {
  const body = await handleApiResponse<{ app_listings: AppListing[] }>(
    apiFetch("/app-listings"),
  );
  if (!body) {
    return null;
  }

  const match = body.app_listings.find(
    (listing) => listing.slug === slug || listing.id === slug,
  );
  if (!match) {
    console.error(`Error: No app in the catalog with slug "${slug}".`);
    process.exitCode = 1;
    return null;
  }

  return match;
}

export async function installApp(
  slug: string,
  options: { project: string; name?: string },
): Promise<void> {
  const listing = await resolveListingBySlug(slug);
  if (!listing) {
    return;
  }

  const app = await handleApiResponse<App>(
    apiFetch(`/projects/${options.project}/apps`, {
      method: "POST",
      // Name defaults to the listing's own name (what the UI does) unless
      // the caller overrides it.
      body: JSON.stringify({
        listing_id: listing.id,
        name: options.name ?? listing.name,
      }),
    }),
  );
  if (!app) {
    return;
  }

  console.log(`Installed "${app.name}" (${app.id}) into project ${app.project_id}.`);
}

export async function listInstalledApps(options: { project: string }): Promise<void> {
  const body = await handleApiResponse<{ apps: App[] }>(
    apiFetch(`/projects/${options.project}/apps`),
  );
  if (!body) {
    return;
  }

  if (body.apps.length === 0) {
    console.log("No apps installed in this project.");
    return;
  }

  for (const app of body.apps) {
    console.log(`${app.id} -- ${app.name} -- installed ${app.created_at}`);
  }
}

export async function showApp(appId: string): Promise<void> {
  const app = await handleApiResponse<App>(apiFetch(`/apps/${appId}`));
  if (!app) {
    return;
  }

  console.log(`ID: ${app.id}`);
  console.log(`Name: ${app.name}`);
  console.log(`Project: ${app.project_id}`);
  console.log(`Listing: ${app.listing_id}`);
  console.log(`Status: ${app.status}`);
  console.log(`Created: ${app.created_at}`);
}

export async function uninstallApp(appId: string): Promise<void> {
  // Uninstall = archive. The row (and its pages) stay around; the app
  // drops out of the installed list and can be reinstalled fresh.
  const app = await handleApiResponse<App>(
    apiFetch(`/apps/${appId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "archived" }),
    }),
  );
  if (!app) {
    return;
  }

  console.log(`Uninstalled "${app.name}" (${app.id}).`);
}

export async function listAppPages(
  appId: string,
  options: { archived?: boolean },
): Promise<void> {
  const query = options.archived ? "?status=archived" : "";
  const body = await handleApiResponse<{ app_pages: AppPage[] }>(
    apiFetch(`/apps/${appId}/pages${query}`),
  );
  if (!body) {
    return;
  }

  if (body.app_pages.length === 0) {
    console.log("No pages in this app.");
    return;
  }

  for (const page of body.app_pages) {
    const title = page.title ?? "(untitled)";
    const archived = page.status === "archived" ? " -- archived" : "";
    console.log(`${page.id} -- ${title} -- slug: ${page.slug}${archived}`);
  }
}

export async function createAppPage(
  appId: string,
  options: { title?: string; slug?: string },
): Promise<void> {
  if (!options.title) {
    console.error("Error: --title is required.");
    process.exitCode = 1;
    return;
  }
  const page = await handleApiResponse<AppPage>(
    apiFetch(`/apps/${appId}/pages`, {
      method: "POST",
      body: JSON.stringify({ title: options.title, slug: options.slug }),
    }),
  );
  if (!page) return;
  console.log(`Created page ${page.id} "${page.title}" (slug: ${page.slug}).`);
}

export async function showAppPage(appId: string, pageId: string): Promise<void> {
  const page = await handleApiResponse<AppPage>(apiFetch(`/apps/${appId}/pages/${pageId}`));
  if (!page) return;
  console.log(`${page.title ?? "(untitled)"} (${page.id}) -- slug: ${page.slug} -- ${page.status}`);
}

export async function updateAppPage(
  appId: string,
  pageId: string,
  options: { title?: string; slug?: string; archive?: boolean; restore?: boolean },
): Promise<void> {
  const body: Record<string, unknown> = {};
  if (options.title !== undefined) body.title = options.title;
  if (options.slug !== undefined) body.slug = options.slug;
  if (options.archive) body.status = "archived";
  if (options.restore) body.status = "active";
  if (Object.keys(body).length === 0) {
    console.error("Error: nothing to update -- pass --title, --slug, --archive, or --restore.");
    process.exitCode = 1;
    return;
  }
  const page = await handleApiResponse<AppPage>(
    apiFetch(`/apps/${appId}/pages/${pageId}`, { method: "PATCH", body: JSON.stringify(body) }),
  );
  if (!page) return;
  console.log(`Updated page ${page.id} "${page.title}" (${page.status}).`);
}

// Public page metadata by slug (unauthenticated route, but the CLI still sends
// its token -- harmless).
export async function showPublicPage(slug: string): Promise<void> {
  const page = await handleApiResponse<AppPage & { app_id?: string }>(apiFetch(`/pages/${slug}`));
  if (!page) return;
  console.log(`${page.title ?? "(untitled)"} -- slug: ${page.slug} -- ${page.status}`);
}
