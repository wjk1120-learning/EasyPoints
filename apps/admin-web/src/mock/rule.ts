/**
 * rule 域 mock：规则配置后端接口尚未开发，前端 mock 先行。
 * 数据结构即后端实现目标（契约见 docs/admin-web-api-requirements.md 3.8）。
 */
import type { RuleContent, RulePayload } from "../api/rule/types"

const DEFAULT_RULE_HTML = `<h2>积分加减规则</h2><ul><li>加分场景：项目攻坚、客户表扬、跨部门协作等，由管理员单笔录入或月度批量录入，备注必填。</li><li>扣分场景：迟到早退、违规违纪等，管理员人工扣分将同步扣减可用积分与累计积分。</li></ul><h2>任务规则</h2><ul><li>任务由管理员发布，上架后可在任务大厅领取。</li><li>提交成果后进入待审核，审核通过后奖励积分同步计入可用积分与累计积分。</li></ul><h2>兑换规则</h2><ul><li>兑换礼品仅消耗可用积分，累计积分不受影响。</li><li>兑换需管理员审核，驳回后积分自动退回。</li></ul><h2>申诉规则</h2><ul><li>可对扣分、任务驳回、兑换驳回、积分申请驳回发起申诉。</li><li>单条异议仅支持一次申诉，处理后闭环。</li></ul>`

let current: RuleContent = {
  content: DEFAULT_RULE_HTML,
  updatedAt: new Date().toISOString(),
  updatedBy: "系统"
}

/** 获取当前规则（用户端规则中心读取同一份数据，保存后即时生效） */
export function mockGetRule(): Promise<RuleContent> {
  return Promise.resolve({ ...current })
}

export function mockSaveRule(payload: RulePayload): Promise<RuleContent> {
  current = {
    content: payload.content,
    updatedAt: new Date().toISOString(),
    updatedBy: "当前管理员"
  }
  return Promise.resolve({ ...current })
}
