/**
 * employee 域测试 fixture：字段与时间格式严格按 docs/Easy-Points-API.md 11.1 Employee 结构。
 * 故意乱序（王五积分最高排前在数据里第 1，张三第 2）供排序断言；含 inactive 员工。
 */

export const EMPLOYEES_FIXTURE = [
  { id: 2, wecomUserId: "wecom_1002", name: "李四", departmentId: 1, departmentName: "研发部", pointsBalance: 860, availablePoints: 860, cumulativePoints: 1640, status: "active", createdAt: "2026-09-01 09:00:00" },
  { id: 1, wecomUserId: "wecom_1001", name: "张三", departmentId: 1, departmentName: "研发部", pointsBalance: 1189, availablePoints: 1189, cumulativePoints: 2380, status: "active", createdAt: "2026-09-01 09:00:00" },
  { id: 3, wecomUserId: "wecom_1003", name: "王五", departmentId: 2, departmentName: "市场部", pointsBalance: 1520, availablePoints: 1520, cumulativePoints: 2980, status: "active", createdAt: "2026-09-02 10:00:00" },
  { id: 4, wecomUserId: "wecom_1004", name: "赵六", departmentId: 2, departmentName: "市场部", pointsBalance: 430, availablePoints: 430, cumulativePoints: 1120, status: "active", createdAt: "2026-09-02 10:00:00" },
  { id: 6, wecomUserId: "wecom_1006", name: "孙八", departmentId: 3, departmentName: "人事部", pointsBalance: 0, availablePoints: 0, cumulativePoints: 260, status: "inactive", createdAt: "2026-09-03 11:00:00" },
] as const
