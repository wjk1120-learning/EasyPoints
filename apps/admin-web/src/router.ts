import { createRouter, createWebHistory } from "vue-router";
import type { RouteRecordRaw } from "vue-router";
import Dashboard from "./views/Dashboard.vue";
import EmployeePoints from "./views/EmployeePoints.vue";
import Points from "./views/Points.vue";
import ReviewCenter from "./views/ReviewCenter.vue";
import TaskManage from "./views/TaskManage.vue";
import VoteManage from "./views/VoteManage.vue";
import RuleConfig from "./views/RuleConfig.vue";
import Mall from "./views/Mall.vue";
import Reports from "./views/Reports.vue";
import Logs from "./views/Logs.vue";

const routes: RouteRecordRaw[] = [
  { path: "/", component: Dashboard, meta: { title: "工作台" } },
  { path: "/employee-points", component: EmployeePoints, meta: { title: "员工积分" } },
  { path: "/points", component: Points, meta: { title: "积分录入" } },
  { path: "/review-center", component: ReviewCenter, meta: { title: "审核中心" } },
  { path: "/tasks", component: TaskManage, meta: { title: "任务管理" } },
  { path: "/votes", component: VoteManage, meta: { title: "投票管理" } },
  { path: "/rules", component: RuleConfig, meta: { title: "规则配置" } },
  { path: "/mall", component: Mall, meta: { title: "商城礼品" } },
  { path: "/reports", component: Reports, meta: { title: "数据导出" } },
  { path: "/logs", component: Logs, meta: { title: "操作日志" } },
  // 旧入口收敛：三类独立审核页并入审核中心对应 Tab（PRD 5.2）
  { path: "/orders", redirect: "/review-center?tab=exchange" },
  { path: "/appeals", redirect: "/review-center?tab=appeal" },
  { path: "/applications", redirect: "/review-center?tab=application" }
];

export default createRouter({
  history: createWebHistory(),
  routes
});
