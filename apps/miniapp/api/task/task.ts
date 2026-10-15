import type { Task } from "./types"
import { request } from "../../utils/request"

/** 任务 REST 路径（契约见 docs/Easy-Points-API.md 5.1~5.2b；claim 返回任务行，submit 按任务 ID 定位本人领取记录） */
export const TaskApi = {
  List: "/miniapp/tasks",
  Claim: (id: number | string) => `/miniapp/tasks/${id}/claim`,
  Submit: (id: number | string) => `/miniapp/tasks/${id}/submit`,
} as const

export type { Task } from "./types"

/** 任务大厅（5.1：scope=all 全部可领取 / mine 我领取提交过的；现状按数组解析——第 3 阶段切 PageResult） */
export function fetchTasks(scope: "all" | "mine"): Promise<Task[]> {
  return request<Task[]>(`${TaskApi.List}?scope=${scope}`)
}

/** 领取任务（5.2：open → in_progress；一人一任务仅可领取一次） */
export function claimTask(id: number | string): Promise<Task> {
  return request<Task>(TaskApi.Claim(id), { method: "POST" })
}

/** 按任务 ID 提交成果（5.2b：{ content } 必填非空；佐证图 evidenceImages 第 3 阶段随上传接入） */
export function submitTask(id: number | string, content: string): Promise<Task> {
  return request<Task>(TaskApi.Submit(id), { method: "POST", data: { content } })
}
