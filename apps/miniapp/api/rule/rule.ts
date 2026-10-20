import type { RuleSection } from "./types"
import { request } from "../../utils/request"

/** 规则 REST 路径（契约见 docs/Easy-Points-API.md 8.7） */
export const RuleApi = {
  List: "/miniapp/rules",
} as const

export type { RuleSection } from "./types"

/** 已发布规则（8.7：[{ id, title, content, version, updatedAt }]，后台更新实时同步） */
export function fetchRules(): Promise<RuleSection[]> {
  return request<RuleSection[]>(RuleApi.List)
}
