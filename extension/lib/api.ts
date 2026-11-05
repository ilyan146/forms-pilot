import { client } from "@/lib/client/client.gen";

// Keep the fallback in step with wxt.config.ts, which grants the host permission.
export const API_URL = import.meta.env.WXT_API_URL ?? "http://localhost:8000";

/** The user's personal API token. Stays on this device, in extension storage. */
export const apiToken = storage.defineItem<string>("local:apiToken", { fallback: "" });

/** A failed API response, with FastAPI's `detail` as the message when it is a sentence. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    body: unknown,
  ) {
    const detail = body && typeof body === "object" && "detail" in body ? body.detail : undefined;
    super(typeof detail === "string" ? detail : "The API did not accept the request.");
  }
}

export function configureApiClient() {
  client.setConfig({
    baseUrl: API_URL,
    // Only sent to operations that declare bearer auth in the OpenAPI spec.
    auth: async () => (await apiToken.getValue()) || undefined,
  });
  // Without a response the request never reached the server; keep the original error.
  client.interceptors.error.use((error, response) =>
    response ? new ApiError(response.status, error) : error,
  );
}

export function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

/** A sentence for the user, whatever failed: the API, the network or the page. */
export function errorMessage(error: unknown): string {
  // fetch rejects with a TypeError when the server cannot be reached at all.
  if (error instanceof TypeError) return `Cannot reach the Forms Pilot API at ${API_URL}.`;
  if (error instanceof Error) return error.message;
  return "Something went wrong. Try again.";
}
