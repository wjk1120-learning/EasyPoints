/**
 * 展示格式化工具（全端唯一出处，页面禁止再各自定义）。
 * 行为与原各页内联版本等价；friendlyTime 的不可解析兜底统一为截断 16 字符（原 home 页口径）。
 */

/** 积分数字加千分位：1234 -> "1,234"，-1234 -> "-1,234"，空值 -> "0" */
export function formatPoints(value: unknown): string {
  const num = Number(value || 0);
  const abs = String(Math.abs(num)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return num < 0 ? `-${abs}` : abs;
}

/** 带符号积分：正数加 + 前缀 */
export function signedPoints(value: unknown): string {
  const num = Number(value || 0);
  return `${num > 0 ? "+" : ""}${formatPoints(num)}`;
}

/** 时间：MM-DD HH:mm（不可解析时原样返回） */
export function formatTime(value: unknown): string {
  if (!value) return "";
  const date = new Date(value as string);
  if (Number.isNaN(date.getTime())) return String(value);
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  const hh = `${date.getHours()}`.padStart(2, "0");
  const mm = `${date.getMinutes()}`.padStart(2, "0");
  return `${m}-${d} ${hh}:${mm}`;
}

/**
 * 友好时间：今天/昨天带 HH:mm；更早按 style 展示——
 * datetime（首页最近流水）：MM-DD HH:mm；date（消息中心）：M月D日。
 * 不可解析时截断 16 字符。
 */
export function friendlyTime(value: unknown, style: "datetime" | "date" = "datetime"): string {
  if (!value) return "";
  const date = new Date(value as string);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 16);
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(date)) / 86400000);
  const hh = `${date.getHours()}`.padStart(2, "0");
  const mm = `${date.getMinutes()}`.padStart(2, "0");
  if (diffDays === 0) return `今天 ${hh}:${mm}`;
  if (diffDays === 1) return `昨天 ${hh}:${mm}`;
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return style === "date" ? `${m}月${d}日` : `${m}-${d} ${hh}:${mm}`;
}
