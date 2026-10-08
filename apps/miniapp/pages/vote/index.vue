<script setup>
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { isMissingApi, request } from '../../api'

const vote = ref(null)
const selected = ref([])
const missing = ref('')
const submitting = ref(false)
const id = ref('')

const multiple = computed(() => vote.value?.mode === 'multiple' || vote.value?.multiple === true)
const locked = computed(() => Boolean(vote.value?.submitted || vote.value?.closed || vote.value?.expired))

onLoad(async (query) => {
  id.value = query?.id || ''
  if (!id.value) {
    missing.value = '缺少投票编号'
    return
  }
  try {
    const data = await request(`/miniapp/votes/${encodeURIComponent(id.value)}`)
    vote.value = data
    selected.value = Array.isArray(data?.selectedOptionIds) ? data.selectedOptionIds.map(String) : []
  } catch (error) {
    missing.value = isMissingApi(error)
      ? '后端尚未提供 GET /miniapp/votes/{id}。提交接口约定为 POST /miniapp/votes/{id}/ballots，body: { optionIds }。每人仅一次，结果不自动加积分。'
      : (error?.message || '加载失败')
  }
})

function toggle(option) {
  if (locked.value) return
  const key = String(option.id)
  if (!multiple.value) {
    selected.value = [key]
    return
  }
  selected.value = selected.value.includes(key)
    ? selected.value.filter((item) => item !== key)
    : [...selected.value, key]
}

async function submit() {
  if (locked.value || submitting.value) return
  if (!selected.value.length) {
    uni.showToast({ title: '请选择投票选项', icon: 'none' })
    return
  }
  submitting.value = true
  try {
    const data = await request(`/miniapp/votes/${encodeURIComponent(id.value)}/ballots`, {
      method: 'POST',
      data: { optionIds: selected.value }
    })
    vote.value = { ...vote.value, ...(data || {}), submitted: true }
    uni.showToast({ title: '已完成投票' })
  } catch (error) {
    uni.showToast({ title: error?.message || '提交失败', icon: 'none' })
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <view class="page">
    <view v-if="missing" class="card"><text class="muted">{{ missing }}</text></view>
    <view v-else-if="vote" class="card">
      <text class="title">{{ vote.title }}</text>
      <text v-if="vote.description" class="body">{{ vote.description }}</text>
      <text v-if="vote.relatedLabel" class="muted">关联：{{ vote.relatedLabel }}</text>
      <text class="muted">{{ multiple ? '多选' : '单选' }}{{ vote.deadline ? ` · 截止 ${vote.deadline}` : '' }}</text>
      <view
        v-for="option in vote.options || []"
        :key="option.id"
        class="option"
        :class="{ on: selected.includes(String(option.id)) }"
        @tap="toggle(option)"
      >
        <text>{{ option.text || option.label }}</text>
      </view>
      <view class="button" :class="{ disabled: locked || submitting }" @tap="submit">
        {{ locked ? '已完成投票' : (submitting ? '提交中...' : '提交投票') }}
      </view>
      <text class="muted tip">投票只作审核参考，不会自动加积分。</text>
    </view>
  </view>
</template>

<style scoped>
.title { display: block; font-size: 34rpx; font-weight: 700; }
.body, .tip { display: block; margin-top: 12rpx; }
.option { margin-top: 16rpx; padding: 20rpx; border-radius: 16rpx; border: 1rpx solid #e5e7eb; }
.option.on { border-color: #2f6bff; background: #eef4ff; }
.button { margin-top: 24rpx; }
.disabled { opacity: 0.5; }
</style>
