import type { Paged } from "../types"
import type {
  EmployeeTask,
  Task,
  TaskPayload,
  TaskRecordQuery,
  TaskRecordReviewPayload,
} from "./types"
import { get, post, put } from "../../utils/request"
import { withMock } from "../../mock"
import {
  mockCreateTask,
  mockDeleteTask,
  mockReviewTaskRecord,
  mockSetTaskStatus,
  mockTaskRecordsPaged,
  mockTasksPaged,
  mockUpdateTask,
} from "../../mock/task"

/** 任务管理 REST 路径（后端待开发，契约见 docs/admin-web-api-requirements.md 3.5） */
export const TaskApi = {
  List: "/admin/tasks",
  Task: (id: number | string) => `/admin/tasks/${id}`,
  Publish: (id: number | string) => `/admin/tasks/${id}/publish`,
  Unpublish: (id: number | string) => `/admin/tasks/${id}/unpublish`,
} as const

/** 员工任务记录 REST 路径 */
export const TaskRecordApi = {
  List: "/admin/task-records",
  Review: (id: number | string) => `/admin/task-records/${id}/review`,
} as const

export type { Task, TaskPayload, EmployeeTask, TaskRecordQuery, TaskRecordReviewPayload } from "./types"

/** 分页任务列表（当前 mock 先行，后端就绪后自动切换真实接口） */
export function tasksPaged(params: { page?: number; pageSize?: number } = {}): Promise<Paged<Task>> {
  return withMock(
    () => get<Paged<Task>>(TaskApi.List, { ...params }),
    () => mockTasksPaged(params),
  )
}

/** 新增任务：默认已下架，需手动上架 */
export function createTask(payload: TaskPayload): Promise<Task> {
  return withMock(
    () => post<Task>(TaskApi.List, payload),
    () => mockCreateTask(payload),
  )
}

export function updateTask(id: number | string, payload: TaskPayload): Promise<Task> {
  return withMock(
    () => put<Task>(TaskApi.Task(id), payload),
    () => mockUpdateTask(id, payload),
  )
}

/** 上架/下架：下架对用户端隐藏，进行中记录保留 */
export function publishTask(id: number | string): Promise<unknown> {
  return withMock(
    () => post<unknown>(TaskApi.Publish(id)),
    () => mockSetTaskStatus(id, "published"),
  )
}

export function unpublishTask(id: number | string): Promise<unknown> {
  return withMock(
    () => post<unknown>(TaskApi.Unpublish(id)),
    () => mockSetTaskStatus(id, "unpublished"),
  )
}

/** 删除任务（员工领取记录保留） */
export function deleteTask(id: number | string): Promise<unknown> {
  return withMock(
    () => post<unknown>(`${TaskApi.Task(id)}/delete`),
    () => mockDeleteTask(id),
  )
}

/** 分页员工任务记录（审核中心任务 Tab / 任务管理进度抽屉共用） */
export function taskRecordsPaged(params: TaskRecordQuery): Promise<Paged<EmployeeTask>> {
  return withMock(
    () => get<Paged<EmployeeTask>>(TaskRecordApi.List, { ...params }),
    () => mockTaskRecordsPaged(params),
  )
}

/** 审核任务成果：通过→奖励积分双积分到账（后端职责）；驳回 remark 必填 */
export function reviewTaskRecord(id: number | string, payload: TaskRecordReviewPayload): Promise<unknown> {
  return withMock(
    () => post<unknown>(TaskRecordApi.Review(id), payload),
    () => mockReviewTaskRecord(id, payload),
  )
}
