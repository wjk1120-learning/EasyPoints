/** vote 域类型：投票管理（契约见 docs/Easy-Points-API.md 9.1~9.6；投票仅作审核参考，不自动积分、不自动审核） */

export interface VoteOption {
  id: number
  text: string
}

/** 关联业务：空串=普通调研投票；task=关联任务；application=关联积分申请工单 */
export type VoteRelatedType = "" | "task" | "application"

export type VoteStatus = "not_started" | "in_progress" | "ended"

export interface Vote {
  id: number
  title: string
  description: string
  relatedType: VoteRelatedType
  relatedId?: number
  /** 关联业务友好文本（服务端回填，如「任务 #7 · 整理客户回访文档」；普通调研为 null） */
  relatedLabel?: string | null
  /** single=单选 / multiple=多选（创建后不可改） */
  voteType: "single" | "multiple"
  options: VoteOption[]
  /** YYYY-MM-DD HH:mm */
  startTime: string
  /** YYYY-MM-DD HH:mm */
  endTime: string
  /** 参与人员 ID 列表：仅被勾选员工小程序端可见该投票（编辑回填选人框按 ID） */
  participantIds: number[]
  /** 应参与人数 */
  participantCount?: number
  /** 参与人姓名列表（展示冗余） */
  participantNames?: string[]
  /** 是否已手动关闭（到期结束不置位，由 status 表达） */
  closed?: boolean
  /** 服务端派生状态（not_started/in_progress/ended；前端 deriveVoteStatus 兜底旧数据） */
  status?: VoteStatus
  /** 已提交人数 */
  submittedCount?: number
  createdBy?: number
  createdAt?: string
  updatedAt?: string
}

/** 新建/编辑投票参数（9.2/9.3：options 传纯文本数组，ID 服务端生成；participantNames/relatedLabel 由服务端派生，不回传） */
export interface VotePayload {
  title: string
  /** 补充说明（选填；v4.3 已补录 9.2/9.3 payload 契约，编辑整体覆盖） */
  description: string
  relatedType: VoteRelatedType
  relatedId?: number
  voteType: "single" | "multiple"
  options: string[]
  startTime: string
  endTime: string
  participantIds: number[]
}

export interface VoteQuery {
  page?: number
  pageSize?: number
  /** 标题模糊搜索 */
  title?: string
  /** 按派生状态筛选：not_started/in_progress/ended */
  status?: string
}

/** 投票统计（9.5：进行中、已结束均可查看） */
export interface VoteStats {
  /** 应参与人数 */
  totalParticipants: number
  /** 实际提交人数 */
  submittedCount: number
  /** 参与率（0-100 整数） */
  participationRate: number
  optionStats: { optionId: number; text: string; votes: number; percent: number }[]
  details: { employeeId: number; employeeName: string; selectedTexts: string[]; submittedAt: string }[]
}
