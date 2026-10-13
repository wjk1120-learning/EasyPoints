import type { SyncContactsResult } from "./types"
import { post } from "../../utils/request"

/** 企微通讯录 REST 路径（契约见 docs/Easy-Points-API.md 10.8） */
export const WecomApi = {
  SyncContacts: "/admin/wecom/sync-contacts",
} as const

/**
 * 一键同步企微通讯录（10.8）：后端拉取部门树与成员详情 upsert，
 * 离职/移出可见范围自动置 inactive（历史流水保留；Redis 互斥锁防重入）。
 * 错误场景：同步进行中 400「同步进行中，请稍候」；凭据未配置 503；拉取失败 502。
 */
export function syncContacts(): Promise<SyncContactsResult> {
  return post<SyncContactsResult>(WecomApi.SyncContacts)
}
