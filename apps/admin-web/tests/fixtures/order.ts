/**
 * order 域测试 fixture：字段与时间格式严格按 docs/Easy-Points-API.md 4.10（示例形态 + employeeName join）。
 */

export const ORDERS_FIXTURE = [
  {
    id: 5001,
    employeeId: 1,
    employeeName: "张三",
    giftId: 1,
    giftName: "京东购物卡 100 元",
    pointsCost: 1000,
    status: "pending_review",
    remark: null,
    createdAt: "2026-10-10 09:00:00",
    updatedAt: "2026-10-10 09:00:00",
  },
  {
    id: 5002,
    employeeId: 2,
    employeeName: "李四",
    giftId: 2,
    giftName: "保温杯",
    pointsCost: 300,
    status: "approved",
    remark: "审核通过",
    createdAt: "2026-10-09 10:00:00",
    updatedAt: "2026-10-09 11:00:00",
  },
  {
    id: 5003,
    employeeId: 3,
    employeeName: "王五",
    giftId: 1,
    giftName: "京东购物卡 100 元",
    pointsCost: 1000,
    status: "rejected",
    remark: "礼品缺货",
    createdAt: "2026-10-08 10:00:00",
    updatedAt: "2026-10-08 12:00:00",
  },
] as const
