import { client } from "@/lib/client/client.gen";

// Keep the fallback in step with wxt.config.ts, which grants the host permission.
export const API_URL = import.meta.env.WXT_API_URL ?? "http://localhost:8000";

export function configureApiClient() {
  client.setConfig({ baseUrl: API_URL });
}

/** A sentence for the user, whatever failed: the API, the network or the page. */
export function errorMessage(error: unknown): string {
  // The generated client throws the response body, which FastAPI shapes as { detail }.
  if (error && typeof error === "object" && "detail" in error) {
    if (typeof error.detail === "string") return error.detail;
    return "The API did not accept the request.";
  }
  // fetch rejects with a TypeError when the server cannot be reached at all.
  if (error instanceof TypeError) return `Cannot reach the Forms Pilot API at ${API_URL}.`;
  if (error instanceof Error) return error.message;
  return "Something went wrong. Try again.";
}
