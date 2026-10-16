/** appeal 域类型：申诉（契约见 docs/Easy-Points-API.md 7.1~7.2；同一目标仅可申诉一次） */

export interface Appeal {
  id: number | string
  /** 申诉目标（契约 7.1 四类：point_record/task_claim/order/point_application） */
  targetType?: string
  targetId?: number | string
  /** 关联原流水 ID（后端计算字段：仅 point_record 目标=targetId，其余 null） */
  pointRecordId?: number | string | null
  reason?: string
  /** 佐证图 URL 数组（后端以 JSON 字符串存储且原样输出） */
  evidenceImages?: string
  /** 一级三态：pending_review / approved / rejected */
  status?: string
  /** 状态中文（后端计算字段：待审核/审核通过/已驳回） */
  statusText?: string
  /** 处理意见（后端计算字段，=resultRemark，仅处理后有值） */
  resolution?: string
  resultRemark?: string
  createdAt?: string
  updatedAt?: string
}

export interface AppealCreatePayload {
  /** 目标类型（四类） */
  targetType: string
  /** 本人目标记录 ID（task_claim 必须传领取记录主键） */
  targetId: number | string
  /** 申诉理由（必填非空，空 400「申诉原因不能为空」） */
  reason: string
  /** 佐证图 URL（≤9 张，先过 11.9 上传接口） */
  evidenceImages?: string[]
}
