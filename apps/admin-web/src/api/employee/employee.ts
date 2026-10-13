import type { Paged } from "../types"
import type { Employee, EmployeeQuery } from "./types"
import { get } from "../../utils/request"

/** 员工 REST 路径（契约见 docs/Easy-Points-API.md 11.1） */
export const EmployeeApi = {
  List: "/admin/employees",
} as const

export type { Employee, EmployeeQuery } from "./types"

/** 全量员工列表（11.1：恒 PageResult 包装，不传分页时 rows 返回全量；量级小，页面做前端筛选/分页） */
export async function employees(params: EmployeeQuery = {}): Promise<Employee[]> {
  const res = await get<Paged<Employee>>(EmployeeApi.List, { ...params });
  return res.data;
}
