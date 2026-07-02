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
    { path: "/", component: Dashboard },
    { path: "/employee-points", component: EmployeePoints },
    { path: "/points", component: Points },
    { path: "/reports", component: Reports },
    { path: "/appeals", component: Appeals },
    { path: "/mall", component: Mall },
    { path: "/orders", component: Orders },
    { path: "/logs", component: Logs }
  ]
});
