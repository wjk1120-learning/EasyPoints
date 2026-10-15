/**
 * uni 全局 stub（L2/L3 共用注入点）：可编程的 storage + request 响应队列。
 * 用法：const u = createUniStub(); u.responders.push({ statusCode, data }, ...);
 * 每次 uni.request 按顺序取一个 responder，异步回灌 success/fail，测试侧 await 被测函数即可。
 */
export type StubResponse =
  | { statusCode: number; data: unknown; headers?: Record<string, string> }
  | { fail: string };

export function createUniStub() {
  const storage = new Map<string, string>();
  const calls: Array<{ url: string; options: { url: string; method?: string; data?: unknown; header?: Record<string, string> } }> = [];
  const responders: StubResponse[] = [];

  const uni = {
    getStorageSync: (key: string) => storage.get(key) ?? "",
    setStorageSync: (key: string, value: unknown) => storage.set(key, String(value)),
    removeStorageSync: (key: string) => {
      storage.delete(key);
    },
    request(options: { url: string; method?: string; data?: unknown; header?: Record<string, string>; success?: (res: { statusCode: number; data: unknown }) => void; fail?: (err: { errMsg: string }) => void; complete?: () => void }) {
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

  return { uni, storage, calls, responders };
}
