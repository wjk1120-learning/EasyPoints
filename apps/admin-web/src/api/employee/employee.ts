import type { Paged } from "../types"
import type { Employee, EmployeeQuery } from "./types"
import { get } from "../../utils/request"
import { withMock } from "../../mock"
import { mockEmployees } from "../../mock/employee"

/** 员工 REST 路径（apps/api/src/app.js；数据源头为企微通讯录，见 wecom 域） */
export const EmployeeApi = {
  List: "/admin/employees",
} as const

/** 全量员工列表（量级小，页面做前端筛选/分页；mock 提供双积分演示数据，后端双积分字段就绪后真实数据自动带上） */
export function employees(): Promise<Employee[]> {
  return withMock(
    () => get<Employee[]>(EmployeeApi.List),
    () => mockEmployees(),
  )
}

/** 分页员工列表 */
export function employeesPaged(params: EmployeeQuery): Promise<Paged<Employee>> {
  return withMock(
    () => get<Paged<Employee>>(EmployeeApi.List, { ...params }),
    async () => {
      const all = await mockEmployees()
      const page = Number(params.page || 1)
      const pageSize = Number(params.pageSize || 50)
      return { data: all.slice((page - 1) * pageSize, page * pageSize), meta: { total: all.length, page, pageSize } }
    },
  )
}
