/** wecom 域类型：企微通讯录同步（契约见 docs/Easy-Points-API.md 10.8） */

/** 一键同步结果：后端拉取企微通讯录 upsert，离职/移出可见范围自动置 inactive（历史流水保留） */
export interface SyncContactsResult {
  /** 本次新增员工数 */
  created: number
  /** 本次更新员工数 */
  updated: number
  /** 本次停用（inactive）员工数 */
  disabled: number
  /** 企微名单总人数 */
  total: number
}
