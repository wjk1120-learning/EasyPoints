/** appeal 域类型：申诉（契约见 docs/Easy-Points-API.md 7.1~7.2；同一目标仅可申诉一次） */

export interface Appeal {
  id: number | string
  /** 现状老口径 pointRecordId——第 3 阶段切 targetType/targetId */
  pointRecordId?: number | string
  targetType?: string
  targetId?: number | string
  reason?: string
  status?: string
  statusText?: string
  /** 处理意见（=resultRemark，仅处理后返回） */
  resolution?: string
  reviewRemark?: string
  result?: string
  createdAt?: string
}

export interface AppealCreatePayload {
  pointRecordId?: number | string
  targetType?: string
  targetId?: number | string
  /** 申诉理由（必填非空） */
  reason: string
}
