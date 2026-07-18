import { apiFetch, handleApiResponse } from "../lib/api.js";

// Data Tables: project-scoped user-defined tables (advisory column schema +
// string-only cells; `status` is a physical column, not a cell). Mirrors the
// task-definitions/pipelines command style -- plain-line output, ids straight
// off the API. See 88eggs-backend/docs/TASK_DEFINITIONS.md's data-table tasks
// and features/completed/260713090000-feature-backend-data-tables.md.

const COLUMN_TYPES = ["text", "textarea", "number", "boolean", "asset"] as const;
type ColumnType = (typeof COLUMN_TYPES)[number];
type Column = { key: string; label: string; type: ColumnType };

type DataTable = {
  id: string;
  project_id: string;
  name: string;
  columns: Column[];
  visible_columns: string[] | null;
  status_options: string[] | null;
  status: string;
  created_at: string;
  updated_at: string;
};

type Row = {
  id: string;
  table_id: string;
  status: string | null;
  data: Record<string, string>;
  created_at: string;
  updated_at: string;
};

// `--column key:type[:label]` -> { key, label, type }. Label is optional
// (defaults to the key) and, being last, may itself contain colons.
function parseColumns(specs: string[]): Column[] {
  return specs.map((spec) => {
    const parts = spec.split(":");
    const key = (parts[0] ?? "").trim();
    const type = (parts[1] ?? "").trim();
    const label = parts.slice(2).join(":").trim() || key;
    if (!key || !type) {
      throw new Error(`Invalid --column "${spec}" -- expected key:type[:label].`);
    }
    if (!(COLUMN_TYPES as readonly string[]).includes(type)) {
      throw new Error(
        `Invalid column type "${type}" in "${spec}" -- one of ${COLUMN_TYPES.join(", ")}.`,
      );
    }
    return { key, label, type: type as ColumnType };
  });
}

// `--cell key=value` -> { key: value }. Split on the first "=" so values may
// contain "=".
function parseCells(pairs: string[]): Record<string, string> {
  const cells: Record<string, string> = {};
  for (const pair of pairs) {
    const i = pair.indexOf("=");
    if (i === -1) {
      throw new Error(`Invalid --cell "${pair}" -- expected key=value.`);
    }
    cells[pair.slice(0, i)] = pair.slice(i + 1);
  }
  return cells;
}

