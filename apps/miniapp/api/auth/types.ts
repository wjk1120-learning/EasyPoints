/** auth 域类型：员工端登录（契约见 docs/Easy-Points-API.md 1.4；wecomUserId/employeeId 直登仅后端 dev profile 开放） */

export type LoginPayload = {
  wecomUserId?: string
  employeeId?: number | string
}

/** 现状老信封直读 token 字段——第 2 步切新后端 EmployeeLoginVo（data.accessToken + refreshToken + employee） */
export type LoginResult = {
  token?: string
  employee?: {
    id?: number | string
    name?: string
    wecomUserId?: string
  }
} & Record<string, unknown>
