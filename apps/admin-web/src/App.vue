<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import { Menu, Star, EditPen, DataLine, Check, Present, Document, SwitchButton, Stamp, Management } from "@element-plus/icons-vue";
import { useRoute } from "vue-router";
import type { AdminInfo } from "./api/auth/types";
import { badges as fetchBadges, login } from "./api/auth/auth";

const form = reactive({ username: "admin", password: "admin123" });
const loading = ref(false);
const token = ref(localStorage.getItem("token") || "");
const admin = ref<AdminInfo | null>(loadAdmin());
const avatarUrl = ref('/images/avatar.png')
const isAuthed = computed(() => Boolean(token.value));
const route = useRoute();
const activeMenu = computed(() => route.path);
const badges = reactive({ appeals: 0, orders: 0 });
const dashboardBadge = computed(() => Number(badges.appeals || 0) + Number(badges.orders || 0));
let badgeTimer: ReturnType<typeof setInterval> | null = null;

function loadAdmin(): AdminInfo | null {
  try {
    const raw = localStorage.getItem("admin");
    return raw ? (JSON.parse(raw) as AdminInfo) : null;
  } catch {
    return null;
  }
}

function formatRole(role?: string) {
  const value = String(role || "");
  if (value === "super_admin") return "超级管理员";
  if (value === "hr_admin") return "人事管理员";
  if (value === "department_admin") return "部门管理员";
  return value || "管理员";
}

function parseJwtPayload(value: string): { exp?: number } | null {
  try {
    const parts = String(value || "").split(".");
    if (parts.length !== 3) return null;
    const payloadJson = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(payloadJson);
  } catch {
    return null;
  }
}

function isJwtExpired(value: string) {
  const payload = parseJwtPayload(value);
  if (!payload?.exp) return false;
  return Date.now() >= Number(payload.exp) * 1000;
}

