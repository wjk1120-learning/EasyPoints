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
}
