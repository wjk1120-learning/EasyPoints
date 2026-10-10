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
