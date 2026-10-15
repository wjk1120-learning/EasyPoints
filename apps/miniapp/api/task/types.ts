/** task 域类型：任务大厅（契约见 docs/Easy-Points-API.md 5.1~5.2b，status 为个人视角状态） */

export interface Task {
  id: number | string
  name?: string
  /** 任务名称（title 为小程序契约别名，=name） */
  title?: string
  description?: string
  summary?: string
  /** open/in_progress/pending_review/approved/rejected（个人视角） */
  status?: string
  statusText?: string
  rewardPoints?: number
  points?: number
  /** 截止日 yyyy-MM-dd（null=长期有效） */
  deadline?: string
  dueAt?: string
  deadlineAt?: string
  claimable?: boolean
  canSubmit?: boolean
  result?: string
  submitContent?: string
  createdAt?: string
  updatedAt?: string
}

/** 领取记录行（契约 5.3：GET /miniapp/task-claims，含任务快照；id 即申诉 task_claim 的 targetId） */
export interface TaskClaim {
  /** 领取记录 ID（task_claims 主键） */
  id: number | string
  /** 所属任务 ID */
  taskId: number | string
  employeeId?: number | string
  status?: string
  statusText?: string
  taskName?: string
  employeeName?: string
  rewardPoints?: number
  submittedText?: string
  evidenceImages?: string[] | string
  /** 审核备注（驳回原因） */
  reviewRemark?: string
  reviewedAt?: string
  submittedAt?: string
  createdAt?: string
  updatedAt?: string
}
