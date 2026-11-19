import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  const target = env.BACKEND_PROXY_TARGET || "http://127.0.0.1:3000";
  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      strictPort: true,
      proxy: { "/ws": { target, ws: true }, "/api": { target } },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: (id) => (id.includes("recharts") ? "charts" : undefined),
        },
      },
    },
  };
});
