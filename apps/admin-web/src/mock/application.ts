/**
 * application 域 mock：积分申请模块后端接口尚未开发，前端 mock 先行（契约见 types.ts 与接口需求清单 3.3）。
 * 后端就绪后，application.ts 中把 withMock 的 real 路径接上即可，mock 数据结构即后端实现目标。
 */
import type { Application, ApplicationQuery, ApplicationReviewPayload } from "../api/application/types"

const now = Date.now()
const DAY = 24 * 60 * 60 * 1000

let MOCK_APPLICATIONS: Application[] = [
  {
    id: 1,
    employeeId: 1,
    employeeName: "张三",
    points: 200,
    reason: "主导完成客户管理系统的紧急交付，连续两周加班攻坚，客户书面表扬",
    evidenceImages: ["https://picsum.photos/seed/app1a/480/360", "https://picsum.photos/seed/app1b/480/360"],
    status: "pending_review",
    createdAt: new Date(now - 1 * DAY).toISOString(),
    updatedAt: new Date(now - 1 * DAY).toISOString()
  },
  {
    id: 2,
    employeeId: 3,
    employeeName: "王五",
    points: 150,
    reason: "代表公司参加行业展会并促成两个意向客户，市场部推荐申报",
    evidenceImages: ["https://picsum.photos/seed/app2a/480/360"],
    status: "pending_review",
    createdAt: new Date(now - 2 * DAY).toISOString(),
    updatedAt: new Date(now - 2 * DAY).toISOString()
  },
  {
    id: 3,
    employeeId: 2,
    employeeName: "李四",
    points: 100,
    reason: "内部知识库建设贡献 30+ 篇技术文档，被多个团队引用",
    evidenceImages: [],
    status: "approved",
    reviewRemark: "材料充分，同意加分",
    reviewedBy: "系统管理员",
    createdAt: new Date(now - 4 * DAY).toISOString(),
    updatedAt: new Date(now - 3 * DAY).toISOString()
  },
  {
    id: 4,
    employeeId: 4,
    employeeName: "赵六",
    points: 500,
    reason: "希望申报本月优秀员工奖励",
    evidenceImages: [],
    status: "rejected",
    reviewRemark: "分值超出常规贡献上限，请按流程走月度评优申报",
    reviewedBy: "系统管理员",
    createdAt: new Date(now - 5 * DAY).toISOString(),
    updatedAt: new Date(now - 4 * DAY).toISOString()
  }
]

export function mockApplicationsPaged(params: ApplicationQuery): Promise<{ data: Application[]; meta: { total: number; page: number; pageSize: number } }> {
  const page = Number(params.page || 1)
  const pageSize = Number(params.pageSize || 50)
  // 排序契约：待审核置顶，同状态按申请时间倒序（见接口清单《通用约定》）
  const pendingPriority = (status: string) => (status === "pending_review" ? 0 : 1)
  let items = MOCK_APPLICATIONS.slice().sort((a, b) => pendingPriority(a.status) - pendingPriority(b.status) || b.id - a.id)
  if (params.status) items = items.filter((item) => item.status === params.status)
  if (params.employeeId) {
    items = items.filter((item) => String(item.employeeId) === String(params.employeeId))
  }
  const total = items.length
  const data = items.slice((page - 1) * pageSize, page * pageSize).map((item) => ({ ...item }))
  return Promise.resolve({ data, meta: { total, page, pageSize } })
}

export async function mockReviewApplication(id: number | string, payload: ApplicationReviewPayload): Promise<unknown> {
  const target = MOCK_APPLICATIONS.find((item) => item.id === Number(id))
  if (!target) throw new Error("申请不存在")
  if (target.status !== "pending_review") throw new Error("该申请已处理，不可重复审核")
  target.status = payload.status
  target.reviewRemark = payload.remark
  target.reviewedBy = "当前管理员"
  target.updatedAt = new Date().toISOString()
  return Promise.resolve(null)
}
