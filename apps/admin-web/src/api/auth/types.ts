/** auth 域类型：登录请求/响应、管理员信息 */

/** 管理员账号信息（/admin/auth/login 返回） */
export interface AdminInfo {
  id: number
  username: string
  name: string
  role: "super_admin" | "hr_admin" | "department_admin" | string
  /** 部门管理员可管辖的部门 ID 列表 */
  departmentIds?: number[]
}

/** 登录请求参数 */
export interface LoginPayload {
  username: string
  password: string
}

/** 登录响应：JWT + 管理员信息 */
export interface LoginResult {
  token: string
  admin: AdminInfo
}

/** 待办角标聚合（契约 11.2：四类待审合计，与审核中心各 Tab 待审数同口径；辖内裁剪） */
export interface BadgesResult {
  /** 礼品兑换待审核数 */
  exchangePending: number
  /** 任务成果待审核数 */
  taskPending: number
  /** 积分申请待审核数 */
  applicationPending: number
  /** 申诉待处理数 */
  appealPending: number
}

/** 工作台汇总（契约 11.3：taskCount=published 任务数；辖内裁剪） */
export interface DashboardSummary {
  employeeCount: number
  giftCount: number
  taskCount: number
  pending: {
    orders: number
    taskClaims: number
    applications: number
    appeals: number
  }
}
