import type { Paged } from "../types"
import type {
  EmployeeTask,
  Task,
  TaskPayload,
  TaskRecordQuery,
  TaskRecordReviewPayload,
} from "./types"
import { download, get, post, put } from "../../utils/request"

/** 任务管理 REST 路径（契约见 docs/Easy-Points-API.md 5.5~5.9） */
export const TaskApi = {
  List: "/admin/tasks",
  Task: (id: number | string) => `/admin/tasks/${id}`,
  Publish: (id: number | string) => `/admin/tasks/${id}/publish`,
  Unpublish: (id: number | string) => `/admin/tasks/${id}/unpublish`,
} as const

/** 员工任务记录 REST 路径（契约见 docs/Easy-Points-API.md 5.10/5.11/11.8） */
export const TaskRecordApi = {
  List: "/admin/task-records",
  Review: (id: number | string) => `/admin/task-records/${id}/review`,
  RecordsXlsx: "/admin/task-records.xlsx",
} as const

export type { Task, TaskPayload, EmployeeTask, TaskRecordQuery, TaskRecordReviewPayload } from "./types"

/** 分页任务列表（5.5：创建倒序；status 传 published/unpublished，缺省过滤已删除） */
export function tasksPaged(params: { page?: number; pageSize?: number; status?: string } = {}): Promise<Paged<Task>> {
  return get<Paged<Task>>(TaskApi.List, { ...params })
}

/** 新增任务（5.6：默认已下架，需手动上架） */
export function createTask(payload: TaskPayload): Promise<Task> {
  return post<Task>(TaskApi.List, payload)
}

/** 编辑任务（5.7） */
export function updateTask(id: number | string, payload: TaskPayload): Promise<Task> {
  return put<Task>(TaskApi.Task(id), payload)
}

/** 上架（5.8）：员工端任务大厅可见 */
export function publishTask(id: number | string): Promise<Task> {
  return post<Task>(TaskApi.Publish(id))
}

/** 下架（5.8）：用户端隐藏，进行中记录保留 */
export function unpublishTask(id: number | string): Promise<Task> {
  return post<Task>(TaskApi.Unpublish(id))
}

/** 删除任务（5.9：软删除，员工领取记录保留；页面二次确认） */
export function deleteTask(id: number | string): Promise<Task> {
  return post<Task>(`${TaskApi.Task(id)}/delete`)
}

/** 分页员工任务记录（5.10：待审核置顶；审核中心任务 Tab / 任务管理进度抽屉共用） */
export function taskRecordsPaged(params: TaskRecordQuery): Promise<Paged<EmployeeTask>> {
  return get<Paged<EmployeeTask>>(TaskRecordApi.List, { ...params })
}

/** 审核任务成果（5.11：通过→奖励积分双积分入账；驳回 remark 必填，驳回后员工可申诉） */
export function reviewTaskRecord(id: number | string, payload: TaskRecordReviewPayload): Promise<unknown> {
  return post<unknown>(TaskRecordApi.Review(id), payload)
}

/** 导出任务审核记录表 Excel（11.8：领取人/状态/任务名称/任务成果；文件名由前端拼接） */
export function exportTaskRecordsXlsx(params: TaskRecordQuery = {}): Promise<Blob> {
  return download(TaskRecordApi.RecordsXlsx, { ...params })
}
