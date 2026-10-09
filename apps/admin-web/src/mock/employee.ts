/** employee 域 mock：双积分字段未落地前的演示数据（VITE_USE_MOCK=1 或 localStorage.adminMock=1 时启用） */
import type { Employee } from "../api/employee/types"

const MOCK_EMPLOYEES: Employee[] = [
  { id: 1, name: "张三", departmentId: 1, departmentName: "研发部", wecomUserId: "wecom_1001", pointsBalance: 1189, availablePoints: 1189, cumulativePoints: 2380, status: "active" },
  { id: 2, name: "李四", departmentId: 1, departmentName: "研发部", wecomUserId: "wecom_1002", pointsBalance: 860, availablePoints: 860, cumulativePoints: 1640, status: "active" },
  { id: 3, name: "王五", departmentId: 2, departmentName: "市场部", wecomUserId: "wecom_1003", pointsBalance: 1520, availablePoints: 1520, cumulativePoints: 2980, status: "active" },
  { id: 4, name: "赵六", departmentId: 2, departmentName: "市场部", wecomUserId: "wecom_1004", pointsBalance: 430, availablePoints: 430, cumulativePoints: 1120, status: "active" },
  { id: 5, name: "钱七", departmentId: 3, departmentName: "人事部", wecomUserId: "wecom_1005", pointsBalance: 2100, availablePoints: 2100, cumulativePoints: 3600, status: "active" },
  { id: 6, name: "孙八", departmentId: 3, departmentName: "人事部", wecomUserId: "wecom_1006", pointsBalance: 0, availablePoints: 0, cumulativePoints: 260, status: "inactive" }
]

export function mockEmployees(): Promise<Employee[]> {
  return Promise.resolve(MOCK_EMPLOYEES.map((item) => ({ ...item })))
}
