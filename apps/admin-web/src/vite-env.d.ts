/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 后端 API 前缀，如 https://api.example.com；开发环境留空走 vite 代理 */
  readonly VITE_API_BASE?: string
  /** 置为 "1" 时开发环境启用 mock 数据（生产构建强制关闭） */
  readonly VITE_USE_MOCK?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