async function submitLogin() {
  loading.value = true;
  try {
    const result = await login(form);
    localStorage.setItem("token", result.token);
    localStorage.setItem("adminId", String(result.admin.id));
    localStorage.setItem("admin", JSON.stringify(result.admin));
    token.value = result.token;
    admin.value = result.admin;
    ElMessage.success("登录成功");
  } catch (error) {
    ElMessage.error((error as Error)?.message || "登录失败");
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

function handleLogoutEvent(event: Event) {
  token.value = localStorage.getItem("token") || "";
  admin.value = loadAdmin();
  const detail = (event as CustomEvent<{ reason?: string }>).detail;
  if (!token.value) {
    if (detail?.reason === "expired") ElMessage.warning("登录已过期，请重新登录");
    else if (detail?.reason === "unauthorized") ElMessage.warning("登录已失效，请重新登录");
  }
}

async function refreshBadges() {
  if (!token.value) return;
  try {
    const result = await fetchBadges();
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
        <strong style="color: var(--color-text-primary);">易积分</strong>
        <span style="color: var(--color-text-secondary);">企业微信积分管理</span>
      </div>
      <el-menu router :default-active="activeMenu">
        <el-menu-item index="/">
          <el-icon><Menu /></el-icon>
          <el-badge :value="dashboardBadge" :hidden="!dashboardBadge" :max="99">
            <span>工作台</span>
          </el-badge>
        </el-menu-item>
        <el-menu-item index="/employee-points">
          <el-icon><Star /></el-icon>
          <span>员工积分</span>
        </el-menu-item>
        <el-menu-item index="/points">
          <el-icon><EditPen /></el-icon>
          <span>积分录入</span>
        </el-menu-item>
        <el-menu-item index="/review-center">
          <el-icon><Check /></el-icon>
          <el-badge :value="dashboardBadge" :hidden="!dashboardBadge" :max="99">
            <span>审核中心</span>
          </el-badge>
        </el-menu-item>
        <el-menu-item index="/tasks">
          <el-icon><Management /></el-icon>
          <span>任务管理</span>
        </el-menu-item>
        <el-menu-item index="/mall">
          <el-icon><Present /></el-icon>
          <span>商城礼品</span>
        </el-menu-item>
        <el-menu-item index="/reports">
          <el-icon><DataLine /></el-icon>
          <span>明细报表</span>
        </el-menu-item>
        <el-menu-item index="/logs">
          <el-icon><Document /></el-icon>
          <span>操作日志</span>
        </el-menu-item>
      </el-menu>
      <div class="sidebar-footer" @click="logout">
        <el-icon ><SwitchButton /></el-icon>
        <span style="margin-left: 10px;">退出</span>
      </div>
    </el-aside>

    <el-container>
      <el-header class="topbar">
        <div>
          <strong style="color: var(--color-primary); font-size: 20px;">{{ route.meta.title || "易积分后台管理系统" }}</strong>
        </div>
        <div class="topbar-right">
          <div class="userInfo">
            <div class="user-des">
              <div class="username">{{ admin?.name }}</div>
              <div class="role">{{ formatRole(admin?.role) }}</div>
            </div>
            <el-avatar class="user-avatar" shape="square" :size="40" :src="avatarUrl" />
          </div>
        </div>
      </el-header>
      <el-main>
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<style scoped lang="scss">
.shell {
  height: 100vh;
  overflow: hidden;
}

.sidebar {
  position: relative;
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background-color: var(--color-bg-card);

  :deep(.el-menu) {
    flex: 1;
    overflow-y: auto;
    background: var(--color-bg-card);
    border-bottom: 1px solid var(--color-border-light);
  }

  :deep(.el-menu-item) {
    padding-left: 10px !important;
    margin: 5px 20px;
    color: var(--color-text-regular) !important; /* 默认文字 */
    border-radius: 10px;
  }

  :deep(.el-menu-item:hover) {
    color: var(--color-primary) !important; /* hover文字色 */
    background-color: var(--el-color-primary-light-9) !important; /* hover背景 */
  }

  :deep(.el-menu-item.is-active) {
    color: var(--color-primary) !important; /* 选中文字 */
    background-color: var(--el-color-primary-light-9) !important; /* 选中背景 */
  }

  .brand {
    border-bottom: 1px solid var(--color-border-light);
  }

  .sidebar-footer {
    display: flex;
    align-items: center;
    padding: 16px 30px;
    cursor: pointer;
    color: var(--color-text-regular);
    transition: background-color 0.2s, color 0.2s;

    &:hover {
      color: var(--color-points-deduct);
    }
  }

  :deep(.el-menu-item) .el-badge {
    flex: 1;
    display: flex;
    align-items: center;
    min-width: 0;
  }

  :deep(.el-menu-item) .el-badge__content {
    position: relative !important;
    top: auto !important;
    right: auto !important;
    transform: none !important;
    margin-left: auto;
    font-size: 11px;
    height: 18px;
    line-height: 18px;
    padding: 0 5px;
    border-radius: 9px;
  }

}

// 右侧容器随 shell 固定，不溢出
.shell > :deep(.el-container) {
  overflow: hidden;
}

// 主内容区独立滚动
.shell :deep(.el-main) {
  overflow-y: auto;
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 20px;

  .userInfo {
    display: flex;
    align-items: center;
    gap: 10px;

    .user-des {
      display: flex;
      flex-direction: column;
      gap: 2px;

      .username {
        font-size: 16px;
        font-weight: bold;
        text-align: left;
      }

      .role {
        font-size: 14px;
        color: var(--color-text-secondary);
      }
    }

    .user-avatar {
      width: 46px;
      height: 46px;
      border: 2px solid var(--color-border);
      border-radius: 12px;
    }
  }
}

/* 全局分页组件背景色统一 */
:deep(.el-pagination.is-background) {
  .el-pager li.is-active {
    background-color: var(--color-primary);
  }
  .el-pager li:not(.is-active):hover {
    color: var(--color-primary);
  }
}

</style>