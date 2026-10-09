/** employee 域类型：员工及其积分字段 */

/**
 * 双积分口径（PRD 3.1，展示名以中文为准）：
 * - 可用积分 availablePoints：当前可兑换余额；兑换礼品、管理员扣分会扣减。
 * - 累计积分 cumulativePoints：终身累计荣誉分；只增不减（仅管理员人工扣分可减少），兑换不扣减；用于荣誉排名。
 */
export interface Employee {
  id: number
  name: string
  departmentId: number
  departmentName?: string
  wecomUserId?: string
  /** 当前积分余额（现有后端单字段，双积分过渡期兜底展示） */
  pointsBalance: number
  /** 可用积分：可兑换余额——后端字段待接入，见 docs/admin-web-api-requirements.md 3.2 */
  availablePoints?: number
  /** 累计积分：终身累计荣誉分，只增不减（仅人工扣分可减）——后端字段待接入 */
  cumulativePoints?: number
  status: "active" | "inactive" | string
}

/** 员工列表查询参数 */
export interface EmployeeQuery {
  page?: number
  pageSize?: number
}
