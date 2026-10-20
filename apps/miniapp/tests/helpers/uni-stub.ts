/**
 * uni 全局 stub（L2/L3 共用注入点）：可编程的 storage + request 响应队列 + UI 方法记录器。
 * 用法：const u = createUniStub(); u.responders.push({ statusCode, data }, ...);
 * 每次 uni.request 按顺序取一个 responder，异步回灌 success/fail/complete，测试侧 await 被测函数即可。
 */
export type StubResponse =
  | { statusCode: number; data: unknown; headers?: Record<string, string> }
  | { fail: string };

export function createUniStub() {
  const storage = new Map<string, string>();
  const calls: Array<{ url: string; options: { url: string; method?: string; data?: unknown; header?: Record<string, string> } }> = [];
  const responders: StubResponse[] = [];
  /** showToast 文案记录（组件测试断言用） */
  const toasts: string[] = [];
  /** switchTab/navigateTo 目标记录（组件测试断言用） */
  const navigations: string[] = [];

  const uni = {
    getStorageSync: (key: string) => storage.get(key) ?? "",
    setStorageSync: (key: string, value: unknown) => storage.set(key, String(value)),
    removeStorageSync: (key: string) => {
      storage.delete(key);
    },
    showToast: (options: { title?: string; icon?: string } = {}) => {
      toasts.push(options?.title ?? "");
    },
    showModal: (options: { success?: (res: { confirm: boolean; cancel: boolean }) => void } = {}) => {
      options.success?.({ confirm: false, cancel: true });
    },
    showActionSheet: (options: { success?: (res: unknown) => void; fail?: (err: { errMsg: string }) => void } = {}) => {
      options.fail?.({ errMsg: "showActionSheet:fail cancel" });
    },
    switchTab: (options: { url: string } | string) => {
      // uni.switchTab 实际收 {url} 对象，与 navigateTo 统一记录为字符串
      navigations.push(typeof options === "string" ? options : options.url);
    },
    navigateTo: (options: { url: string }) => {
      navigations.push(options.url);
    },
    navigateBack: () => {
      navigations.push("navigateBack");
    },
    stopPullDownRefresh: () => {},
    startPullDownRefresh: () => {},
    hideTabBar: () => {},
    /** 页面栈：真实 App 至少有当前 1 页（AppTabBar/NavBar 取栈顶读 route，空数组会让它们 setup 崩溃、渲染中断） */
    getCurrentPages: () => [{ route: "pages/home/index", options: {}, $page: { fullPath: "/pages/home/index" } }],
    getSystemInfoSync: () => ({
      statusBarHeight: 20,
      windowWidth: 375,
      windowHeight: 667,
      safeArea: { top: 20, bottom: 667, left: 0, right: 375, width: 375, height: 647 }
    }),
    chooseImage: (options: { success?: (res: unknown) => void; fail?: (err: { errMsg: string }) => void } = {}) => {
      options.fail?.({ errMsg: "chooseImage:fail cancel" });
    },
    uploadFile: (options: { url: string; filePath?: string; name?: string; success?: (res: { statusCode: number; data: string }) => void; fail?: (err: { errMsg: string }) => void; complete?: () => void }) => {
      calls.push({ url: options.url, options });
      const responder = responders.shift();
      if (!responder) throw new Error(`uni.uploadFile 无预设响应：${options.url}`);
      setTimeout(() => {
        if ("fail" in responder) options.fail?.({ errMsg: responder.fail });
        else options.success?.({ statusCode: responder.statusCode, data: JSON.stringify(responder.data) });
        options.complete?.();
      }, 0);
    },
    request(options: {
      url: string;
      method?: string;
      data?: unknown;
      header?: Record<string, string>;
      success?: (res: { statusCode: number; data: unknown }) => void;
      fail?: (err: { errMsg: string }) => void;
      complete?: () => void;
    }) {
      calls.push({ url: options.url, options });
      const responder = responders.shift();
      if (!responder) throw new Error(`uni.request 无预设响应：${options.url}`);
      setTimeout(() => {
        if ("fail" in responder) options.fail?.({ errMsg: responder.fail });
        else options.success?.({ statusCode: responder.statusCode, data: responder.data });
        // 契约行为：complete 无论成败必调（loginEmployee 依赖它清理并发锁）
        options.complete?.();
      }, 0);
    }
  };
  (globalThis as unknown as { uni: unknown }).uni = uni;
  // uni-app 把这些暴露为裸全局（编译产物直接调用，非 uni. 前缀）
  (globalThis as unknown as { getCurrentPages: () => unknown[] }).getCurrentPages = () => [];
  (globalThis as unknown as { getSystemInfoSync: () => unknown }).getSystemInfoSync = uni.getSystemInfoSync;
  (globalThis as unknown as { getStorageSync: (k: string) => string }).getStorageSync = uni.getStorageSync;
  (globalThis as unknown as { setStorageSync: (k: string, v: unknown) => void }).setStorageSync = uni.setStorageSync;

  return { uni, storage, calls, responders, toasts, navigations };
}
