/** vote 域类型：投票管理（PRD 3.4 / 5.9；投票仅作审核参考，不自动积分、不自动审核） */

export interface VoteOption {
  id: number
  text: string
}

/** 关联业务：空串=普通调研投票；task=关联任务；application=关联积分申请工单 */
export type VoteRelatedType = "" | "task" | "application"

export interface Vote {
  id: number
  title: string
  description: string
  relatedType: VoteRelatedType
  relatedId?: number
  /** 冗余展示文本，如「任务 #1 整理客户回访文档」 */
  relatedLabel?: string
  /** single=单选 / multiple=多选 */
  voteType: "single" | "multiple"
  options: VoteOption[]
  /** YYYY-MM-DD HH:mm */
  startTime: string
  /** YYYY-MM-DD HH:mm */
  endTime: string
  /** 参与人员 ID 列表：仅被勾选员工小程序端可见该投票 */
  participantIds: number[]
  /** 冗余展示文本 */
  participantNames?: string[]
  /** 手动关闭（关闭后员工不可提交，状态视为已结束） */
  closed?: boolean
  /** 已提交人数（列表列「参与人数」分母为 participantIds.length） */
  submittedCount?: number
  createdBy?: string
  createdAt?: string
  updatedAt?: string
}

/** 新建/编辑投票参数（选项传纯文本数组，ID 由服务端生成） */
export interface VotePayload {
  title: string
  description: string
  relatedType: VoteRelatedType
  relatedId?: number
  relatedLabel?: string
  voteType: "single" | "multiple"
  options: string[]
  startTime: string
  endTime: string
  participantIds: number[]
  participantNames?: string[]
}

export type VoteStatus = "not_started" | "in_progress" | "ended"

export interface VoteQuery {
  page?: number
  pageSize?: number
  /** 标题模糊搜索 */
  title?: string
  /** 按推导状态筛选：not_started/in_progress/ended */
  status?: string
}

/** 投票统计（PRD 5.9.2：进行中、已结束均可查看） */
export interface VoteStats {
  /** 应参与人数 */
  totalParticipants: number
  /** 实际提交人数 */
  submittedCount: number
  /** 参与率（0-100 整数） */
  participationRate: number
  optionStats: { text: string; votes: number; percent: number }[]
  details: { employeeId: number; employeeName: string; selectedTexts: string[]; submittedAt: string }[]
}

/** 投票操作日志（PRD 5.9.3：新增日志类型「投票操作日志」，永久留存） */
export interface VoteOpLog {
  id: number
  /** vote.created / vote.updated / vote.closed / vote.exported / vote.submitted */
  action: string
  /** 中文动作，如「投票创建」 */
  actionText: string
  /** 操作管理员 / 提交员工 */
  actorText: string
  /** 操作对象：投票「标题」 */
  target: string
  /** 操作内容 */
  content: string
  /** 备注详情（如所选选项、关联业务；无则空串） */
  remark: string
  createdAt: string
}
