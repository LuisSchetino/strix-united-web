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

// Libraries change far less often than the app: kept in their own chunks, a phone that already
// has them only downloads the app's code again after a deploy.
const VENDOR_CHUNKS = [
  ["react", /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/],
  ["supabase", /[\\/]node_modules[\\/](@supabase|iceberg-js)[\\/]/],
];

export default defineConfig({
  plugins: [jsonApi404()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          return VENDOR_CHUNKS.find(([, pattern]) => pattern.test(id))?.[0];
        },
      },
    },
  },
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
