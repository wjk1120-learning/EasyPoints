import type { RuleContent, RulePayload } from "./types"
import { get, put } from "../../utils/request"
import { withMock } from "../../mock"
import { mockGetRule, mockSaveRule } from "../../mock/rule"

/** 规则配置 REST 路径（后端待开发，契约见 docs/admin-web-api-requirements.md 3.8） */
export const RuleApi = {
  Rule: "/admin/rules",
} as const

export type { RuleContent, RulePayload } from "./types"

/** 获取当前积分规则（用户端规则中心读取同一份数据，保存后即时生效） */
export function getRule(): Promise<RuleContent> {
  return withMock(
    () => get<RuleContent>(RuleApi.Rule),
    () => mockGetRule(),
  )
}

/** 保存积分规则：保存后即时生效，用户端无需发版刷新 */
export function saveRule(payload: RulePayload): Promise<RuleContent> {
  return withMock(
    () => put<RuleContent>(RuleApi.Rule, payload),
    () => mockSaveRule(payload),
  )
}
