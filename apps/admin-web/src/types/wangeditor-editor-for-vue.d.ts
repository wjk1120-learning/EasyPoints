/**
 * @wangeditor/editor-for-vue 类型桥接：
 * 该库 package.json "exports" 未正确暴露类型入口，且内部 .vue 声明经 re-export 无法解析，
 * 此处显式声明组件 Props（复用官方 @wangeditor/editor 的 IDomEditor 类型），待上游修复后可删除本文件。
 */
declare module "@wangeditor/editor-for-vue" {
  import type { DefineComponent } from "vue"
  import type { IDomEditor } from "@wangeditor/editor"

  export const Toolbar: DefineComponent<{
    editor?: IDomEditor | null
    defaultConfig?: Record<string, unknown>
    mode?: string
  }, {}, unknown>

  export const Editor: DefineComponent<{
    editor?: IDomEditor | null
    defaultConfig?: Record<string, unknown>
    mode?: string
    modelValue?: string
    "onUpdate:modelValue"?: (value: string) => void
    onCreated?: (editor: IDomEditor) => void
    onChange?: (editor: IDomEditor) => void
    onDestroyed?: (editor: IDomEditor) => void
  }, {}, unknown>
}
