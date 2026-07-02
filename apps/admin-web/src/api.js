const API_BASE = import.meta.env.VITE_API_BASE || "";

function parseJwtPayload(token) {
  try {
    const parts = String(token || "").split(".");
    if (parts.length !== 3) return null;
    const payloadJson = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(payloadJson);
  } catch {
    return null;
  }
}

function isJwtExpired(token) {
  const payload = parseJwtPayload(token);
  if (!payload?.exp) return false;
  return Date.now() >= Number(payload.exp) * 1000;
}

function clearAuth(reason) {
  localStorage.removeItem("token");
  localStorage.removeItem("adminId");
  localStorage.removeItem("admin");
  window.dispatchEvent(new CustomEvent("auth:logout", { detail: { reason } }));
}

export async function authFetch(input, init = {}) {
  const token = localStorage.getItem("token");
  if (token && isJwtExpired(token)) clearAuth("expired");
  const safeToken = token && !isJwtExpired(token) ? token : "";
  const response = await fetch(input, {
    ...init,
    headers: {
      ...(safeToken ? { authorization: `Bearer ${safeToken}` } : {}),
      ...(init.headers || {})
    }
  });
  if (response.status === 401) {
    clearAuth("unauthorized");
    throw new Error("登录已失效，请重新登录");
  }
  return response;
}

async function request(path, options = {}) {
  const token = localStorage.getItem("token");
  if (token && isJwtExpired(token)) clearAuth("expired");
  const response = await authFetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(!import.meta.env.PROD && !token ? { "x-admin-id": localStorage.getItem("adminId") || "1" } : {}),
      ...(options.headers || {})
    }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "请求失败");
  if (data && typeof data === "object" && "meta" in data) return data;
  return data.data ?? data;
}

function buildQuery(params) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params || {})) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export const api = {
  login: (payload) => request("/admin/auth/login", { method: "POST", body: JSON.stringify(payload) }),
  badges: () => request("/admin/badges"),
  markBadgesSeen: (keys) =>
    request("/admin/badges/mark-seen", {
      method: "POST",
      body: JSON.stringify({ keys: Array.isArray(keys) ? keys : [] })
    }),
  employees: () => request("/admin/employees"),
  employeesPaged: (params) => request(`/admin/employees${buildQuery(params)}`),
  adjustment: (payload) => request("/admin/points/adjustment", { method: "POST", body: JSON.stringify(payload) }),
  monthlyBatch: (payload) => request("/admin/points/monthly-batch", { method: "POST", body: JSON.stringify(payload) }),
  reports: () => request("/admin/reports/point-records"),
  reportsPaged: (params) => request(`/admin/reports/point-records${buildQuery(params)}`),
  logs: () => request("/admin/operation-logs"),
  logsPaged: (params) => request(`/admin/operation-logs${buildQuery(params)}`),
  outboxPaged: (params) => request(`/admin/outbox${buildQuery(params)}`),
  outboxMeta: () => request("/admin/outbox/meta"),
  retryOutbox: (id) => request(`/admin/outbox/${id}/retry`, { method: "POST" }),
  retryOutboxFailed: (payload) => request("/admin/outbox/retry-failed", { method: "POST", body: JSON.stringify(payload || {}) }),
  dispatchOutbox: () => request("/admin/wecom/dispatch-messages", { method: "POST" }),
  appeals: () => request("/admin/appeals"),
  appealsPaged: (params) => request(`/admin/appeals${buildQuery(params)}`),
  reviewAppeal: (id, payload) => request(`/admin/appeals/${id}/review`, { method: "POST", body: JSON.stringify(payload) }),
  orders: () => request("/admin/orders"),
  ordersPaged: (params) => request(`/admin/orders${buildQuery(params)}`),
  updateOrder: (id, payload) => request(`/admin/orders/${id}/status`, { method: "POST", body: JSON.stringify(payload) }),
  mallGifts: () => request("/admin/mall/gifts"),
  createGift: (payload) => request("/admin/mall/gifts", { method: "POST", body: JSON.stringify(payload) }),
  updateGift: (id, payload) => request(`/admin/mall/gifts/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  publishGift: (id) => request(`/admin/mall/gifts/${id}/publish`, { method: "POST" }),
  unpublishGift: (id) => request(`/admin/mall/gifts/${id}/unpublish`, { method: "POST" })
};
