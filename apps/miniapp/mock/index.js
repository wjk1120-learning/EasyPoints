/**
 * 员工端预览模拟数据（全端统一文件）
 *
 * 用途：
 *   1. 后端尚未提供的接口（任务/投票/规则/积分申请/申诉记录），页面兜底展示模拟数据，方便全端预览和 UI 验收；
 *   2. 本文件同时是给后端的「期望数据契约」示例：每个条目的字段即页面实际读取的字段，后端实现对应接口时按此结构返回即可。
 *
 * 生效条件（缺一不可，见文件底部 mockFallback）：
 *   - 仅 GET 请求；写操作（claim/submit/ballot/POST 申请）一律不模拟，失败会如实提示；
 *   - 仅在「接口不存在(404/501)」或「网络不可用」时兜底；接口正常返回时永远以真实数据为准；
 *   - 总开关 MOCK_SWITCH.enabled 置 false 可整体停用。
 *
 * 如何删除：
 *   后端接口全部就绪后——① 把 MOCK_SWITCH.enabled 改为 false 验证无影响；
 *   ② 删除本文件；③ 删除 api.js 中 import mockFallback 的两处引用（搜 "mock" 即可定位）。
 */

export const MOCK_SWITCH = { enabled: true }

const now = Date.now()
const daysLater = (n) => new Date(now + n * 86400000).toISOString()
const daysAgo = (n) => new Date(now - n * 86400000).toISOString()

/* ── 任务大厅：GET /miniapp/tasks?scope=all|mine ──
   字段：id, title, description, status(open|in_progress|pending_review|approved|rejected...),
   statusText(可选), rewardPoints, deadline */
const TASKS_ALL = [
  {
    id: 'task-001',
    title: '10月客户回访：重点客户满意度调研',
    description: '完成 3 家重点客户回访并提交调研纪要，回访记录需客户确认。',
    status: 'open',
    rewardPoints: 50,
    deadline: daysLater(7)
  },
  {
    id: 'task-002',
    title: '新人导师带教：Q4 新员工入职辅导',
    description: '担任 1 名 Q4 入职新员工的导师，完成首周带教并提交带教记录。',
    status: 'open',
    rewardPoints: 30,
    deadline: daysLater(14)
  },
  {
    id: 'task-003',
    title: '流程优化提案：报销审批链路提速',
    description: '针对当前报销审批流程提出优化方案，需包含现状分析与预期收益。',
    status: 'in_progress',
    rewardPoints: 80,
    deadline: daysLater(3)
  },
  {
    id: 'task-004',
    title: '知识库建设：常见问题文档整理',
    description: '整理本岗位常见问题 20 条并录入部门知识库。',
    status: 'pending_review',
    statusText: '待审核',
    rewardPoints: 20
  },
  {
    id: 'task-005',
    title: '9月团建活动组织',
    description: '组织部门团建并完成费用核销与总结归档。',
    status: 'approved',
    rewardPoints: 40
  }
]
const TASKS_MINE = ['task-003', 'task-004', 'task-005']

/* ── 投票：GET /miniapp/votes?scope=pending|history，GET /miniapp/votes/{id} ──
   列表字段：id, title, description, mode(single|multiple), submitted, closed, expired, deadline, relatedLabel
   详情额外：options: [{ id, text }]，已提交时返回 selectedOptionIds */
