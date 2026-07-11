import { apiFetch, handleApiResponse } from "../lib/api.js";

type EventTypePayloadField = { name: string; type: string };

type EventType = {
  key: string;
  label: string;
  description: string;
  entity_table: "runs" | "jobs" | "assets" | "apps";
  payload_fields: EventTypePayloadField[];
};

type Event = {
  id: string;
  event_type_key: string;
  entity_id: string;
  run_id: string | null;
  project_id: string;
  payload: Record<string, unknown>;
  // The name of the entity the event is about (run/app name, etc.), or null.
  name: string | null;
  created_at: string;
};

type EventListResponse = {
  events: Event[];
  page: number;
  limit: number;
  total: number;
};

export async function listEventTypes(): Promise<void> {
  const body = await handleApiResponse<{ event_types: EventType[] }>(
    apiFetch("/event-types"),
  );
  if (!body) {
    return;
  }

  for (const eventType of body.event_types) {
    const fields = eventType.payload_fields.map((f) => f.name).join(", ");
    console.log(
      `${eventType.key} -- ${eventType.label} -- ${eventType.description} -- fields: ${fields}`,
    );
  }
}

function formatEventLine(event: Event): string {
  const name = event.name ? ` "${event.name}"` : "";
  const run = event.run_id ? ` -- run ${event.run_id}` : "";
  return `${event.id} -- ${event.event_type_key}${name}${run} -- ${event.created_at}`;
}

// No project -> GET /events (every accessible project); with one ->
// GET /projects/:projectId/events -- same split as runs/assets.
export async function listEvents(options: {
  project?: string;
  type?: string;
  page?: string;
  limit?: string;
}): Promise<void> {
  const params = new URLSearchParams();
  if (options.type) params.set("type", options.type);
  if (options.page) params.set("page", options.page);
  if (options.limit) params.set("limit", options.limit);
  const query = params.toString() ? `?${params.toString()}` : "";
  const path = options.project ? `/projects/${options.project}/events` : "/events";

  const body = await handleApiResponse<EventListResponse>(apiFetch(`${path}${query}`));
  if (!body) {
    return;
  }

  if (body.events.length === 0) {
    console.log("No events found.");
    return;
  }

  for (const event of body.events) {
    console.log(formatEventLine(event));
  }
  console.log(`-- page ${body.page} (limit ${body.limit}, total ${body.total})`);
}
