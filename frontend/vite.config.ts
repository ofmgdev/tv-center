import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Built UI is bundled into the Electron app.
  build: {
    outDir: "../desktop/renderer",
    emptyOutDir: true,
  },
  server: {
    proxy: {
      "/api": "http://localhost:4000",
    },
  },
});