const VOTES = [
  {
    id: 'vote-001',
    title: 'Q4 团建方案评选',
    description: '从三个候选方案中选出本次季度团建的去向。',
    mode: 'single',
    submitted: false,
    deadline: daysLater(3),
    relatedLabel: '10月团队活动',
    options: [
      { id: 'v1o1', text: '周边城市两日游' },
      { id: 'v1o2', text: '市区团建 + 聚餐' },
      { id: 'v1o3', text: '趣味运动会 + 晚宴' }
    ]
  },
  {
    id: 'vote-002',
    title: '年度优秀员工评选',
    description: '多选投票，评选结果作为管理员评审参考，不自动加积分。',
    mode: 'multiple',
    submitted: false,
    deadline: daysLater(5),
    options: [
      { id: 'v2o1', text: '张三（研发部）' },
      { id: 'v2o2', text: '李四（人事部）' },
      { id: 'v2o3', text: '王五（研发部）' },
      { id: 'v2o4', text: '赵六（市场部）' }
    ]
  },
  {
    id: 'vote-003',
    title: '9月办公耗材采购评审',
    mode: 'single',
    submitted: true,
    deadline: daysAgo(6),
    options: [
      { id: 'v3o1', text: '方案 A（供应商甲）' },
      { id: 'v3o2', text: '方案 B（供应商乙）' }
    ],
    selectedOptionIds: ['v3o1']
  },
  {
    id: 'vote-004',
    title: '中秋活动方案表决',
    mode: 'single',
    submitted: true,
    closed: true,
    deadline: daysAgo(20),
    options: [
      { id: 'v4o1', text: '游园会' },
      { id: 'v4o2', text: '晚会 + 抽奖' }
    ],
    selectedOptionIds: ['v4o2']
  }
]

/* ── 规则中心：GET /miniapp/rules，返回 [{ title, content }]，content 用换行/分号分隔条目 ── */
const RULES = [
  {
    title: '积分章程',
    content:
      '积分分实时积分与实际积分两类，实时积分用于商城兑换；\n加分与扣分均需管理员录入并填写备注，员工可在明细中查看完整原因；\n对流水有异议时，可在对应记录下发起申诉，处理结果以管理员审核结论为准。'
  },
  {
    title: '任务规则',
    content:
      '任务由管理员发布，员工自主领取后按要求提交成果；\n成果提交后进入审核，审核期间不可修改；\n审核通过的奖励积分由管理员录入流水，备注注明任务名称。'
  },
  {
    title: '商城规则',
    content:
      '兑换使用实时积分，下单后立即扣减相应额度；\n订单被驳回或取消时，积分通过退分流水自动返还；\n礼品数量有限，先兑先得，库存以页面展示为准。'
  },
  {
    title: '申诉规则',
    content:
      '申诉须针对本人积分流水发起，需说明具体理由；\n申诉预计 3 个工作日内完成处理；\n申诉通过后按审核结论调整积分，驳回时维持原流水不变。'
  }
]

/* ── 积分申请：GET /miniapp/point-applications ──
   字段：id, points, description, status(pending|approved|rejected), statusText, createdAt, updatedAt */
const APPLICATIONS = [
  {
    id: 'app-001',
    points: 20,
    description: '协助跨部门数据迁移，额外投入 2 个工作日。',
    status: 'approved',
    statusText: '已通过',
    createdAt: daysAgo(9),
    updatedAt: daysAgo(8)
  },
  {
    id: 'app-002',
    points: 10,
    description: '周末值守系统上线保障。',
    status: 'pending',
    statusText: '待审核',
    createdAt: daysAgo(2)
  },
  {
    id: 'app-003',
    points: 15,
    description: '提出办公流程优化建议并被采纳。',
    status: 'rejected',
    statusText: '未通过',
    createdAt: daysAgo(15),
    updatedAt: daysAgo(14)
  }
]

/* ── 申诉记录：GET /miniapp/appeals（提交仍走已有 POST /miniapp/appeals，带本人 pointRecordId） ──
   字段：id, pointRecordId, reason, status(pending|approved|rejected), statusText,
   resolution(驳回/维持时的处理意见), createdAt */
