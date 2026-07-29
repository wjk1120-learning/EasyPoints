import { cpSync, existsSync, mkdirSync } from "fs";
import { resolve } from "path";
import { defineConfig } from "vite";
import uni from "@dcloudio/vite-plugin-uni";

function copyStaticPlugin() {
  return {
    name: "copy-static-assets",
    closeBundle() {
      const src = resolve(__dirname, "static");
      if (!existsSync(src)) return;
      for (const sub of ["dev", "build"]) {
        const dest = resolve(__dirname, "dist", sub, "mp-weixin", "static");
        mkdirSync(dest, { recursive: true });
        cpSync(src, dest, { recursive: true });
      }
    }
  };
}

export default defineConfig({
  plugins: [uni(), copyStaticPlugin()],
  server: {
    port: 5174,
    host: "0.0.0.0"
  }
});
