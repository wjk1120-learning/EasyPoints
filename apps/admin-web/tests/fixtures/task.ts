/**
 * task 域测试 fixture：字段与时间格式严格按 docs/Easy-Points-API.md 5.5/5.10 结构。
 */

export const TASKS_FIXTURE = [
  {
    id: 3,
    name: "整理客户回访文档",
    description: "汇总本季度客户回访记录",
    rewardPoints: 100,
    requirement: "输出文档并发送至部门邮箱",
    deadline: "2026-10-31",
    status: "published",
    createdBy: 1,
    createdAt: "2026-10-01 09:00:00",
    updatedAt: "2026-10-02 09:00:00",
  },
  {
    id: 4,
    name: "官网内容校对（已下架）",
    description: "校对官网新版本文案",
    rewardPoints: 50,
    requirement: "标记错别字并截图",
    deadline: "2026-09-30",
    status: "unpublished",
    createdBy: 1,
    createdAt: "2026-09-01 09:00:00",
    updatedAt: "2026-09-20 09:00:00",
  },
] as const

export const TASK_RECORDS_FIXTURE = [
  {
    id: 88,
    taskId: 3,
    taskName: "整理客户回访文档",
    rewardPoints: 100,
    employeeId: 1,
    employeeName: "张三",
    status: "pending_review",
    submissionText: "文档已发送至部门邮箱，见附件截图",
    submissionImages: ["/uploads/ev/task-88-1.png"],
    submittedAt: "2026-10-09 15:30:00",
    reviewRemark: null,
    reviewerId: null,
    reviewedAt: null,
    createdAt: "2026-10-05 10:00:00",
    updatedAt: "2026-10-09 15:30:00",
  },
  {
    id: 87,
    taskId: 3,
    taskName: "整理客户回访文档",
    rewardPoints: 100,
    employeeId: 2,
    employeeName: "李四",
    status: "rejected",
    submissionText: "初步整理稿",
    submissionImages: [],
    submittedAt: "2026-10-06 11:00:00",
    reviewRemark: "缺少回访记录明细，请补充后重新提交",
    reviewerId: 1,
    reviewedAt: "2026-10-07 09:30:00",
    createdAt: "2026-10-05 09:00:00",
    updatedAt: "2026-10-07 09:30:00",
  },
] as const
