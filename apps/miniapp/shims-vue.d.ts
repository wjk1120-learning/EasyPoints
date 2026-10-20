/// <reference types="vite/client" />

// .vue 单文件组件模块声明（JS 组件在 strict TS 下导入需要；TS 组件优先走各自类型）
declare module "*.vue" {
  import type { DefineComponent } from "vue"
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}
