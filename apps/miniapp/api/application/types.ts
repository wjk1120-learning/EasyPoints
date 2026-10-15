/** application 域类型：积分申请（契约见 docs/Easy-Points-API.md 6.1~6.2；贡献描述输出字段名为 reason） */

export interface PointApplication {
  id: number | string
  points?: number
  description?: string
  /** 贡献描述（输出字段名，=description） */
  reason?: string
  /** 现状 pending / approved / rejected；新后端待审为 pending_review——第 3 阶段对齐 */
  status?: string
  statusText?: string
  resolution?: string
  reviewRemark?: string
  result?: string
  createdAt?: string
  updatedAt?: string
}

export interface ApplicationCreatePayload {
  /** 申请分值（正数） */
  points: number
  /** 贡献描述（必填非空） */
  description: string
}
