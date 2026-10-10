/** 投票纯逻辑：状态推导、表单校验（无运行时依赖，可单独回归测试） */
import type { Vote, VotePayload, VoteStatus } from "../api/vote/types"

/** "YYYY-MM-DD HH:mm" 或 ISO 字符串 → 毫秒 */
function parseTime(value: string): number {
  return new Date(String(value || "").replace(" ", "T")).getTime()
}

/**
 * 投票状态推导（PRD 3.4 第 5 条：到期自动关闭）：
 * 手动关闭 → 已结束；未到开始时间 → 未开始；超过截止时间 → 已结束；其余 → 进行中。
 */
export function deriveVoteStatus(vote: Pick<Vote, "startTime" | "endTime" | "closed">, now: number = Date.now()): VoteStatus {
  if (vote.closed) return "ended";
  const start = parseTime(vote.startTime);
  const end = parseTime(vote.endTime);
  if (now < start) return "not_started";
  if (now > end) return "ended";
  return "in_progress";
}

/**
 * 新建/编辑投票表单校验（PRD 5.9.1 第 8 条）。
 * @returns 错误文案；null 表示校验通过
 */
export function validateVotePayload(payload: VotePayload): string | null {
  if (!String(payload.title || "").trim()) return "请填写投票标题";
  const options = (payload.options || []).map((text) => String(text || "").trim()).filter(Boolean);
  if (options.length < 2) return "至少需要 2 个投票选项";
  if (!payload.startTime || !payload.endTime) return "请选择开始时间和截止时间";
  if (parseTime(payload.startTime) >= parseTime(payload.endTime)) return "开始时间不能晚于截止时间";
  if (!payload.participantIds || payload.participantIds.length < 1) return "至少选择 1 位参与人员";
  return null;
}
