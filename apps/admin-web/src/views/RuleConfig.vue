<script setup lang="ts">
/**
 * 规则配置（PRD 5.8）：富文本编辑积分规则，保存后即时生效（用户端规则中心实时刷新，无需发版）。
 */
import { onBeforeUnmount, onMounted, ref, shallowRef } from "vue";
import { ElMessage } from "element-plus";
import { Editor, Toolbar } from "@wangeditor/editor-for-vue";
import type { IDomEditor } from "@wangeditor/editor";
import "@wangeditor/editor/dist/css/style.css";
import { getRule, saveRule } from "../api/rule/rule";
import type { RuleContent } from "../api/rule/rule";
import { formatTimeText } from "../utils/format";
import { createSubmitLock } from "../utils/submit-lock";

const editorRef = shallowRef<IDomEditor>();
const htmlValue = ref("");
const loading = ref(false);
const saving = ref(false);
const saveLock = createSubmitLock();
/** 最近一次保存时间（即时生效提示用） */
const lastSaved = ref<RuleContent | null>(null);
const previewVisible = ref(false);

const toolbarConfig = {
  // 后端无视频存储接口，排除视频与全屏（全屏会脱离后台布局）
  excludeKeys: ["group-video", "insertVideo", "uploadVideo", "fullScreen"]
};

const editorConfig = { placeholder: "请输入积分规则内容：积分加减规则、任务规则、兑换规则、申诉规则……" };

const handleCreated = (editor: IDomEditor) => {
  editorRef.value = editor;
};

async function load() {
  loading.value = true;
  try {
    const rule = await getRule();
    htmlValue.value = rule.content;
    lastSaved.value = rule;
  } catch (error) {
    ElMessage.error((error as Error)?.message || "加载规则失败");
  } finally {
    loading.value = false;
  }
}

async function save() {
  const content = String(htmlValue.value || "").replace(/<[^>]+>/g, "").trim();
  if (!content) {
    ElMessage.warning("规则内容不能为空");
    return;
  }
  if (!saveLock.acquire()) return;
  saving.value = true;
  try {
    const result = await saveRule({ content: String(htmlValue.value) });
    lastSaved.value = result;
    ElMessage.success("规则已保存并即时生效，用户端规则中心实时刷新");
  } catch (error) {
    ElMessage.error((error as Error)?.message || "保存失败");
  } finally {
    saving.value = false;
    saveLock.release();
  }
}

onMounted(load);

// 组件销毁时销毁编辑器实例（wangeditor 要求手动销毁）
onBeforeUnmount(() => {
  editorRef.value?.destroy();
});
</script>

<template>
  <div class="panel">
    <div class="panel-head">
      <span class="panel-bar" />
      <h3 class="panel-title">规则配置</h3>
      <div class="panel-head-extra">
        <span v-if="lastSaved?.updatedAt" class="panel-hint">
          最近保存：{{ lastSaved.updatedBy || "—" }} · {{ formatTimeText(lastSaved.updatedAt) }}（保存后即时生效）
        </span>
        <el-button @click="previewVisible = true">预览</el-button>
        <el-button color="var(--color-primary)" :loading="saving" @click="save">保存并生效</el-button>
      </div>
    </div>

    <div class="panel-body" v-loading="loading">
      <div class="editor-container">
        <Toolbar class="editor-toolbar" :editor="editorRef" :default-config="toolbarConfig" mode="default" />
        <Editor
          v-model="htmlValue"
          :default-config="editorConfig"
          mode="default"
          style="height: 440px; overflow-y: hidden"
          @on-created="handleCreated"
        />
      </div>
      <p class="editor-note">规则保存后即时生效，用户端「规则中心」将实时展示最新内容，无需小程序发版。</p>
    </div>
  </div>

  <el-dialog v-model="previewVisible" title="规则预览（员工端规则中心效果）" width="680px">
    <div class="rule-preview" v-html="htmlValue"></div>
  </el-dialog>
</template>

<style scoped lang="scss">
.panel {
  background: #fff;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 20px;
  background: var(--color-bg-page);
  border-bottom: 1px solid var(--color-border);
}

.panel-head-extra {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 12px;
}

.panel-hint {
  font-size: 12px;
  color: var(--color-text-placeholder);
}

.panel-bar {
  width: 3px;
  height: 16px;
  border-radius: 2px;
  flex-shrink: 0;
  background: var(--color-primary);
}

.panel-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.panel-body {
  padding: 20px;
}

// 编辑器容器：信赖蓝配色对齐（覆盖 wangeditor CSS 变量）
.editor-container {
  border: 1px solid var(--color-border);
  border-radius: 8px;
  overflow: hidden;
  z-index: 10;

  --w-e-toolbar-bg-color: var(--color-bg-page);
  --w-e-toolbar-color: var(--color-text-regular);
  --w-e-toolbar-active-bg-color: var(--el-color-primary-light-9);
  --w-e-toolbar-active-color: var(--color-primary);
  --w-e-toolbar-disabled-color: var(--color-text-placeholder);

  .editor-toolbar {
    border-bottom: 1px solid var(--color-border);
  }

  // 编辑器占位文字（编辑器 DOM 为运行时插入，须用 :deep 匹配）
  :deep(.w-e-text-placeholder) {
    color: var(--color-text-placeholder);
    font-style: normal;
  }
}

.editor-note {
  margin: 12px 0 0;
  font-size: 13px;
  color: var(--color-text-secondary);
}

// 预览样式（模拟员工端规则中心阅读排版）
.rule-preview {
  max-height: 60vh;
  overflow-y: auto;
  line-height: 1.8;
  color: var(--color-text-regular);

  :deep(h2) {
    font-size: 16px;
    color: var(--color-text-primary);
    border-left: 3px solid var(--color-primary);
    padding-left: 10px;
  }

  :deep(ul) {
    padding-left: 22px;
  }

  :deep(li) {
    margin-bottom: 6px;
  }
}
</style>
