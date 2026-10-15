import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig(({ mode }) => ({
  plugins: [
    vue(),
    cloudflare({
      persistState: mode === "e2e" ? { path: ".local/e2e/state" } : true,
    }),
  ],
  server: { port: 5173, strictPort: true },
}));
