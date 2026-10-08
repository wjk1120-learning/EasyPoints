/** wecom 域类型：企微通讯录同步 */

/** 通讯录同步结果：新增/更新/禁用人数统计（PRD Day 4：增量同步口径） */
export interface SyncContactsResult {
  created?: number
  updated?: number
  disabled?: number
  total?: number
  [key: string]: unknown
}
