import type { Paged } from "../types"
import type { LogQuery, OperationLog } from "./types"
import { get } from "../../utils/request"

/** 操作日志 REST 路径（契约见 docs/Easy-Points-API.md 11.4；日志永久留存，无删改接口） */
export const LogApi = {
  List: "/admin/operation-logs",
} as const

export function logsPaged(params: LogQuery): Promise<Paged<OperationLog>> {
  return get<Paged<OperationLog>>(LogApi.List, { ...params })
}
