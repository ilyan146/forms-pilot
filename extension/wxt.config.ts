import tailwindcss from "@tailwindcss/vite";
import { loadEnv } from "vite";
import { defineConfig } from "wxt";

// Keep in step with the fallback in lib/api.ts.
const DEFAULT_API_URL = "http://localhost:8000";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: ({ mode }) => {
    const apiUrl = new URL(loadEnv(mode, process.cwd(), "WXT_").WXT_API_URL ?? DEFAULT_API_URL);
    return {
      name: "Forms Pilot",
      description: "Fill a repetitive web form from images you drop in.",
      permissions: ["sidePanel", "activeTab", "storage"],
      // Extension pages with a host permission call the API without CORS.
      host_permissions: [`${apiUrl.origin}/*`],
      action: { default_title: "Open Forms Pilot" },
    };
  },
  // `wxt` dev opens a fresh Chrome profile with the extension loaded. That needs
  // the web-ext package; without it WXT silently falls back to manual loading.
  webExt: {
    startUrls: [`${DEFAULT_API_URL}/sample-form`],
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
});
