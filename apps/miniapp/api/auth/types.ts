/** auth 域类型：员工端登录（契约见 docs/Easy-Points-API.md 1.4；wecomUserId/employeeId 直登仅后端 dev profile 开放，生产仅企微免登 code） */

export type LoginPayload = {
  wecomUserId?: string
  employeeId?: number | string
  /** 企微免登 code（生产模式唯一登录方式，第 4 步接入） */
  code?: string
}

/** 员工登录响应（契约 1.4 EmployeeLoginVo） */
export interface EmployeeLoginVo {
  accessToken: string
  refreshToken?: string
  tokenType?: string
  /** 有效期（秒，7200） */
  expiresIn?: number
  employee?: {
    id?: number | string
    name?: string
    wecomUserId?: string
    departmentId?: number | string
    status?: string
  }
}
