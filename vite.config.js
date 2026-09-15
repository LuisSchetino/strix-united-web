import { defineConfig } from "vite";

export default defineConfig({
  server: {
    // Vite does not run Pages Functions. Reuse only the public image endpoint
    // during local review; authentication and mutation endpoints are not proxied.
    proxy: {
      "/api/competitions/asset": {
        target: "https://strix-united-fc27.pages.dev",
        changeOrigin: true,
      },
    },
    watch: {
      ignored: ["**/qa/**", "**/*.mp4", "**/public/media/announce-fx/**"],
    },
  },
});
