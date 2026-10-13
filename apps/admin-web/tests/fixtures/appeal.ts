/**
 * appeal 域测试 fixture：字段与时间格式严格按 docs/Easy-Points-API.md 7.3（含 targetSummary 两类目标形态）。
 */

/** 流水类申诉（附 pointRecord） */
export const APPEAL_POINT_RECORD_FIXTURE = {
  id: 21,
  targetType: "point_record",
  targetId: 101,
  pointRecordId: 101,
  pointRecord: {
    id: 101,
    employeeId: 1,
    pointsDelta: -50,
    cumulativePointsDelta: -50,
    type: "penalty",
    operatorName: "系统管理员",
    occurredAt: "2026-10-09 15:30:00",
    remark: "月度检查不合格扣分",
    occurredAtTime: undefined,
  },
  employeeId: 1,
  employeeName: "张三",
  reason: "当月有客户表扬，不应扣分",
  evidenceImages: "[\"/uploads/ev/a1.png\"]",
  targetSummary: {
    title: "积分流水 #101",
    content: "月度检查不合格扣分",
    reviewRemark: null,
  },
  status: "pending_review",
  statusText: "待审核",
  resolution: null,
  reviewerId: null,
  resultRemark: null,
  createdAt: "2026-10-10 10:00:00",
  updatedAt: "2026-10-10 10:00:00",
} as const

/** 任务类申诉（无 pointRecord，targetSummary 提供审核上下文——原"盲审"场景） */
export const APPEAL_TASK_CLAIM_FIXTURE = {
  id: 22,
  targetType: "task_claim",
  targetId: 87,
  pointRecordId: null,
  pointRecord: null,
  employeeId: 2,
  employeeName: "李四",
  reason: "成果已按文档要求提交，驳回理由不成立",
  evidenceImages: "[]",
  targetSummary: {
    title: "整理客户回访文档",
    content: "初步整理稿",
    reviewRemark: "缺少回访记录明细，请补充后重新提交",
  },
  status: "pending_review",
  statusText: "待审核",
  resolution: null,
  reviewerId: null,
  resultRemark: null,
  createdAt: "2026-10-10 11:00:00",
  updatedAt: "2026-10-10 11:00:00",
} as const

export const APPEALS_FIXTURE = [APPEAL_POINT_RECORD_FIXTURE, APPEAL_TASK_CLAIM_FIXTURE] as const

/** 已审结行 */
export const APPEAL_REJECTED_FIXTURE = {
  ...APPEAL_TASK_CLAIM_FIXTURE,
  id: 20,
  status: "rejected",
  statusText: "已驳回",
  resultRemark: "驳回理由成立，维持原判",
  resolution: "驳回理由成立，维持原判",
  reviewerId: 1,
  createdAt: "2026-10-08 10:00:00",
  updatedAt: "2026-10-09 09:00:00",
} as const
