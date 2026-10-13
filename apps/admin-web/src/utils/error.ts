/**
 * 错误文案映射：过渡期（旧后端未部署新契约接口）把「接口不存在」类 404 文案
 * 转成管理员可理解的提示，其余透传后端 msg；新后端全量接入后此映射自然不再命中。
 */
export function apiErrorMsg(error: unknown, fallback: string): string {
  const message = (error as Error)?.message || "";
  if (!message) return fallback;
  if (/404|Cannot|not found|接口不存在/i.test(message)) return `${fallback}（当前后端未部署该接口，新后端接入后可用）`;
  return message;
}
