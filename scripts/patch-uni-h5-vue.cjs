// 修复 uni-h5-vue 的已知 H5 崩溃（首页/页面白屏，控制台报
// "TypeError: Cannot assign to read only property '_' of object"）。
//
// 根因：uni-h5-vue 的 initSlots 里 `def(children, "_", type)` 用 defineProperty 把 slots
// 对象的内部标记 `_` 钉成只读；父组件重渲染走 updateSlots 的 extend(Object.assign) 路径
// 再写 `_` 时抛 TypeError，scheduler flush 中断导致整页渲染失败。
// 官方 vue 3.4.21 已重写 slots 体系（每实例独立对象 + 可写 `_`），uni 的魔改版是旧快照。
//
// 补丁：把该处改成 writable: true 的 defineProperty（对齐官方语义，仅影响这一个内部标记）。
// 幂等：已打过补丁则跳过。挂在 apps/miniapp 的 postinstall，重装依赖后自动重打。
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const files = [
  path.join(root, "node_modules", "@dcloudio", "uni-h5-vue", "dist", "vue.runtime.esm.js"),
  path.join(root, "node_modules", "@dcloudio", "uni-h5-vue", "dist", "vue.runtime.cjs.js")
];

const BROKEN = `def(children, "_", type);`;
const FIXED = `Object.defineProperty(children, "_", { configurable: true, enumerable: false, writable: true, value: type });`;

let patched = 0;
for (const file of files) {
  if (!fs.existsSync(file)) {
    console.warn(`[patch-uni-h5-vue] 跳过（不存在）：${file}`);
    continue;
  }
  const source = fs.readFileSync(file, "utf8");
  if (source.includes(FIXED)) {
    patched++;
    continue;
  }
  if (!source.includes(BROKEN)) {
    console.warn(`[patch-uni-h5-vue] 跳过（未找到目标代码，可能已由新版本修复）：${path.basename(file)}`);
    continue;
  }
  fs.writeFileSync(file, source.replace(BROKEN, FIXED));
  patched++;
  console.log(`[patch-uni-h5-vue] 已修复：${path.basename(file)}`);
}
if (patched === 0) {
  console.warn("[patch-uni-h5-vue] 未改动任何文件，请人工确认 uni-h5-vue 版本状态。");
}
