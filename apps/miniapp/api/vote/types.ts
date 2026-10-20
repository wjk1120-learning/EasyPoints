/** vote 域类型：我的投票（契约见 docs/Easy-Points-API.md 9.7~9.9；投票仅作审核参考，不自动积分、不自动审核） */

export interface VoteSummary {
  id: number | string
  title?: string
  description?: string
  /** single=单选 / multiple=多选（=voteType 别名） */
  mode?: string
  multiple?: boolean
  /** 本人是否已提交（=submittedByMe 别名） */
  submitted?: boolean
  closed?: boolean
  /** 是否已截止（手动关闭或到期，服务端回填） */
  expired?: boolean
  /** 截止时间 yyyy-MM-dd HH:mm */
  deadline?: string
  /** 关联业务标签（如「任务 #7 · 整理客户回访文档」；普通调研为 null） */
  relatedLabel?: string
}

export interface VoteOption {
  id: number | string
  text?: string
  label?: string
}

export interface VoteDetail extends VoteSummary {
  status?: string
  statusText?: string
  options?: VoteOption[]
  /** 本人已投选项 ID（仅 submitted 时返回回显；小程序契约字段名） */
  selectedOptionIds?: (number | string)[]
  myOptionIds?: (number | string)[]
}
