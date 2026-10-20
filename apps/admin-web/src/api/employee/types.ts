/** employee 域类型：员工及其双积分字段（契约见 docs/Easy-Points-API.md 11.1 Employee 结构） */

/**
 * 双积分口径（PRD 3.1，展示名以中文为准）：
 * - 实际积分 availablePoints：当前可兑换余额；兑换礼品、管理员扣分会扣减。
 * - 累计积分 cumulativePoints：终身累计荣誉分；只增不减（仅管理员人工扣分可减少），兑换不扣减；用于荣誉排名。
 * 过渡期兼容：旧后端无双积分字段时由页面 `?? pointsBalance` 兜底展示。
 */
export interface Employee {
  id: number
  /** 企微 UserId */
  wecomUserId: string
  name: string
  departmentId: number
  departmentName: string
  /** 实际积分（兼容冗余字段，=availablePoints） */
  pointsBalance: number
  /** 实际积分：可兑换余额 */
  availablePoints: number
  /** 累计积分：终身荣誉分 */
  cumulativePoints: number
  status: "active" | "inactive" | string
  createdAt: string
}

/** 员工列表查询参数（文档 11.1：均选填；不传分页时后端 rows 返回全量） */
export interface EmployeeQuery {
  page?: number
  pageSize?: number
  /** 姓名模糊 */
  keyword?: string
  /** 部门精确 */
  departmentId?: number
  /** active / inactive */
  status?: string
}
