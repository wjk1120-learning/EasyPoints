const departments = [
  { id: 1, name: "人事部", parentId: null },
  { id: 2, name: "研发部", parentId: null }
];

const employees = [
  {
    id: 1,
    name: "张三",
    departmentId: 2,
    wecomUserId: "zhangsan",
    pointsBalance: 1200,
    status: "active"
  },
  {
    id: 2,
    name: "李四",
    departmentId: 1,
    wecomUserId: "lisi",
    pointsBalance: 800,
    status: "active"
  }
];

const admins = [
  {
    id: 1,
    username: "admin",
    password: "admin123",
    name: "系统管理员",
    role: "super_admin",
    departmentIds: [1, 2]
  },
  {
    id: 2,
    username: "rd_manager",
    password: "admin123",
    name: "研发部门管理员",
    role: "department_admin",
    departmentIds: [2]
  }
];

const gifts = [
  {
    id: 1,
    name: "京东购物卡 100 元",
    pointsCost: 1000,
    stock: 20,
    status: "active",
    limitPerUser: 2
  },
  {
    id: 2,
    name: "带薪休假半天",
    pointsCost: 1500,
    stock: 10,
    status: "active",
    limitPerUser: 1
  }
];

module.exports = { departments, employees, admins, gifts };
