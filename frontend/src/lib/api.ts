// Client for the FastAPI backend, which is served from the same origin.

import type { FieldValues } from "./template";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  /** The document being drafted, or null to let the assistant choose one. */
  template_id: string | null;
  messages: ChatMessage[];
  values: FieldValues;
}

export interface ChatReply {
  reply: string;
  template_id: string | null;
  updates: FieldValues;
}

const FALLBACK_ERROR = "Something went wrong. Please try again.";

export async function postChat(request: ChatRequest): Promise<ChatReply> {
  let response: Response;
  try {
    response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
  } catch {
    throw new Error("Couldn't reach the server. Check your connection and try again.");
  }
  if (!response.ok) {
    throw new Error(await errorDetail(response));
  }
  return response.json();
}

/** The backend's `detail` message for a failed request, if it sent a readable one. */
async function errorDetail(response: Response): Promise<string> {
  try {
    const body = await response.json();
    if (typeof body.detail === "string") return body.detail;
  } catch {
    // Not JSON: fall through to the generic message.
  }
  return FALLBACK_ERROR;
}
