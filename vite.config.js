import { defineConfig } from "vite";

function jsonApi404() {
  return {
    name: "strix-api-json-404",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = String(req.url || "").split("?")[0];
        if (!url.startsWith("/api/") || url.startsWith("/api/competitions/asset")) return next();
        res.statusCode = 404;
        res.setHeader("content-type", "application/json; charset=utf-8");
        res.setHeader("cache-control", "no-store");
        res.end(JSON.stringify({ error: "not_found" }));
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = String(req.url || "").split("?")[0];
        if (!url.startsWith("/api/")) return next();
        res.statusCode = 404;
        res.setHeader("content-type", "application/json; charset=utf-8");
        res.setHeader("cache-control", "no-store");
        res.end(JSON.stringify({ error: "not_found" }));
      });
    },
  };
}

export default defineConfig({
  plugins: [jsonApi404()],
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
      ignored: ["**/qa/**", "**/*.mp4", "**/public/media/announce-fx/**", "**/design-assets/source/**", "**/design-assets/working/**"],
    },
  },
});
