import { apiFetch, handleApiResponse } from "../lib/api.js";

type Message = {
  id: string;
  subject: string | null;
  body: string | null;
  read_at: string | null;
  created_at: string;
};

export async function listMessages(): Promise<void> {
  const body = await handleApiResponse<{ messages: Message[]; unreadCount: number }>(
    apiFetch("/messages"),
  );
  if (!body) return;
  console.log(`${body.messages.length} message(s), ${body.unreadCount} unread.`);
  for (const m of body.messages) {
    const unread = m.read_at ? " " : "*";
    console.log(`${unread} ${m.id} -- ${m.subject ?? "(no subject)"} -- ${m.created_at}`);
  }
}

export async function readMessage(messageId: string): Promise<void> {
  const ok = await handleApiResponse<unknown>(
    apiFetch(`/messages/${messageId}/read`, { method: "POST" }),
  );
  if (ok === null) return;
  console.log(`Marked message ${messageId} read.`);
}
