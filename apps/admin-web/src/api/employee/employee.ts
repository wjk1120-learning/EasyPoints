import type { Paged } from "../types"
import type { Employee, EmployeeQuery } from "./types"
import { get } from "../../utils/request"

/** 员工 REST 路径（apps/api/src/app.js；数据源头为企微通讯录，见 wecom 域） */
export const EmployeeApi = {
  List: "/admin/employees",
} as const

/** 全量员工列表（量级小，页面做前端筛选/分页） */
export function employees(): Promise<Employee[]> {
  return get<Employee[]>(EmployeeApi.List)
}

/** 分页员工列表 */
export function employeesPaged(params: EmployeeQuery): Promise<Paged<Employee>> {
  return get<Paged<Employee>>(EmployeeApi.List, { ...params })
}
