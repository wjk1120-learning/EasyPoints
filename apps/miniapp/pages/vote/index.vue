<script setup>
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { isMissingApi, request } from '../../api'
import NavBar from '../../components/NavBar.vue'

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

function deadlineOf(voteData) {
  if (!voteData?.deadline) return ''
  const date = new Date(voteData.deadline)
  if (Number.isNaN(date.getTime())) return String(voteData.deadline)
  const m = `${date.getMonth() + 1}`.padStart(2, '0')
  const d = `${date.getDate()}`.padStart(2, '0')
  const hh = `${date.getHours()}`.padStart(2, '0')
  const mm = `${date.getMinutes()}`.padStart(2, '0')
  return `${m}-${d} ${hh}:${mm}`
}
</script>

<template>
  <view class="page page-nav">
    <NavBar title="投票详情" />

    <view v-if="missing" class="card"><text class="muted">{{ missing }}</text></view>

    <template v-else-if="vote">
      <view class="card">
        <view class="row between">
          <text class="pill" :class="locked ? 'green' : 'blue'">{{ locked ? (vote.closed || vote.expired ? '已结束' : '已完成') : '进行中' }}</text>
          <text class="muted">{{ multiple ? '多选' : '单选' }}</text>
        </view>
        <text class="vote-title">{{ vote.title }}</text>
        <text v-if="vote.description" class="vote-desc">{{ vote.description }}</text>
        <text v-if="vote.relatedLabel" class="related">📌 关联：{{ vote.relatedLabel }}</text>
        <text v-if="deadlineOf(vote)" class="deadline">⏱ {{ locked ? '截止' : '截至' }} {{ deadlineOf(vote) }}</text>
      </view>

      <view class="card">
        <view class="block-title">投票选项</view>
        <view
          v-for="option in vote.options || []"
          :key="option.id"
          class="option"
          :class="{ on: selected.includes(String(option.id)), 'option-locked': locked }"
          @tap="toggle(option)"
        >
          <view class="option-check" :class="{ 'option-check-on': selected.includes(String(option.id)) }">
            <text v-if="selected.includes(String(option.id))" class="option-check-mark">✓</text>
          </view>
          <text class="option-text">{{ option.text || option.label }}</text>
        </view>
      </view>

      <view class="button" :class="{ disabled: locked || submitting }" @tap="submit">
        {{ locked ? '已完成投票' : (submitting ? '提交中...' : '提交投票') }}
      </view>
      <text class="tip">投票只作管理员评审参考，不会自动加积分；提交后不可修改。</text>
    </template>
  </view>
</template>

<style scoped>
.vote-title {
  display: block;
  margin-top: 20rpx;
  font-size: 34rpx;
  font-weight: 700;
  color: #1a2233;
  line-height: 1.4;
}

.vote-desc {
  display: block;
  margin-top: 12rpx;
  font-size: 26rpx;
  color: #344156;
  line-height: 1.7;
}

.related {
  display: block;
  margin-top: 12rpx;
  font-size: 24rpx;
  color: #6b7280;
}

.deadline {
  display: block;
  margin-top: 12rpx;
  font-size: 24rpx;
  color: #d97706;
}

.block-title {
  font-size: 30rpx;
  font-weight: 700;
  color: #1a2233;
}

.option {
  display: flex;
  align-items: center;
  gap: 20rpx;
  margin-top: 20rpx;
  padding: 24rpx;
  border-radius: 16rpx;
  border: 2rpx solid #ebedf0;
  background: #fafbfc;
}

.option.on {
  border-color: #2f6bff;
  background: #edf3ff;
}

.option-locked {
  opacity: 0.75;
}

.option-check {
  flex-shrink: 0;
  width: 36rpx;
  height: 36rpx;
  border-radius: 50%;
  border: 2rpx solid #c9cfd8;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}

.option-check-on {
  border-color: #2f6bff;
  background: #2f6bff;
}

.option-check-mark {
  color: #ffffff;
  font-size: 22rpx;
  font-weight: 700;
}

.option-text {
  flex: 1;
  min-width: 0;
  font-size: 28rpx;
  color: #1a2233;
  line-height: 1.5;
}

.button.disabled {
  background: #ebedf0;
  color: #b4bac3;
}

.tip {
  display: block;
  margin-top: 16rpx;
  text-align: center;
  font-size: 22rpx;
  color: #b4bac3;
  line-height: 1.6;
}
</style>
