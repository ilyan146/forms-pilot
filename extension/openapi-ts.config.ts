import { defineConfig } from "@hey-api/openapi-ts";

// FastAPI is the source of truth: `pnpm gen:api` at the repo root exports
// server/openapi.json, then this turns it into lib/client. Both are generated
// and never committed.
export default defineConfig({
  input: "../server/openapi.json",
  output: { path: "lib/client" },
  plugins: ["@hey-api/client-fetch", "@tanstack/react-query"],
});
