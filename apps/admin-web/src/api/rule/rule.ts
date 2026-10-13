import type { RuleContent, RulePayload } from "./types"
import { get, put } from "../../utils/request"

/** 规则 REST 路径（契约见 docs/Easy-Points-API.md 8.1/8.2：单对象 GET/PUT） */
export const RuleApi = {
  Rule: "/admin/rules",
} as const

export type { RuleContent, RulePayload } from "./types"

/** 获取当前生效规则（用户端规则中心读取同一份数据，保存后即时生效；无规则时 content 为空串） */
export function getRule(): Promise<RuleContent> {
  return get<RuleContent>(RuleApi.Rule)
}

/** 保存积分规则（content 为富文本 HTML，100KB 上限；保存后即时生效，用户端无需发版） */
export function saveRule(payload: RulePayload): Promise<RuleContent> {
  return put<RuleContent>(RuleApi.Rule, payload)
}
