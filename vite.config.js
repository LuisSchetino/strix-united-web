import { defineConfig } from "vite";

export default defineConfig({
  server: {
    watch: {
      ignored: ["**/qa/**", "**/*.mp4"],
    },
  },
});
