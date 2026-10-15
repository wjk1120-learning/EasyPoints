/** points 域类型：我的积分流水（契约见 docs/Easy-Points-API.md 2.1，按月分组 Map<月份, 流水[]>） */

export interface PointRecordItem {
  id: number | string
  pointsDelta?: number
  cumulativePointsDelta?: number
  type?: string
  sourceType?: string
  sourceId?: string
  operatorName?: string
  /** 完整备注（积分流水核心字段，不可改） */
  remark?: string
  occurredAt?: string
  createdAt?: string
  /** 归组键 yyyy-MM（东八区） */
  month?: string
}

export type MonthGroups = Record<string, PointRecordItem[]>
