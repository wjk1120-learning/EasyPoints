/** rule 域类型：已发布规则（契约见 docs/Easy-Points-API.md 8.7，与 /admin/rules 同数据源，仅 published） */

export interface RuleSection {
  id?: number | string
  title?: string
  /** 规则正文（管理端富文本 HTML——第 3 阶段用 rich-text 渲染） */
  content?: string
  version?: number
  updatedAt?: string
}
