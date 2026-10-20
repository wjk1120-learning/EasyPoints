/** application 域类型：积分申请（契约见 docs/Easy-Points-API.md 6.1~6.2；贡献描述输出字段名为 reason，待审状态值为 pending_review） */

export interface PointApplication {
  id: number | string
  /** 申请分值（正数） */
  points?: number
  /** 贡献描述（输出字段名） */
  reason?: string
  status?: string
  /** 状态中文（待审核/已通过/已驳回，计算字段） */
  statusText?: string
  /** 审核备注（驳回时员工可见的处理意见） */
  reviewRemark?: string
  evidenceImages?: string[] | string
  createdAt?: string
  updatedAt?: string
}

export interface ApplicationCreatePayload {
  /** 申请分值（正数） */
  points: number
  /** 贡献描述（必填非空） */
  description: string
}
