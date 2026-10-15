import type { Paged } from "../types"
import type { Task, TaskClaim } from "./types"
import { request, requestPaged } from "../../utils/request"

/** 任务 REST 路径（契约见 docs/Easy-Points-API.md 5.1~5.4；claim 返回任务行，submit 按任务 ID 定位本人领取记录） */
export const TaskApi = {
  List: "/miniapp/tasks",
  Claim: (id: number | string) => `/miniapp/tasks/${id}/claim`,
  Submit: (id: number | string) => `/miniapp/tasks/${id}/submit`,
  Claims: "/miniapp/task-claims",
} as const

export type { Task, TaskClaim } from "./types"

/** 任务大厅（5.1：PageResult；status 为个人视角状态，截止临近在前、长期有效排最后） */
export function fetchTasks(
  scope: "all" | "mine",
  params: { page?: number; pageSize?: number } = {}
): Promise<Paged<Task>> {
  return requestPaged<Task>(TaskApi.List, { scope, ...params })
}

/** 领取任务（5.2：open → in_progress；一人一任务仅可领取一次） */
export function claimTask(id: number | string): Promise<Task> {
  return request<Task>(TaskApi.Claim(id), { method: "POST" })
}

/** 按任务 ID 提交成果（5.2b：content 必填非空；evidenceImages 佐证图 url ≤9 张，先过 11.9 上传接口） */
export function submitTask(id: number | string, content: string, evidenceImages?: string[]): Promise<Task> {
  return request<Task>(TaskApi.Submit(id), {
    method: "POST",
    data: { content, ...(evidenceImages?.length ? { evidenceImages } : {}) }
  })
}

/** 我的领取记录（5.3：PageResult；id 为领取记录主键=申诉 task_claim 的 targetId） */
export function fetchTaskClaims(
  status?: string,
  params: { page?: number; pageSize?: number } = {}
): Promise<Paged<TaskClaim>> {
  return requestPaged<TaskClaim>(TaskApi.Claims, { status, ...params })
}
