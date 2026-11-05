import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "wxt";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "Forms Pilot",
    description: "Fill a repetitive web form from images you drop in.",
    permissions: ["sidePanel", "activeTab", "storage"],
    action: { default_title: "Open Forms Pilot" },
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
});
