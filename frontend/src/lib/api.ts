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

export interface User {
  id: number;
  email: string;
}

export interface DocumentSummary {
  id: number;
  template_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface SavedDocument extends DocumentSummary {
  values: FieldValues;
  messages: ChatMessage[];
}

export interface DocumentInput {
  template_id: string;
  title: string;
  values: FieldValues;
  messages: ChatMessage[];
}

/** A failed API request, with the HTTP status (401 means the user must sign in). */
export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const FALLBACK_ERROR = "Something went wrong. Please try again.";

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("Couldn't reach the server. Check your connection and try again.", 0);
  }
  if (!response.ok) {
    throw new ApiError(await errorDetail(response), response.status);
  }
  return response.status === 204 ? (undefined as T) : response.json();
}

/** The backend's `detail` message for a failed request, if it sent a readable one. */
async function errorDetail(response: Response): Promise<string> {
  try {
    const body = await response.json();
    if (typeof body.detail === "string") return body.detail;
    // FastAPI validation errors: a list of {msg} objects.
    if (Array.isArray(body.detail) && typeof body.detail[0]?.msg === "string") {
      return body.detail[0].msg.replace(/^Value error, /, "");
    }
  } catch {
    // Not JSON: fall through to the generic message.
  }
  return FALLBACK_ERROR;
}

export const postChat = (chat: ChatRequest) => request<ChatReply>("POST", "/api/chat", chat);

export const getCurrentUser = () => request<User>("GET", "/api/auth/me");
export const signUp = (email: string, password: string) =>
  request<User>("POST", "/api/auth/signup", { email, password });
export const signIn = (email: string, password: string) =>
  request<User>("POST", "/api/auth/signin", { email, password });
export const signOut = () => request<void>("POST", "/api/auth/signout");

export const listDocuments = () => request<DocumentSummary[]>("GET", "/api/documents");
export const getDocument = (id: number) => request<SavedDocument>("GET", `/api/documents/${id}`);
export const createDocument = (document: DocumentInput) =>
  request<SavedDocument>("POST", "/api/documents", document);
export const updateDocument = (id: number, document: DocumentInput) =>
  request<SavedDocument>("PUT", `/api/documents/${id}`, document);
export const deleteDocument = (id: number) => request<void>("DELETE", `/api/documents/${id}`);
