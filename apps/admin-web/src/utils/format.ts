/** 时间格式化：YYYY-MM-DD HH:mm:ss；非法值原样返回 */
/** 导出文件名时间戳：yyyyMMddHHmmss（PRD 5.7 文件命名带时间戳） */
export function fileTimestamp(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`;
}

export function formatTimeText(value: string | number | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  const s = String(date.getSeconds()).padStart(2, "0");
  return `${y}-${m}-${d} ${h}:${min}:${s}`;
}

/** 企微失败原因展示清洗：切掉 hint 追踪串与 more info 链接，只留主句（与后端 WeComErrcodeHints 同规则；库内原文保留） */
export function cleanWecomFailReason(reason: string | null | undefined): string {
  let msg = String(reason || "");
  const hintIdx = msg.indexOf(" hint: ");
  if (hintIdx >= 0) msg = msg.slice(0, hintIdx);
  const moreIdx = msg.indexOf(" more info at ");
  if (moreIdx >= 0) msg = msg.slice(0, moreIdx);
  return msg.endsWith(",") ? msg.slice(0, -1) : msg;
}
