/**
 * task 域 mock：任务管理与任务审核后端接口尚未开发，前端 mock 先行。
 * 数据结构与状态机即后端实现目标（契约见 docs/admin-web-api-requirements.md 3.5）。
 */
import type { EmployeeTask, Task, TaskPayload, TaskRecordQuery, TaskRecordReviewPayload } from "../api/task/types"

const DAY = 24 * 60 * 60 * 1000
const dateIn = (days: number) => new Date(Date.now() + days * DAY).toISOString().slice(0, 10)
const at = (daysAgo: number) => new Date(Date.now() - daysAgo * DAY).toISOString()

let MOCK_TASKS: Task[] = [
  { id: 1, name: "整理客户回访文档", description: "汇总本月客户回访录音与纪要，按客户归档", rewardPoints: 50, deadline: dateIn(7), requirement: "上传归档截图及文档清单", status: "published", createdAt: at(6), updatedAt: at(6) },
  { id: 2, name: "新员工入职引导协助", description: "协助 10 月入职的新同事完成环境配置与制度学习", rewardPoints: 80, deadline: dateIn(14), requirement: "新员工确认签字截图", status: "published", createdAt: at(5), updatedAt: at(5) },
  { id: 3, name: "会议室文化墙布置", description: "更换会议室文化墙内容物料", rewardPoints: 30, deadline: dateIn(-1), requirement: "布置前后对比照片", status: "unpublished", createdAt: at(20), updatedAt: at(10) }
]

let MOCK_TASK_RECORDS: EmployeeTask[] = [
  {
    id: 1, taskId: 1, taskName: "整理客户回访文档", rewardPoints: 50, employeeId: 1, employeeName: "张三",
    status: "pending_review",
    submissionText: "已完成 12 份回访纪要归档，附文档清单及系统录入截图",
    submissionImages: ["https://picsum.photos/seed/task1a/480/360", "https://picsum.photos/seed/task1b/480/360"],
    submittedAt: at(1), createdAt: at(4), updatedAt: at(1)
  },
  {
    id: 2, taskId: 1, taskName: "整理客户回访文档", rewardPoints: 50, employeeId: 2, employeeName: "李四",
    status: "approved", submissionText: "完成 8 份纪要归档",
    submissionImages: ["https://picsum.photos/seed/task2a/480/360"],
    submittedAt: at(3), reviewedAt: at(2), reviewRemark: "归档规范，予以通过", createdAt: at(5), updatedAt: at(2)
  },
  {
    id: 3, taskId: 2, taskName: "新员工入职引导协助", rewardPoints: 80, employeeId: 3, employeeName: "王五",
    status: "in_progress", createdAt: at(2), updatedAt: at(2)
  },
  {
    id: 4, taskId: 2, taskName: "新员工入职引导协助", rewardPoints: 80, employeeId: 4, employeeName: "赵六",
    status: "pending_review",
    submissionText: "已协助 2 名新员工完成配置，附确认签字照片",
    submissionImages: ["https://picsum.photos/seed/task4a/480/360"],
    submittedAt: at(0.5), createdAt: at(3), updatedAt: at(0.5)
  },
  {
    id: 5, taskId: 3, taskName: "会议室文化墙布置", rewardPoints: 30, employeeId: 1, employeeName: "张三",
    status: "rejected", submissionText: "布置照片一张",
    submissionImages: ["https://picsum.photos/seed/task5a/480/360"],
    submittedAt: at(9), reviewedAt: at(8), reviewRemark: "照片不清晰且缺少对比图，请重新提交", createdAt: at(15), updatedAt: at(8)
  }
]

const paginate = <T>(items: T[], page = 1, pageSize = 50) => ({
  data: items.slice((page - 1) * pageSize, page * pageSize),
  meta: { total: items.length, page, pageSize }
})

export function mockTasksPaged(params: { page?: number; pageSize?: number } = {}) {
  const items = MOCK_TASKS.slice().sort((a, b) => b.id - a.id).map((item) => ({ ...item }))
  return Promise.resolve(paginate(items, Number(params.page || 1), Number(params.pageSize || 50)))
}

export function mockCreateTask(payload: TaskPayload): Promise<Task> {
  const task: Task = {
    id: Math.max(0, ...MOCK_TASKS.map((item) => item.id)) + 1,
    ...payload,
    status: "unpublished",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
  MOCK_TASKS.push(task)
  return Promise.resolve({ ...task })
}

export function mockUpdateTask(id: number | string, payload: TaskPayload): Promise<Task> {
  const task = MOCK_TASKS.find((item) => item.id === Number(id))
  if (!task) return Promise.reject(new Error("任务不存在"))
  Object.assign(task, payload, { updatedAt: new Date().toISOString() })
  return Promise.resolve({ ...task })
}

export function mockSetTaskStatus(id: number | string, status: "published" | "unpublished"): Promise<unknown> {
  const task = MOCK_TASKS.find((item) => item.id === Number(id))
  if (!task) return Promise.reject(new Error("任务不存在"))
  task.status = status
  task.updatedAt = new Date().toISOString()
  return Promise.resolve(null)
}

/** 删除任务：员工领取记录保留（历史不删） */
export function mockDeleteTask(id: number | string): Promise<unknown> {
  MOCK_TASKS = MOCK_TASKS.filter((item) => item.id !== Number(id))
  return Promise.resolve(null)
}

export function mockTaskRecordsPaged(params: TaskRecordQuery = {}) {
  // 排序契约：待审核置顶，同状态按提交时间倒序（见接口清单《通用约定》）
  const pendingPriority = (status: string) => (status === "pending_review" ? 0 : 1)
  let items = MOCK_TASK_RECORDS.slice()
    .sort((a, b) => pendingPriority(a.status) - pendingPriority(b.status) || b.id - a.id)
    .map((item) => ({ ...item }))
  if (params.status) items = items.filter((item) => item.status === params.status)
  if (params.taskId) items = items.filter((item) => String(item.taskId) === String(params.taskId))
  if (params.employeeId) items = items.filter((item) => String(item.employeeId) === String(params.employeeId))
  return Promise.resolve(paginate(items, Number(params.page || 1), Number(params.pageSize || 50)))
}

export async function mockReviewTaskRecord(id: number | string, payload: TaskRecordReviewPayload): Promise<unknown> {
  const record = MOCK_TASK_RECORDS.find((item) => item.id === Number(id))
  if (!record) throw new Error("任务记录不存在")
  if (record.status !== "pending_review") throw new Error("该成果不在待审核状态，不可审核")
  record.status = payload.status
  record.reviewRemark = payload.remark
  record.reviewedAt = new Date().toISOString()
  record.updatedAt = record.reviewedAt
  return Promise.resolve(null)
}