function query(params: Record<string, string | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") q.set(k, v);
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

export async function listDataTables(options: {
  project?: string;
  archived?: boolean;
}): Promise<void> {
  const body = await handleApiResponse<{ dataTables: DataTable[] }>(
    apiFetch(
      `/data-tables${query({ projectId: options.project, status: options.archived ? "archived" : undefined })}`,
    ),
  );
  if (!body) return;
  if (body.dataTables.length === 0) {
    console.log("No data tables found.");
    return;
  }
  for (const t of body.dataTables) {
    const cols = (t.columns ?? []).map((c) => c.key).join(", ");
    console.log(`${t.id} -- ${t.name} -- [${cols}] -- project ${t.project_id}`);
  }
}

export async function showDataTable(tableId: string): Promise<void> {
  const t = await handleApiResponse<DataTable>(apiFetch(`/data-tables/${tableId}`));
  if (!t) return;
  console.log(`${t.name} (${t.id})`);
  console.log(`Project: ${t.project_id}`);
  console.log(`Status: ${t.status}`);
  console.log("Columns (plus built-in Id + status):");
  for (const c of t.columns ?? []) {
    console.log(`  ${c.key} -- ${c.label} (${c.type})`);
  }
  if (t.status_options?.length) {
    console.log(`Status options: ${t.status_options.join(", ")}`);
  }
}

export async function createDataTable(
  name: string,
  options: { project?: string; column: string[] },
): Promise<void> {
  let columns: Column[];
  try {
    columns = parseColumns(options.column);
  } catch (error) {
    console.error(error instanceof Error ? `Error: ${error.message}` : "Error: invalid --column.");
    process.exitCode = 1;
    return;
  }
  const t = await handleApiResponse<DataTable>(
    apiFetch("/data-tables", {
      method: "POST",
      body: JSON.stringify({ name, projectId: options.project, columns }),
    }),
  );
  if (!t) return;
  console.log(`Created data table ${t.id} "${t.name}" in project ${t.project_id}.`);
  console.log(`Add rows with \`88eggs data-tables rows add ${t.id} --cell key=value\`.`);
}

export async function updateDataTable(
  tableId: string,
  options: {
    name?: string;
    column: string[];
    archive?: boolean;
    restore?: boolean;
    statusOption: string[];
  },
): Promise<void> {
  const body: Record<string, unknown> = {};
  if (options.name !== undefined) body.name = options.name;
  if (options.column.length > 0) {
    try {
      body.columns = parseColumns(options.column);
    } catch (error) {
      console.error(error instanceof Error ? `Error: ${error.message}` : "Error: invalid --column.");
      process.exitCode = 1;
      return;
    }
  }
  if (options.statusOption.length > 0) body.statusOptions = options.statusOption;
  if (options.archive) body.status = "archived";
  if (options.restore) body.status = "active";
  if (Object.keys(body).length === 0) {
    console.error("Error: nothing to update -- pass --name, --column, --status-option, --archive, or --restore.");
    process.exitCode = 1;
    return;
  }
  const t = await handleApiResponse<DataTable>(
    apiFetch(`/data-tables/${tableId}`, { method: "PATCH", body: JSON.stringify(body) }),
  );
  if (!t) return;
  console.log(`Updated data table ${t.id} "${t.name}" (status: ${t.status}).`);
}

export async function publishDataTable(
  tableId: string,
  options: { name?: string },
): Promise<void> {
  const tpl = await handleApiResponse<{ id: string; name: string }>(
    apiFetch(`/data-tables/${tableId}/publish`, {
      method: "POST",
      body: JSON.stringify({ name: options.name }),
    }),
  );
  if (!tpl) return;
  console.log(`Published as template ${tpl.id} "${tpl.name}" (schema only -- rows are not shared).`);
}

export async function listRows(
  tableId: string,
  options: { column?: string; value?: string; page?: string; limit?: string },
): Promise<void> {
  const body = await handleApiResponse<{ rows: Row[] }>(
    apiFetch(
      `/data-tables/${tableId}/rows${query({ column: options.column, value: options.value, page: options.page, limit: options.limit })}`,
    ),
  );
  if (!body) return;
  if (body.rows.length === 0) {
    console.log("No rows found.");
    return;
  }
  for (const r of body.rows) {
    const cells = Object.entries(r.data ?? {})
      .map(([k, v]) => `${k}=${v}`)
      .join(" ");
    console.log(`${r.id} -- [${r.status ?? ""}] -- ${cells}`);
  }
}

export async function showRow(tableId: string, rowId: string): Promise<void> {
  const r = await handleApiResponse<Row>(apiFetch(`/data-tables/${tableId}/rows/${rowId}`));
  if (!r) return;
  console.log(`Row ${r.id} (table ${r.table_id})`);
  console.log(`Status: ${r.status ?? "(none)"}`);
  for (const [k, v] of Object.entries(r.data ?? {})) {
    console.log(`  ${k}: ${v}`);
  }
}

function cellsBody(
  cell: string[],
  status?: string,
): { ok: true; data: Record<string, string> } | { ok: false } {
  let data: Record<string, string>;
  try {
    data = parseCells(cell);
  } catch (error) {
    console.error(error instanceof Error ? `Error: ${error.message}` : "Error: invalid --cell.");
    process.exitCode = 1;
    return { ok: false };
  }
  // `status` is a first-class column, set via --status (not a --cell).
  if (status !== undefined) data.status = status;
  return { ok: true, data };
}

export async function addRow(
  tableId: string,
  options: { cell: string[]; status?: string },
): Promise<void> {
  const built = cellsBody(options.cell, options.status);
  if (!built.ok) return;
  const r = await handleApiResponse<Row>(
    apiFetch(`/data-tables/${tableId}/rows`, {
      method: "POST",
      body: JSON.stringify({ data: built.data }),
    }),
  );
  if (!r) return;
  console.log(`Added row ${r.id} to table ${tableId}.`);
}

export async function updateRow(
  tableId: string,
  rowId: string,
  options: { cell: string[]; status?: string },
): Promise<void> {
  const built = cellsBody(options.cell, options.status);
  if (!built.ok) return;
  if (Object.keys(built.data).length === 0) {
    console.error("Error: nothing to update -- pass --cell key=value and/or --status.");
    process.exitCode = 1;
    return;
  }
  const r = await handleApiResponse<Row>(
    apiFetch(`/data-tables/${tableId}/rows/${rowId}`, {
      method: "PATCH",
      body: JSON.stringify({ data: built.data }),
    }),
  );
  if (!r) return;
  console.log(`Updated row ${r.id}.`);
}

export async function deleteRow(tableId: string, rowId: string): Promise<void> {
  const ok = await handleApiResponse<unknown>(
    apiFetch(`/data-tables/${tableId}/rows/${rowId}`, { method: "DELETE" }),
  );
  if (ok === null) return;
  console.log(`Deleted row ${rowId}.`);
}
