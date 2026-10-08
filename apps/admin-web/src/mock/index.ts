/**
 * mock 开关与包装器：后端接口未就绪的模块（任务/投票/积分申请/规则等）前端先行开发。
 * 用法：域接口函数内用 withMock(真实调用, mock调用) 包装；后端就绪后摘掉包装即可。
 * 开关：开发环境设 VITE_USE_MOCK=1（.env 或启动前），或浏览器执行 localStorage.setItem("adminMock", "1") 后刷新。
 * 生产构建（import.meta.env.PROD）强制走真实接口。
 */

export function isMockEnabled(): boolean {
  if (import.meta.env.PROD) return false;
  return import.meta.env.VITE_USE_MOCK === "1" || localStorage.getItem("adminMock") === "1";
}

export function withMock<T>(real: () => Promise<T>, mock: () => Promise<T>): Promise<T> {
  return isMockEnabled() ? mock() : real();
}
