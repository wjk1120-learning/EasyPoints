import type { Paged } from "../types"
import type { Employee, EmployeeQuery } from "./types"
import { get } from "../../utils/request"

/** 员工 REST 路径（契约见 docs/Easy-Points-API.md 11.1） */
export const EmployeeApi = {
  List: "/admin/employees",
} as const

export type { Employee, EmployeeQuery } from "./types"

/**
 * 全量员工列表（量级小，页面做前端筛选/分页）。
 * 文档定稿：响应恒为 PageResult{total,rows} 包装，不传分页时 rows 返回全量；
 * 防御后端实现偏差（裸数组）做双兼容。
 */
export async function employees(params: EmployeeQuery = {}): Promise<Employee[]> {
  const res = await get<Paged<Employee> | Employee[]>(EmployeeApi.List, { ...params });
  return Array.isArray(res) ? res : res.data;
}
