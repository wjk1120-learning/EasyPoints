/**
 * rule 域测试 fixture：字段与时间格式严格按 docs/Easy-Points-API.md 8.1（yyyy-MM-dd HH:mm:ss）。
 * 供 L2 契约测试、L3 组件测试、L4 浏览器冒烟（route 注入）共用。
 */

export const RULE_FIXTURE = {
  content: "<h2>积分加减规则</h2><ul><li>加分场景：项目攻坚、客户表扬、跨部门协作等，备注必填。</li><li>扣分场景：迟到早退、违规违纪等，人工扣分同步扣减可用积分与累计积分。</li></ul><h2>兑换规则</h2><ul><li>兑换仅消耗可用积分；驳回自动退回。</li></ul>",
  updatedAt: "2026-10-12 16:30:00",
  updatedBy: "系统管理员",
} as const

/** 文档 8.1：无规则时 content 为空串 */
export const RULE_EMPTY_FIXTURE = {
  content: "",
  updatedAt: "2026-10-12 16:30:00",
  updatedBy: "系统管理员",
} as const

/** 新后端 BaseResult 包装 */
export function baseResult<T>(data: T, code = 1, msg = "成功") {
  return { code, msg, data }
}
