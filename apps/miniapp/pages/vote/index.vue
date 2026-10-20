<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { fetchVote, submitBallot } from '../../api/vote/vote'
import type { VoteDetail, VoteOption } from '../../api/vote/types'
import NavBar from '../../components/NavBar.vue'
import AppTabBar from '../../components/AppTabBar.vue'
import AppIcon from '../../components/AppIcon.vue'

const vote = ref<VoteDetail | null>(null)
const selected = ref<string[]>([])
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
    // 契约 9.8：非参与者 404「投票不存在」
    const data = await fetchVote(id.value)
    vote.value = data
    selected.value = Array.isArray(data?.selectedOptionIds) ? data.selectedOptionIds.map(String) : []
  } catch (error) {
    missing.value = (error as Error)?.message || '加载失败'
  }
})

function toggle(option: VoteOption) {
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
    // 契约 9.9：ballots 路由返回提交后详情（含 selectedOptionIds 回显）
    const data = await submitBallot(id.value, selected.value)
    vote.value = { ...(vote.value as VoteDetail), ...(data || {}), submitted: true }
    uni.showToast({ title: '已完成投票' })
  } catch (error) {
    uni.showToast({ title: (error as Error)?.message || '提交失败', icon: 'none' })
  } finally {
    submitting.value = false
  }
}

/** 契约口径 deadline 为 yyyy-MM-dd HH:mm，截 MM-DD HH:mm 展示 */
function deadlineOf(voteData: VoteDetail | null) {
  if (!voteData?.deadline) return ''
  const matched = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})/.exec(String(voteData.deadline))
  return matched ? `${matched[2]}-${matched[3]} ${matched[4]}:${matched[5]}` : String(voteData.deadline)
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
        <view v-if="vote.relatedLabel" class="related">
          <AppIcon name="bookmark" :size="24" color="muted" />
          <text>关联：{{ vote.relatedLabel }}</text>
        </view>
        <view v-if="deadlineOf(vote)" class="deadline">
          <AppIcon name="clock" :size="24" color="amber" />
          <text>{{ locked ? '截止' : '截至' }} {{ deadlineOf(vote) }}</text>
        </view>
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
            <AppIcon v-if="selected.includes(String(option.id))" name="check" :size="24" color="white" />
          </view>
          <text class="option-text">{{ option.text || option.label }}</text>
        </view>
      </view>

      <view class="button" :class="{ disabled: locked || submitting }" @tap="submit">
        {{ locked ? '已完成投票' : (submitting ? '提交中...' : '提交投票') }}
      </view>
      <text class="tip">投票只作管理员评审参考，不会自动加积分；提交后不可修改。</text>
    </template>

    <AppTabBar />
  </view>
</template>

<style scoped>
.vote-title {
  display: block;
  margin-top: 20rpx;
  font-size: 34rpx;
  font-weight: 700;
  color: var(--ink);
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
  display: inline-flex;
  align-items: center;
  gap: 6rpx;
  margin-top: 12rpx;
  font-size: 24rpx;
  color: var(--ink-3);
}

.deadline {
  display: flex;
  align-items: center;
  gap: 6rpx;
  margin-top: 12rpx;
  font-size: 24rpx;
  color: var(--amber);
}

.block-title {
  font-size: 30rpx;
  font-weight: 700;
  color: var(--ink);
}

.option {
  display: flex;
  align-items: center;
  gap: 20rpx;
  margin-top: 20rpx;
  padding: 24rpx;
  border-radius: 16rpx;
  border: 2rpx solid var(--line);
  background: #fafbfc;
}

.option.on {
  border-color: var(--brand);
  background: var(--brand-soft);
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
  border-color: var(--brand);
  background: var(--brand);
}

.option-text {
  flex: 1;
  min-width: 0;
  font-size: 28rpx;
  color: var(--ink);
  line-height: 1.5;
}

.button.disabled {
  background: var(--line);
  color: var(--faint);
}

.tip {
  display: block;
  margin-top: 16rpx;
  text-align: center;
  font-size: 22rpx;
  color: var(--faint);
  line-height: 1.6;
}
</style>
