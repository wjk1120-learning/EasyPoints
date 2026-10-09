/** task 域类型：任务发布与员工任务成果审核（PRD 5.5 / 5.2） */

/** 任务（管理员发布；上架后员工端任务大厅可见） */
export interface Task {
  id: number
  name: string
  description: string
  /** 奖励积分（正整数，审核通过后双积分到账） */
  rewardPoints: number
  /** 有效期 YYYY-MM-DD，到期员工不可再领取/提交 */
  deadline: string
  /** 完成要求说明 */
  requirement: string
  /** published=上架中 / unpublished=已下架（下架对用户端隐藏，记录保留） */
  status: "published" | "unpublished" | string
  createdAt?: string
  updatedAt?: string
}

/** 新增/编辑任务参数 */
export interface TaskPayload {
  name: string
  description: string
  rewardPoints: number
  deadline: string
  requirement: string
}

/** 员工任务记录：领取 → 进行中 → 提交成果（待审核） → 通过/驳回 */
export interface EmployeeTask {
  id: number
  taskId: number
  taskName?: string
  /** 冗余奖励积分（审核通过后双积分到账的数额） */
  rewardPoints?: number
  employeeId: number
  employeeName?: string
  /** in_progress=进行中 / pending_review=待审核 / approved=已通过 / rejected=已驳回 */
  status: "in_progress" | "pending_review" | "approved" | "rejected" | string
  /** 成果文字描述（提交后有值） */
  submissionText?: string
  /** 佐证图片 URL 列表 */
  submissionImages?: string[]
  submittedAt?: string
  reviewedAt?: string
  /** 审核意见：驳回必填（PRD 3.2） */
  reviewRemark?: string
  createdAt?: string
  updatedAt?: string
}

/** 员工任务记录查询参数 */
export interface TaskRecordQuery {
  page?: number
  pageSize?: number
  status?: string
  taskId?: number | string
  employeeId?: number | string
}

/** 任务成果审核参数：通过→奖励积分双积分到账（后端职责）；驳回 remark 必填 */
export interface TaskRecordReviewPayload {
  status: "approved" | "rejected"
  remark: string
}
