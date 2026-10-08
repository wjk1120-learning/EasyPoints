/** wecom 域类型：企微通讯录同步 */
import type { Employee } from "../employee/types"

/**
 * 通讯录同步结果：当前后端 mock 返回本次同步落库的员工数组。
 * 分项统计（新增/更新/禁用人数）待后端扩展为 { created, updated, disabled } 结构，
 * 见 docs/admin-web-api-requirements.md 通讯录同步章节。
 */
export type SyncContactsResult = Employee[]
