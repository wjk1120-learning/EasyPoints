/** rule 域类型：积分规则配置（PRD 5.8 / 4.7 规则中心） */

export interface RuleContent {
  /** 富文本 HTML（wangeditor 产出） */
  content: string
  updatedAt?: string
  updatedBy?: string
}

/** 保存规则参数 */
export interface RulePayload {
  content: string
}
