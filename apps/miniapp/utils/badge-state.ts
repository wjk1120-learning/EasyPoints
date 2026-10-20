import { reactive } from 'vue'

/**
 * 页面角标共享状态：对应页面 onShow/数据刷新时写入，AppTabBar 据此显示底栏角标。
 * 模块级 reactive 单例（H5 为 SPA，页面切换不丢失），避免底栏在每个 tab 页重复拉数据。
 * messages/votes/orders 由首页写入；tasks 由任务大厅页写入。
 */
export const homeBadges = reactive({
  /** 未读消息数 */
  messages: 0,
  /** 待参与投票数 */
  votes: 0,
  /** 审核中兑换订单数 */
  orders: 0,
  /** 进行中（待提交成果）任务数 */
  tasks: 0
})
