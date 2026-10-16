import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
export default defineConfig({
  plugins: [vue()],
  cacheDir: ".local/ui-vite-cache",
  server: { host: "127.0.0.1", port: 5175, strictPort: true },
  build: { outDir: ".local/ui-preview-dist", rollupOptions: { input: "ui-preview.html" } },
});
