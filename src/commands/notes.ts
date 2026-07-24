import { readFileSync } from "node:fs";
import { apiFetch, handleApiResponse } from "../lib/api.js";

// Notes: project-scoped, human-authored markdown notes that form a small
// internal wiki per project. Mirrors the data-tables command style -- plain-line
// output, ids straight off the API. The tree is keyed in PATH space: `path` is
// a unique slug (^[a-zA-Z0-9._-]+$) per project, `parent_path` is the parent note's
// `path` (empty = top-level). See 88eggs-backend
// features/completed/260724190000-feature-backend-notes.md.

type Note = {
  id: string;
  project_id: string;
  created_by?: string | null;
  path: string;
  parent_path: string | null;
  name: string;
  content: string;
  archived: boolean;
  created_at: string;
  updated_at: string;
};

// A list row: the full note minus `content`, plus `has_children`.
type NoteListItem = Omit<Note, "content"> & { has_children: boolean };

// Resolve note `content` from either --content (inline) or --content-file (read
// a markdown file). At most one; returns undefined when neither is given.
function resolveContent(options: {
  content?: string;
  contentFile?: string;
}): { ok: true; content?: string } | { ok: false } {
  if (options.content !== undefined && options.contentFile !== undefined) {
    console.error("Error: pass only one of --content or --content-file.");
    process.exitCode = 1;
    return { ok: false };
  }
  if (options.contentFile !== undefined) {
    try {
      return { ok: true, content: readFileSync(options.contentFile, "utf8") };
    } catch (error) {
      console.error(
        error instanceof Error
          ? `Error: could not read --content-file: ${error.message}`
          : "Error: could not read --content-file.",
      );
      process.exitCode = 1;
      return { ok: false };
    }
  }
  return { ok: true, content: options.content };
}

function tags(n: NoteListItem): string {
  const bits: string[] = [];
  if (n.parent_path) bits.push(`under ${n.parent_path}`);
  if (n.has_children) bits.push("+children");
  if (n.archived) bits.push("archived");
  return bits.length ? ` (${bits.join(", ")})` : "";
}

export async function listNotes(options: {
  project: string;
  parent?: string;
  roots?: boolean;
  archived?: boolean;
  all?: boolean;
  q?: string;
  page?: string;
  limit?: string;
}): Promise<void> {
  // Build the query by hand: parent_path="" (roots) is meaningful and must not
  // be dropped, and it's distinct from omitting the param (a flat listing).
  const params = new URLSearchParams();
  if (options.roots) params.set("parent_path", "");
  else if (options.parent !== undefined) params.set("parent_path", options.parent);
  if (options.all) params.set("archived", "all");
  else if (options.archived) params.set("archived", "true");
  if (options.q) params.set("q", options.q);
  if (options.page) params.set("page", options.page);
  if (options.limit) params.set("limit", options.limit);
  const qs = params.toString();

  const body = await handleApiResponse<{ notes: NoteListItem[]; total: number }>(
    apiFetch(`/projects/${options.project}/notes${qs ? `?${qs}` : ""}`),
  );
  if (!body) return;
  if (body.notes.length === 0) {
    console.log("No notes found.");
    return;
  }
  for (const n of body.notes) {
    console.log(`${n.id} -- ${n.name} -- ${n.path}${tags(n)}`);
  }
}

function printNote(n: Note): void {
  console.log(`${n.name} (${n.id})`);
  console.log(`Project: ${n.project_id}`);
  console.log(`Path: ${n.path}`);
  console.log(`Parent: ${n.parent_path ?? "(top-level)"}`);
  if (n.archived) console.log("Status: archived");
  console.log("--- content ---");
  console.log(n.content ?? "");
}

export async function showNote(noteId: string): Promise<void> {
  const n = await handleApiResponse<Note>(apiFetch(`/notes/${noteId}`));
  if (!n) return;
  printNote(n);
}

export async function showNoteByPath(options: {
  project: string;
  path: string;
}): Promise<void> {
  const n = await handleApiResponse<Note>(
    apiFetch(
      `/projects/${options.project}/notes/by-path?path=${encodeURIComponent(options.path)}`,
    ),
  );
  if (!n) return;
  printNote(n);
}

export async function createNote(
  name: string,
  options: {
    project: string;
    path: string;
    content?: string;
    contentFile?: string;
    parent?: string;
  },
): Promise<void> {
  const built = resolveContent(options);
  if (!built.ok) return;
  const body: Record<string, unknown> = { name, path: options.path };
  if (built.content !== undefined) body.content = built.content;
  if (options.parent !== undefined) body.parent_path = options.parent;
  const n = await handleApiResponse<Note>(
    apiFetch(`/projects/${options.project}/notes`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );
  if (!n) return;
  console.log(`Created note ${n.id} "${n.name}" (path ${n.path}) in project ${n.project_id}.`);
}

export async function updateNote(
  noteId: string,
  options: {
    name?: string;
    path?: string;
    content?: string;
    contentFile?: string;
    parent?: string;
    topLevel?: boolean;
    archive?: boolean;
    restore?: boolean;
  },
): Promise<void> {
  const built = resolveContent(options);
  if (!built.ok) return;
  const body: Record<string, unknown> = {};
  if (options.name !== undefined) body.name = options.name;
  if (options.path !== undefined) body.path = options.path;
  if (built.content !== undefined) body.content = built.content;
  // Re-parent: --top-level moves it to the root; --parent <path> re-homes it.
  if (options.topLevel) body.parent_path = "";
  else if (options.parent !== undefined) body.parent_path = options.parent;
  if (options.archive) body.archived = true;
  if (options.restore) body.archived = false;
  if (Object.keys(body).length === 0) {
    console.error(
      "Error: nothing to update -- pass --name, --path, --content(-file), --parent/--top-level, --archive, or --restore.",
    );
    process.exitCode = 1;
    return;
  }
  const n = await handleApiResponse<Note>(
    apiFetch(`/notes/${noteId}`, { method: "PATCH", body: JSON.stringify(body) }),
  );
  if (!n) return;
  console.log(`Updated note ${n.id} "${n.name}" (path ${n.path}${n.archived ? ", archived" : ""}).`);
}
