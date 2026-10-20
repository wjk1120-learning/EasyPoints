/** L2 契约 fixtures：形状与示例值取自 docs/Easy-Points-API.md v4.3 各章节响应示例 */

/** 契约 1.4：员工登录成功（EmployeeLoginVo） */
export const LOGIN_SUCCESS = {
  code: 1,
  msg: "成功",
  data: {
    accessToken: "emp-token-1",
    refreshToken: "refresh-1",
    tokenType: "Bearer",
    expiresIn: 7200,
    employee: { id: 3, name: "卜来的精彩", wecomUserId: "BoLaiDeJingCai", departmentId: 2, status: "active" }
  }
} as const;

/** 契约 1.4：直登被拒（非 dev profile / 员工不存在，HTTP 401 + BaseResult） */
export const LOGIN_REJECTED = {
  code: 0,
  msg: "员工不存在",
  data: null
} as const;

/** 契约 2.1：我的积分明细（按月分组 Map<月份, PointRecord[]>，节选一行为文档示例） */
export const POINT_RECORDS = {
  code: 1,
  msg: "成功",
  data: {
    "2026-10": [
      {
        id: 101,
        employeeId: 1,
        departmentId: 2,
        pointsDelta: 50,
        cumulativePointsDelta: 50,
        type: "performance",
        sourceType: "task_reward",
        sourceId: "88",
        operatorId: 1,
        operatorName: "系统管理员",
        remark: "任务奖励：月度之星评选",
        reversalOfId: null,
        occurredAt: "2026-10-09 15:30:00",
        createdAt: "2026-10-09 15:30:01",
        month: "2026-10"
      }
    ]
  }
} as const;

/** 契约 5.1：任务大厅 PageResult{total,rows}（Task 行，节选两行） */
export const TASKS_PAGED = {
  code: 1,
  msg: "成功",
  data: {
    total: 2,
    rows: [
      {
        id: 7,
        name: "整理客户回访文档",
        title: "整理客户回访文档",
        description: "整理 3 家重点客户回访纪要",
        rewardPoints: 20,
        requirement: "输出纪要文档",
        deadline: "2026-10-17",
        status: "open",
        statusText: "可领取",
        claimedByMe: false,
        createdBy: 1,
        createdAt: "2026-10-09 10:00:00",
        updatedAt: "2026-10-09 10:00:00"
      },
      {
        id: 8,
        name: "知识库常见问题整理",
        title: "知识库常见问题整理",
        description: "整理本岗位常见问题 20 条",
        rewardPoints: 10,
        requirement: "录入知识库",
        deadline: null,
        status: "in_progress",
        statusText: "进行中",
        claimedByMe: true,
        createdBy: 1,
        createdAt: "2026-10-08 10:00:00",
        updatedAt: "2026-10-08 10:00:00"
      }
    ]
  }
} as const;

/** 契约 5.2b：业务错误（HTTP 400 + BaseResult，msg 为前端可展示原文） */
export const SUBMIT_EMPTY_CONTENT = {
  code: 0,
  msg: "成果说明不能为空",
  data: null
} as const;