const APPEALS = [
  {
    id: 'apl-001',
    pointRecordId: 2,
    reason: '10月考勤扣分有异议：当天例会已提前请假，有审批记录可查。',
    status: 'pending',
    statusText: '处理中',
    createdAt: daysAgo(1)
  },
  {
    id: 'apl-002',
    pointRecordId: 2,
    reason: '8月考勤扣分申诉',
    status: 'rejected',
    statusText: '已驳回',
    resolution: '以考勤系统记录为准，扣分维持。',
    createdAt: daysAgo(30)
  },
  {
    id: 'apl-003',
    pointRecordId: 3,
    reason: '创新奖分值偏低，提案被采纳后有额外产出。',
    status: 'approved',
    statusText: '已通过',
    createdAt: daysAgo(12)
  }
]

/* ── 字段级补丁：接口真实存在但缺契约字段时，补演示值（只填缺失字段，真实值永远优先） ──
   例：/miniapp/home 已上线但未返回 actualPoints，这里补一个演示值让「实际积分」可预览；
   后端补上该字段后，此补丁自动失效（真实值非空时不覆盖）。 */
const MOCK_FIELD_PATCH = {
  'GET /miniapp/home': { actualPoints: 1860 }
}

/* 路径 → 数据。key 必须带方法前缀；以 / 结尾的 key 按前缀匹配（用于 {id} 详情路由）。 */
const MOCK_API = {
  'GET /miniapp/tasks': (path) => (/scope=mine/.test(path) ? TASKS_ALL.filter((t) => TASKS_MINE.includes(t.id)) : TASKS_ALL),
  'GET /miniapp/votes': (path) => {
    const list = /scope=history/.test(path) ? VOTES.filter((v) => v.submitted || v.closed) : VOTES.filter((v) => !v.submitted && !v.closed)
    return list.map(({ options, selectedOptionIds, ...rest }) => rest)
  },
  'GET /miniapp/votes/': (path) => {
    const id = decodeURIComponent(String(path).split('/').pop() || '')
    const vote = VOTES.find((v) => v.id === id)
    if (!vote) return null
    return { ...vote }
  },
  'GET /miniapp/rules': RULES,
  'GET /miniapp/point-applications': APPLICATIONS,
  'GET /miniapp/appeals': APPEALS
}

/**
 * 请求层兜底入口（api.js 的 request / requestPaged 在 catch 里调用）。
 * 返回 null 表示不兜底，原错误照常抛出。
 */
export function mockFallback(path, method, error) {
  if (!MOCK_SWITCH.enabled) return null
  if (String(method || 'GET').toUpperCase() !== 'GET') return null
  const msg = String(error?.message || '')
  const fallbackAllowed = Boolean(error?.isNetworkError) || /接口不存在|404|未实现|501/.test(msg)
  if (!fallbackAllowed) return null

  const clean = String(path || '').split('?')[0]
  let hit = MOCK_API[`GET ${clean}`]
  if (hit == null) {
    for (const key of Object.keys(MOCK_API)) {
      if (key.endsWith('/') && `GET ${clean}`.startsWith(key)) {
        hit = MOCK_API[key]
        break
      }
    }
  }
  if (hit == null) return null

  const data = typeof hit === 'function' ? hit(String(path)) : hit
  if (data == null) return null
  return JSON.parse(JSON.stringify(data))
}

/**
 * 字段级补丁入口（api.js 在 GET 成功后调用）：data 是真实接口返回，
 * 只补其中缺失/为空的字段，已有真实值一律不覆盖。无需补丁时原样返回。
 */
export function mockFieldPatch(path, data) {
  if (!MOCK_SWITCH.enabled) return data
  if (data == null || typeof data !== 'object' || Array.isArray(data)) return data
  const clean = String(path || '').split('?')[0]
  const patch = MOCK_FIELD_PATCH[`GET ${clean}`]
  if (!patch) return data
  let touched = false
  const merged = { ...data }
  for (const key of Object.keys(patch)) {
    if (merged[key] == null || merged[key] === '') {
      merged[key] = patch[key]
      touched = true
    }
  }
  return touched ? merged : data
}
