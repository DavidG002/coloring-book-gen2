import { getSession } from "next-auth/react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  detail: unknown;

  constructor(status: number, detail: unknown) {
    // FastAPI validation errors (422) put a readable message in detail[0].msg;
    // other errors (400/404/409) put a plain string in detail.
    const message =
      typeof detail === "string"
        ? detail
        : Array.isArray(detail) && detail[0]?.msg
        ? detail[0].msg
        : `Request failed with status ${status}`;
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
}

// Several components (preview generation, publish/WordPress panels, settings,
// etc.) call `fetch()` directly instead of going through apiRequest — usually
// because they need a raw Response (blob downloads, custom error shapes,
// FormData uploads). Every one of those call sites needs the same
// Authorization header now that the backend requires auth on every route, so
// it's exported here rather than duplicated. Auth.js's own session cookie
// stays its default encrypted format; the plain HS256 JWT FastAPI actually
// verifies is minted separately in the session callback and exposed here as
// session.accessToken (see auth.ts).
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const session = await getSession();
  const accessToken = (session as unknown as { accessToken?: string } | null)?.accessToken;
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body } = options;

  const authHeaders = await getAuthHeaders();
  const headers: Record<string, string> = { ...authHeaders };
  if (body) headers["Content-Type"] = "application/json";

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  // 204 No Content (e.g. DELETE) has no body to parse
  if (response.status === 204) {
    return undefined as T;
  }

  const data = await response.json();

  if (!response.ok) {
    throw new ApiError(response.status, data.detail);
  }

  return data as T;
}