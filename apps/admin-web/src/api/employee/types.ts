/** employee 域类型：员工及其积分字段 */

/** 员工（企微通讯录同步 + 积分余额） */
export interface Employee {
  id: number
  name: string
  departmentId: number
  departmentName?: string
  wecomUserId?: string
  /** 当前积分余额（现有后端单字段） */
  pointsBalance: number
  /** 双积分：实时积分（可用余额）——后端字段待接入，见 docs/admin-web-api-requirements.md */
  realtimePoints?: number
  /** 双积分：实际积分（终身累计荣誉分）——后端字段待接入 */
  actualPoints?: number
  status: "active" | "inactive" | string
}

/** 员工列表查询参数 */
export interface EmployeeQuery {
  page?: number
  pageSize?: number
}
