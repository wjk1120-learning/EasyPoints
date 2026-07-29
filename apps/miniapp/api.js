let loginPromise = null;

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
      const data = response.data.data;
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
    throw error;
  }
}

export async function askAi(question) {
  return request("/miniapp/ai/ask", {
    method: "POST",
    header: { "content-type": "application/json" },
    data: { question }
  });
}
