import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

// QA-only Vite config: same app, but /api, /qa-supabase and /qa-login go to the
// local QA backend (tools/qa-app-server.mjs) instead of Cloudflare/Supabase.
const target = `http://127.0.0.1:${process.env.QA_PORT || 8799}`;
export default defineConfig({
  root: fileURLToPath(new URL("..", import.meta.url)),
  server: {
    proxy: {
      "/api": { target, changeOrigin: false },
      "/qa-supabase": { target, changeOrigin: false },
      "/qa-login": { target, changeOrigin: false },
      "/qa-state": { target, changeOrigin: false },
    },
    watch: { ignored: ["**/qa/**", "**/*.mp4", "**/design-assets/**", "**/public/media/**"] },
  },
});
