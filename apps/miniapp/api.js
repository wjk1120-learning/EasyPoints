let loginPromise = null;
const LAN_API_BASE = "http://192.168.1.105:3000";

function normalizeApiBase(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}

function isLocalhostBase(apiBase) {
  const base = String(apiBase || "").toLowerCase();
  return base.includes("://localhost") || base.includes("://127.0.0.1");
}

export function getApiBase() {
  const stored = normalizeApiBase(uni.getStorageSync("apiBase"));
  if (stored && !isLocalhostBase(stored)) return stored;
  return normalizeApiBase(LAN_API_BASE) || normalizeApiBase("http://localhost:3000");
}

export function clearEmployeeAuth(reason) {
  uni.removeStorageSync("employeeToken");
  if (reason) uni.setStorageSync("employeeAuthError", String(reason));
}

export function loginEmployee(payload = {}) {
  if (loginPromise) return loginPromise;
  const wecomUserId = payload.wecomUserId || uni.getStorageSync("wecomUserId") || "zhangsan";
  const employeeId = payload.employeeId || "";
  loginPromise = new Promise((resolve, reject) => {
    uni.request({
      url: `${getApiBase()}/miniapp/auth/login`,
      method: "POST",
      header: { "content-type": "application/json" },
      data: { wecomUserId, employeeId },
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300 && res.data?.token) {
          uni.setStorageSync("employeeToken", res.data.token);
          if (res.data?.employee?.id) uni.setStorageSync("employeeId", String(res.data.employee.id));
          if (wecomUserId) uni.setStorageSync("wecomUserId", wecomUserId);
          resolve(res.data);
        } else {
          clearEmployeeAuth("unauthorized");
          reject(new Error(res.data?.message || "登录失败"));
        }
      },
      fail(err) {
        clearEmployeeAuth("network_error");
        reject(err);
      },
      complete() {
        loginPromise = null;
      }
    });
  });
  return loginPromise;
}

function rawRequest(path, options = {}) {
  return new Promise((resolve, reject) => {
    const token = uni.getStorageSync("employeeToken") || "";
    const header = token
      ? { authorization: `Bearer ${token}` }
      : { "x-employee-id": uni.getStorageSync("employeeId") || "1" };
    const apiBase = getApiBase();
    uni.request({
      url: `${apiBase}${path}`,
      method: options.method || "GET",
      data: options.data || {},
      header,
      success(response) {
        resolve(response);
      },
      fail(err) {
        clearEmployeeAuth("network_error");
        reject(new Error(err?.errMsg || err?.message || "网络错误"))
      }
    });
  });
}

export async function request(path, options = {}) {
  const response = await rawRequest(path, options);
  if (response.statusCode === 401) {
    clearEmployeeAuth("unauthorized");
    await loginEmployee();
    const retry = await rawRequest(path, options);
    if (retry.statusCode >= 200 && retry.statusCode < 300) return retry.data.data;
    throw new Error(retry.data?.message || "请求失败");
  }
  if (response.statusCode >= 200 && response.statusCode < 300) return response.data.data;
  throw new Error(response.data?.message || "请求失败");
}

export async function requestPaged(path, options = {}) {
  const response = await rawRequest(path, options);
  if (response.statusCode === 401) {
    clearEmployeeAuth("unauthorized");
    await loginEmployee();
    const retry = await rawRequest(path, options);
    if (retry.statusCode >= 200 && retry.statusCode < 300) {
      return { data: retry.data.data, meta: retry.data.meta || null };
    }
    throw new Error(retry.data?.message || "请求失败");
  }
  if (response.statusCode >= 200 && response.statusCode < 300) {
    return { data: response.data.data, meta: response.data.meta || null };
  }
  throw new Error(response.data?.message || "请求失败");
}
