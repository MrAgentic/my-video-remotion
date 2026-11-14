import { defineConfig } from "vite";

export default defineConfig({
  // index.html at the project root is the SPA entry; public/ is served at the
  // web root by Vite's built-in publicDir handling, which is what mediaSrc()
  // relies on ("/test.mp4").
  appType: "spa",
  esbuild: {
    jsx: "automatic",
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
