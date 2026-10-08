/**
 * 状态 → 中文文案 / Element Plus 语义标签 映射。
 * 语义色遵循 docs/admin-web-color-scheme.md 第 4 节：通过=success、驳回=danger、待处理=warning、中性=info。
 * tag 取值："success" | "warning" | "danger" | "info" | "primary"
 */

export type TagType = "success" | "warning" | "danger" | "info" | "primary"

export interface StatusMeta {
  text: string
  tag: TagType
}

/** 审核三态（PRD 3.2：待审核/审核通过/审核驳回）——新模块（任务/积分申请/兑换审核 Tab）统一使用 */
export const REVIEW_STATUS_MAP: Record<string, StatusMeta> = {
  pending_review: { text: "待审核", tag: "warning" },
  approved: { text: "审核通过", tag: "success" },
  rejected: { text: "已驳回", tag: "danger" },
}

/** 订单状态（现有后端枚举，含发货/核销流转） */
export const ORDER_STATUS_MAP: Record<string, StatusMeta> = {
  pending_review: { text: "待审核", tag: "warning" },
  approved: { text: "审核通过", tag: "success" },
  shipped: { text: "已发货", tag: "primary" },
  completed: { text: "已完成", tag: "success" },
  rejected: { text: "已驳回", tag: "danger" },
  cancelled: { text: "已取消", tag: "info" },
}

/** 申诉状态（现有后端两级审核枚举） */
export const APPEAL_STATUS_MAP: Record<string, StatusMeta> = {
  pending_department_review: { text: "待初审", tag: "warning" },
  pending_hr_review: { text: "待人事复核", tag: "warning" },
  department_approved: { text: "初审通过", tag: "success" },
  hr_approved: { text: "复核通过", tag: "success" },
  rejected: { text: "已驳回", tag: "danger" },
}

/** 礼品上下架状态 */
export const GIFT_STATUS_MAP: Record<string, StatusMeta> = {
  active: { text: "上架", tag: "success" },
  inactive: { text: "下架", tag: "info" },
}

/** 投票状态（P1 投票管理使用） */
export const VOTE_STATUS_MAP: Record<string, StatusMeta> = {
  not_started: { text: "未开始", tag: "info" },
  in_progress: { text: "进行中", tag: "warning" },
  ended: { text: "已结束", tag: "success" },
}

/** 积分流水类型 → 文案（加分绿/扣分红等语义色见配色规范第 6 节） */
export const POINT_TYPE_MAP: Record<string, StatusMeta> = {
  reward: { text: "加分", tag: "success" },
  penalty: { text: "扣分", tag: "danger" },
  performance: { text: "绩效", tag: "info" },
  exchange: { text: "兑换", tag: "info" },
  refund: { text: "退分", tag: "primary" },
  reversal: { text: "冲正", tag: "warning" },
}

/** 查表兜底：未知 key 原样返回文本 + info 标签 */
export function statusMeta(map: Record<string, StatusMeta>, key: string | null | undefined): StatusMeta {
  const value = String(key ?? "")
  return map[value] || { text: value, tag: "info" }
}
