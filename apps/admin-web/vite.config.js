import { defineConfig } from "vite";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const vuePluginModule = require("@vitejs/plugin-vue");
const vue = vuePluginModule.default || vuePluginModule;

export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, "")
      },
      "/uploads": {
        target: "http://localhost:3000",
        changeOrigin: true
      },
      "/admin": {
        target: "http://localhost:3000",
        changeOrigin: true
      }
    }
  }
});
