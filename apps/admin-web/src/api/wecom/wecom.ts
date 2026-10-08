import type { SyncContactsResult } from "./types"
import { post } from "../../utils/request"

/** 企微通讯录/消息 REST 路径（apps/api/src/app.js，当前后端为 mock 实现） */
export const WecomApi = {
  SyncContacts: "/admin/wecom/sync-contacts",
} as const

/** 一键同步企微通讯录：后端拉取部门与成员落库，返回本次同步的员工列表 */
export function syncContacts(): Promise<SyncContactsResult> {
  return post<SyncContactsResult>(WecomApi.SyncContacts)
}
