import { reactive } from 'vue'

/**
 * 首页角标共享状态：首页 onShow/下拉刷新时写入，AppTabBar 据此显示「首页」标签红点。
 * 模块级 reactive 单例（H5 为 SPA，页面切换不丢失），避免底栏在每个 tab 页重复拉数据。
 * keys 与首页快捷入口 badge 一致：messages=未读消息 / votes=待参与投票 / orders=审核中订单
 */
export const homeBadges = reactive({ messages: 0, votes: 0, orders: 0 })
