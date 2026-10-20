/**
 * 表单防重复提交锁（PRD 7.3：所有表单防止重复提交）。
 * el-button :loading 已覆盖按钮点击场景；本工具用于非按钮触发路径
 * （如 prompt 确认后的提交、键盘回车提交），在请求期间直接忽略二次调用。
 *
 * 用法：
 *   const locked = createSubmitLock()
 *   async function submit() {
 *     if (!locked.acquire()) return
 *     try { await api.xxx() } finally { locked.release() }
 *   }
 */

export interface SubmitLock {
  acquire: () => boolean
  release: () => void
  isLocked: () => boolean
}

export function createSubmitLock(): SubmitLock {
  let locked = false
  return {
    acquire() {
      if (locked) return false
      locked = true
      return true
    },
    release() {
      locked = false
    },
    isLocked() {
      return locked
    },
  }
}
