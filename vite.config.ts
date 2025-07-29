import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 7600,
    proxy: {
      '/manticore': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/manticore/, '/api'),
      },
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
      '/sql': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
      '/embeddings': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
      '/recommendations': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
    },
  },
});
