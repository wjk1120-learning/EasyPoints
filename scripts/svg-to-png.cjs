// tabbar 图标生成：把 apps/miniapp/static/tabbar/*.svg 批量转成 81x81 PNG（pages.json 原生 tabBar 声明用）。
// 用法（仓库根目录）：node scripts/svg-to-png.cjs
// 依赖 sharp（已装在 apps/miniapp 的 devDependencies，这里显式从那边解析）。
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const dir = path.join(root, "apps", "miniapp", "static", "tabbar");
const sharp = require(path.join(root, "apps", "miniapp", "node_modules", "sharp"));

const svgs = fs.readdirSync(dir).filter((f) => f.endsWith(".svg"));

(async () => {
  for (const file of svgs) {
    const svgPath = path.join(dir, file);
    const pngPath = path.join(dir, file.replace(".svg", ".png"));
    await sharp(svgPath).resize(81, 81).png().toFile(pngPath);
    console.log("created", pngPath);
  }
})();
