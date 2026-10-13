/**
 * points/report 域测试 fixture：字段与时间格式严格按 docs/Easy-Points-API.md
 * 2.1 响应示例的 PointRecord 结构（双积分 + 来源 + 冲正引用）。
 */

export const POINT_RECORD_FIXTURE = {
  id: 101,
  employeeId: 1,
  departmentId: 2,
  pointsDelta: 50,
  cumulativePointsDelta: 50,
  type: "performance",
  sourceType: "task_reward",
  sourceId: "88",
  operatorId: 1,
  operatorName: "系统管理员",
  remark: "任务奖励：月度之星评选",
  reversalOfId: null,
  occurredAt: "2026-10-09 15:30:00",
  createdAt: "2026-10-09 15:30:01",
  month: "2026-10",
} as const

/** 报表行（PointRecord + employeeName，文档 3.4） */
export const POINT_REPORT_ROW_FIXTURE = { ...POINT_RECORD_FIXTURE, employeeName: "张三" } as const
