/** task 域类型：任务发布与员工任务成果审核（契约见 docs/Easy-Points-API.md 5.5~5.11） */

/** 任务（管理员发布；上架后员工端任务大厅可见；新建默认 unpublished） */
export interface Task {
  id: number
  name: string
  description: string
  /** 奖励积分（>0，审核通过后双积分到账） */
  rewardPoints: number
  /** 完成要求说明 */
  requirement: string
  /** 截止日 YYYY-MM-DD（映射 validUntil=当日 23:59:59；空串/null=长期有效） */
  deadline: string
  /** published=上架中 / unpublished=已下架（下架对用户端隐藏，记录保留）；deleted 为内部软删值 */
  status: "published" | "unpublished" | string
  /** 创建管理员 */
  createdBy?: number
  createdAt?: string
  updatedAt?: string
}

/** 新增/编辑任务参数（5.6/5.7：deadline 由页面必填；新建默认下架由后端保证） */
export interface TaskPayload {
  name: string
  description: string
  rewardPoints: number
  deadline: string
  requirement: string
}

/** 员工任务记录（5.10：领取 → 进行中 → 提交成果（待审核）→ 通过/驳回） */
export interface EmployeeTask {
  id: number
  taskId: number
  /** 任务名称快照（join tasks 带出） */
  taskName?: string
  /** 奖励积分快照 */
  rewardPoints?: number
  employeeId: number
  employeeName?: string
  /** in_progress=进行中 / pending_review=待审核 / approved=已通过 / rejected=已驳回 */
  status: "in_progress" | "pending_review" | "approved" | "rejected" | string
  /** 成果说明（提交后有值） */
  submissionText?: string
  /** 佐证图 URL 数组 */
  submissionImages?: string[]
  submittedAt?: string
  /** 审核管理员 */
  reviewerId?: number
  reviewedAt?: string
  /** 审核意见：驳回必填（PRD 3.2） */
  reviewRemark?: string
  createdAt?: string
  updatedAt?: string
}

/** 员工任务记录查询参数（5.10，均选填） */
export interface TaskRecordQuery {
  page?: number
  pageSize?: number
  status?: string
  taskId?: number | string
  employeeId?: number | string
  createdAfter?: string
  createdBefore?: string
}

/** 任务成果审核参数（5.11：通过→type=performance 流水双积分入账；驳回 remark 必填，驳回后员工可申诉） */
export interface TaskRecordReviewPayload {
  status: "approved" | "rejected"
  remark: string
}
