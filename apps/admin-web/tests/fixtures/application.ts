/**
 * application 域测试 fixture：字段与时间格式严格按 docs/Easy-Points-API.md 6.3 响应示例。
 */

export const APPLICATIONS_FIXTURE = [
  {
    id: 31,
    employeeId: 1,
    employeeName: "张三",
    points: 50,
    reason: "完成跨部门支持",
    evidenceImages: ["/uploads/ev/2.png"],
    status: "pending_review",
    statusText: "待审核",
    reviewRemark: null,
    reviewerId: null,
    reviewedBy: null,
    reviewedAt: null,
    createdAt: "2026-10-10 09:00:00",
    updatedAt: "2026-10-10 09:00:00",
  },
  {
    id: 30,
    employeeId: 3,
    employeeName: "王五",
    points: 150,
    reason: "代表公司参加行业展会并促成两个意向客户",
    evidenceImages: [],
    status: "rejected",
    statusText: "已驳回",
    reviewRemark: "佐证不足",
    reviewerId: 1,
    reviewedBy: "系统管理员",
    reviewedAt: "2026-10-09 15:00:00",
    createdAt: "2026-10-09 10:00:00",
    updatedAt: "2026-10-09 15:00:00",
  },
] as const
