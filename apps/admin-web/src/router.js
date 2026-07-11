import { createRouter, createWebHistory } from "vue-router";
import Dashboard from "./views/Dashboard.vue";
import EmployeePoints from "./views/EmployeePoints.vue";
import Points from "./views/Points.vue";
import Reports from "./views/Reports.vue";
import Appeals from "./views/Appeals.vue";
import Mall from "./views/Mall.vue";
import Orders from "./views/Orders.vue";
import Logs from "./views/Logs.vue";

export default createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", component: Dashboard, meta: { title: "工作台" } },
    { path: "/employee-points", component: EmployeePoints, meta: { title: "员工积分" } },
    { path: "/points", component: Points, meta: { title: "积分管理" } },
    { path: "/reports", component: Reports, meta: { title: "报表管理" } },
    { path: "/appeals", component: Appeals, meta: { title: "申诉管理" } },
    { path: "/mall", component: Mall, meta: { title: "商城管理" } },
    { path: "/orders", component: Orders, meta: { title: "订单管理" } },
    { path: "/logs", component: Logs, meta: { title: "日志管理" } }
  ]
});
