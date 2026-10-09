/** 投票纯逻辑：状态推导、表单校验、统计 CSV 生成（无运行时依赖，可单独回归测试） */
import type { Vote, VotePayload, VoteStats, VoteStatus } from "../api/vote/types"

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

const csvEscape = (value: string | number): string => {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** 统计结果导出 CSV（含 BOM 由调用方追加；导出行为写日志由后端负责，见接口清单 3.7） */
export function buildVoteStatsCsv(vote: Vote, stats: VoteStats): string {
  const voteTypeText = vote.voteType === "single" ? "单选" : "多选";
  const statusText = deriveVoteStatus(vote) === "not_started" ? "未开始" : vote.closed ? "已结束（手动关闭）" : deriveVoteStatus(vote) === "ended" ? "已结束" : "进行中";
  const lines: string[] = [
    `投票标题,${csvEscape(vote.title)}`,
    `投票描述,${csvEscape(vote.description || "无")}`,
    `关联业务,${csvEscape(vote.relatedLabel || "无")}`,
    `投票类型,${voteTypeText}`,
    `投票状态,${statusText}`,
    `投票时间,${csvEscape(`${vote.startTime} ~ ${vote.endTime}`)}`,
    `应参与人数,${stats.totalParticipants}`,
    `实际参与人数,${stats.submittedCount}`,
    `参与率,${stats.participationRate}%`,
    "",
    "选项统计",
    "选项,票数,占比",
  ];
  for (const option of stats.optionStats) {
    lines.push(`${csvEscape(option.text)},${option.votes},${option.percent}%`);
  }
  lines.push("", "投票明细", "员工,所选选项,提交时间");
  for (const detail of stats.details) {
    lines.push(`${csvEscape(detail.employeeName)},${csvEscape(detail.selectedTexts.join("、") || "未提交")},${detail.submittedAt}`);
  }
  return lines.join("\r\n");
}
