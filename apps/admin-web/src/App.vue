<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import { useRoute } from "vue-router";
import { api } from "./api";

const form = reactive({ username: "admin", password: "admin123" });
const loading = ref(false);
const token = ref(localStorage.getItem("token") || "");
const admin = ref(loadAdmin());
const isAuthed = computed(() => Boolean(token.value));
const route = useRoute();
const activeMenu = computed(() => route.path);
const badges = reactive({ appeals: 0, orders: 0 });
const dashboardBadge = computed(() => Number(badges.appeals || 0) + Number(badges.orders || 0));
let badgeTimer = null;

function loadAdmin() {
  try {
    const raw = localStorage.getItem("admin");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function formatRole(role) {
  const value = String(role || "");
  if (value === "super_admin") return "超级管理员";
  if (value === "hr_admin") return "人事管理员";
  if (value === "department_admin") return "部门管理员";
  return value || "管理员";
}

function parseJwtPayload(value) {
  try {
    const parts = String(value || "").split(".");
    if (parts.length !== 3) return null;
    const payloadJson = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(payloadJson);
  } catch {
    return null;
  }
}

function isJwtExpired(value) {
  const payload = parseJwtPayload(value);
  if (!payload?.exp) return false;
  return Date.now() >= Number(payload.exp) * 1000;
}

async function submitLogin() {
  loading.value = true;
  try {
    const result = await api.login(form);
    localStorage.setItem("token", result.token);
    localStorage.setItem("adminId", String(result.admin.id));
    localStorage.setItem("admin", JSON.stringify(result.admin));
    token.value = result.token;
    admin.value = result.admin;
    ElMessage.success("登录成功");
  } catch (error) {
    ElMessage.error(error?.message || "登录失败");
  } finally {
    loading.value = false;
  }
}

function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("adminId");
  localStorage.removeItem("admin");
  token.value = "";
  admin.value = null;
}

function handleLogoutEvent(event) {
  token.value = localStorage.getItem("token") || "";
  admin.value = loadAdmin();
  if (!token.value) {
    if (event?.detail?.reason === "expired") ElMessage.warning("登录已过期，请重新登录");
    else if (event?.detail?.reason === "unauthorized") ElMessage.warning("登录已失效，请重新登录");
  }
}

async function refreshBadges() {
  if (!token.value) return;
  try {
    const result = await api.badges();
    badges.appeals = Number(result.appealsUnread || 0);
    badges.orders = Number(result.ordersUnread || 0);
  } catch {
    badges.appeals = 0;
    badges.orders = 0;
  }
}

function handleBadgeRefreshEvent() {
  refreshBadges();
}

onMounted(() => {
  if (token.value && isJwtExpired(token.value)) {
    logout();
    ElMessage.warning("登录已过期，请重新登录");
  }
  window.addEventListener("auth:logout", handleLogoutEvent);
  window.addEventListener("badges:refresh", handleBadgeRefreshEvent);
});

onBeforeUnmount(() => {
  window.removeEventListener("auth:logout", handleLogoutEvent);
  window.removeEventListener("badges:refresh", handleBadgeRefreshEvent);
  if (badgeTimer) {
    clearInterval(badgeTimer);
    badgeTimer = null;
  }
});

watch(
  isAuthed,
  (value) => {
    if (!value) {
      badges.appeals = 0;
      badges.orders = 0;
      if (badgeTimer) {
        clearInterval(badgeTimer);
        badgeTimer = null;
      }
      return;
    }
    refreshBadges();
    if (badgeTimer) clearInterval(badgeTimer);
    badgeTimer = setInterval(refreshBadges, 15000);
  },
  { immediate: true }
);

watch(
  () => route.path,
  () => {
    if (!isAuthed.value) return;
    refreshBadges();
  }
);
</script>

<template>
  <div v-if="!isAuthed" class="login-shell">
    <el-card class="login-card">
      <template #header>管理员登录</template>
      <el-form :model="form" label-width="80px">
        <el-form-item label="账号">
          <el-input v-model="form.username" autocomplete="username" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="form.password" type="password" autocomplete="current-password" show-password />
        </el-form-item>
        <el-button type="primary" :loading="loading" @click="submitLogin">登录</el-button>
      </el-form>
      <div style="margin-top: 10px; color: var(--el-text-color-secondary); font-size: 12px">
        默认账号：admin / admin123
      </div>
    </el-card>
  </div>

  <el-container v-else class="shell">
    <el-aside width="232px" class="sidebar">
      <div class="brand">
        <strong>易积分</strong>
        <span>企业微信积分管理</span>
      </div>
      <el-menu router :default-active="activeMenu">
        <el-menu-item index="/">
          <el-badge :value="dashboardBadge" :hidden="!dashboardBadge" :max="99">
            <span>工作台</span>
          </el-badge>
        </el-menu-item>
        <el-menu-item index="/employee-points">员工积分</el-menu-item>
        <el-menu-item index="/points">积分录入</el-menu-item>
        <el-menu-item index="/reports">明细报表</el-menu-item>
        <el-menu-item index="/appeals">
          <el-badge :value="badges.appeals" :hidden="!badges.appeals" :max="99">
            <span>申诉审核</span>
          </el-badge>
        </el-menu-item>
        <el-menu-item index="/mall">商城礼品</el-menu-item>
        <el-menu-item index="/orders">
          <el-badge :value="badges.orders" :hidden="!badges.orders" :max="99">
            <span>订单核销</span>
          </el-badge>
        </el-menu-item>
        <el-menu-item index="/logs">操作日志</el-menu-item>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header class="topbar">
        <div>
          <strong>PC 管理后台</strong>
          <span>备注必填、流水留痕、导出可追溯</span>
        </div>
        <div>
          <el-tag v-if="admin" style="margin-right: 10px">{{ admin.name }} · {{ formatRole(admin.role) }}</el-tag>
          <el-button size="small" @click="logout">退出</el-button>
          <el-tag type="success" style="margin-left: 10px">生产版骨架</el-tag>
        </div>
      </el-header>
      <el-main>
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>
