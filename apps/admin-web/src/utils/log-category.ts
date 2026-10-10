/** 日志分类（PRD 5.6 五类 + 系统其他兜底）：按后端 action 前缀归类 */

export type LogCategory = "points" | "review" | "appeal" | "gift_task" | "vote" | "system"

export const LOG_CATEGORY_TEXT: Record<LogCategory, string> = {
  points: "积分操作",
  review: "审核日志",
  appeal: "申诉处理",
  gift_task: "礼品/任务修改",
  vote: "投票操作",
  system: "系统其他",
}

/** 日志类型筛选项（全部由调用方自行追加） */
export const LOG_CATEGORY_OPTIONS = (Object.keys(LOG_CATEGORY_TEXT) as LogCategory[]).map((key) => ({
  value: key,
  label: LOG_CATEGORY_TEXT[key],
}))

/**
 * 按后端 action 归类：
 * - 积分操作：point_record.*
 * - 审核日志：order.status_changed、task.reviewed、application.reviewed（兑换/任务/申请的审核结论）
 * - 申诉处理：appeal.*
 * - 礼品/任务修改：gift.*、task.*（发布/编辑等管理动作）
 * - 投票操作：vote.*
 * - 其余（wecom.contacts_synced、outbox.retried、order.created 等）归入系统其他
 */
export function logCategory(action: string): LogCategory {
  const key = String(action || "");
  if (key.startsWith("vote.")) return "vote";
  if (key.startsWith("point_record")) return "points";
  if (key.startsWith("appeal")) return "appeal";
  if (key.startsWith("gift.") || key.startsWith("task.")) return "gift_task";
  if (key === "order.status_changed" || key === "task.reviewed" || key === "application.reviewed") return "review";
  return "system";
}

/** 从日志 payload 里按候选键取第一个非空值 */
function pickPayload(payload: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = payload[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value);
  }
  return "";
}

/** 操作对象（PRD 5.6）：按 action 家族从 payload 推导，如「订单 #3」「礼品 #2」；投票日志由调用方传标题 */
export function logTarget(action: string, payload: Record<string, unknown> = {}): string {
  const key = String(action || "");
  if (key.startsWith("vote.")) return "";
  const candidates = [payload.orderId, payload.appealId, payload.taskId, payload.id];
  const found = candidates.find((value) => value !== undefined && value !== null);
  const idText = found == null ? "" : ` #${found}`;
  if (key.startsWith("order.")) return `订单${idText}`;
  if (key.startsWith("point_record")) return `积分流水${idText}`;
  if (key.startsWith("appeal")) return `申诉${idText}`;
  if (key.startsWith("gift.")) return `礼品${idText}`;
  if (key.startsWith("task.")) return `任务${idText}`;
  return "";
}

/** 备注详情（PRD 5.6）：按 action 从 payload 取备注类字段，无则空串 */
export function logRemark(action: string, payload: Record<string, unknown> = {}): string {
  const key = String(action || "");
  if (key === "appeal.reviewed" || key === "appeal.created") return pickPayload(payload, ["resultRemark", "reason"]);
  if (key === "order.status_changed") return pickPayload(payload, ["reviewRemark", "remark"]);
  if (key.startsWith("point_record")) return pickPayload(payload, ["remark"]);
  if (key.startsWith("vote.")) return pickPayload(payload, ["remark"]);
  return "";
}
