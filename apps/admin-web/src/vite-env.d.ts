/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 后端 API 前缀，如 https://api.example.com；开发环境留空走 vite 代理 */
  readonly VITE_API_BASE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
