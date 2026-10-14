let loginPromise = null;
// 预览模拟数据兜底（见 mock/index.js 头部说明；后端接口就绪后按说明删除）
import { mockFallback, mockFieldPatch } from "./mock/index.js";

function readMock(path, method, error) {
  try {
    return mockFallback(path, method, error);
  } catch {
    return null;
  }
}

function patchFields(path, data) {
  try {
    return mockFieldPatch(path, data);
  } catch {
    return data;
  }
}

function normalizeApiBase(value) {
  if (value === false || value === true || value == null) return "";
  const raw = String(value || "").trim();
  if (!raw || raw === "false" || raw === "true") return "";
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}

function isValidApiBase(value) {
  const base = normalizeApiBase(value);
  return /^https?:\/\/.+/i.test(base);
}

export function getApiBase() {
  const stored = normalizeApiBase(uni.getStorageSync("apiBase"));
  if (isValidApiBase(stored)) return stored;
  return "http://localhost:3000";
}

export function clearEmployeeAuth(reason) {
  uni.removeStorageSync("employeeToken");
  if (reason) uni.setStorageSync("employeeAuthError", String(reason));
}

export function markNetworkError() {
  uni.setStorageSync("employeeAuthError", "network_error");
}

export function clearAuthError() {
  uni.removeStorageSync("employeeAuthError");
}

export function isNetworkError(error) {
  if (!error) return false;
  if (error.isNetworkError) return true;
  const msg = String(error.message || error.errMsg || "");
  return /network|网络|timeout|超时|fail|connect|request:fail/i.test(msg);
}

function cacheStorageKey(path) {
  return `cache:${path}`;
}

function readCache(path) {
  try {
    const raw = uni.getStorageSync(cacheStorageKey(path));
    if (!raw) return null;
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return parsed?.data ?? null;
  } catch {
    return null;
  }
}

export function getCachedData(path) {
  return readCache(path);
}

function writeCache(path, data) {
  try {
    uni.setStorageSync(
      cacheStorageKey(path),
      JSON.stringify({ data, cachedAt: Date.now() })
    );
  } catch {}
}

function createNetworkError(err) {
  const error = new Error(err?.errMsg || err?.message || "网络不可用，请检查连接");
  error.isNetworkError = true;
  return error;
}

function isGetMethod(method) {
  return String(method || "GET").toUpperCase() === "GET";
}

export function loginEmployee(payload = {}) {
  if (loginPromise) return loginPromise;
  const wecomUserId = String(payload.wecomUserId || uni.getStorageSync("wecomUserId") || "zhangsan").trim();
  const employeeId = payload.employeeId || "";
  const hadToken = Boolean(uni.getStorageSync("employeeToken"));
  if (!hadToken) uni.removeStorageSync("employeeToken");
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
          clearAuthError();
          resolve(res.data);
        } else {
          clearEmployeeAuth("unauthorized");
          reject(new Error(res.data?.message || "登录失败"));
        }
      },
      fail(err) {
        markNetworkError();
        reject(createNetworkError(err));
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
    const authHeader = token
      ? { authorization: `Bearer ${token}` }
      : { "x-employee-id": uni.getStorageSync("employeeId") || "1" };
    const apiBase = getApiBase();
    uni.request({
      url: `${apiBase}${path}`,
      method: options.method || "GET",
      data: options.data || {},
      header: {
        ...authHeader,
        ...(options.header || {})
      },
      success(response) {
        resolve(response);
      },
      fail(err) {
        markNetworkError();
        reject(createNetworkError(err));
      }
    });
  });
}

function tryReadCache(path, method) {
  if (!isGetMethod(method)) return null;
  return readCache(path);
}

export async function request(path, options = {}) {
  const method = options.method || "GET";
  try {
    const response = await rawRequest(path, options);
    if (response.statusCode === 401) {
      clearEmployeeAuth("unauthorized");
      await loginEmployee();
      const retry = await rawRequest(path, options);
      if (retry.statusCode >= 200 && retry.statusCode < 300) {
        const data = retry.data.data;
        if (isGetMethod(method)) writeCache(path, data);
        clearAuthError();
        return data;
      }
      throw new Error(retry.data?.message || "请求失败");
    }
    if (response.statusCode >= 200 && response.statusCode < 300) {
      let data = response.data.data;
      if (isGetMethod(method)) data = patchFields(path, data);
      if (isGetMethod(method)) writeCache(path, data);
      clearAuthError();
      return data;
    }
    throw new Error(response.data?.message || "请求失败");
  } catch (error) {
    const cached = tryReadCache(path, method);
    if (isNetworkError(error) && cached != null) {
      return { ...cached, __offline: true };
    }
    const mocked = readMock(path, method, error);
    if (mocked != null) return mocked;
    throw error;
  }
}

export async function requestPaged(path, options = {}) {
  const method = options.method || "GET";
  try {
    const response = await rawRequest(path, options);
    if (response.statusCode === 401) {
      clearEmployeeAuth("unauthorized");
      await loginEmployee();
      const retry = await rawRequest(path, options);
      if (retry.statusCode >= 200 && retry.statusCode < 300) {
        const result = { data: retry.data.data, meta: retry.data.meta || null };
        if (isGetMethod(method)) writeCache(path, result);
        clearAuthError();
        return result;
      }
      throw new Error(retry.data?.message || "请求失败");
    }
    if (response.statusCode >= 200 && response.statusCode < 300) {
      const result = { data: response.data.data, meta: response.data.meta || null };
      if (isGetMethod(method)) writeCache(path, result);
      clearAuthError();
      return result;
    }
    throw new Error(response.data?.message || "请求失败");
  } catch (error) {
    const cached = tryReadCache(path, method);
    if (isNetworkError(error) && cached != null) {
      return { ...cached, __offline: true };
    }
    const mocked = readMock(path, method, error);
    if (mocked != null) return mocked;
    throw error;
  }
}

// history：最近几轮对话 [{role, content}]，配合后端多轮契约（见 ai/BACKEND-SPEC.md §2）；旧后端会忽略该字段
export async function askAi(question, history = []) {
  return request("/miniapp/ai/ask", {
    method: "POST",
    header: { "content-type": "application/json" },
    data: { question, history }
  });
}

export function isMissingApi(error) {
  const msg = String(error?.message || "");
  return /接口不存在|404|未实现|501/.test(msg);
}
