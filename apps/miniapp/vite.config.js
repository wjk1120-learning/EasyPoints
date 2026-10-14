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
        try {
          mkdirSync(dest, { recursive: true });
          cpSync(src, dest, { recursive: true });
        } catch (error) {
          // 目标目录被微信开发者工具等进程锁定时不要中断监听编译
          console.warn(`[copy-static-assets] 跳过 ${sub}：${error.message}`);
        }
      }
    }
  };
}

export default defineConfig({
  plugins: [uni(), copyStaticPlugin()],
  server: {
    port: 5174,
    host: "0.0.0.0",
    proxy: {
      "/miniapp": { target: "http://localhost:3000", changeOrigin: true },
      "/admin": { target: "http://localhost:3000", changeOrigin: true }
    }
  }
});
