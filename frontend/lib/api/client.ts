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

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body } = options;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
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