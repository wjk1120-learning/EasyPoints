/**
 * vote 域 mock：投票管理后端接口尚未开发，前端 mock 先行。
 * 数据结构与状态机即后端实现目标（契约见 docs/admin-web-api-requirements.md 3.7）。
 * 排序契约：按创建时间倒序。
 */
import type { Vote, VoteOpLog, VotePayload, VoteQuery, VoteStats } from "../api/vote/types"
import { deriveVoteStatus } from "../utils/vote"
const at = (daysAgo: number) => new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString()
const atISO = (offsetDays: number) => new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000).toISOString()

const NAME_MAP: Record<number, string> = { 1: "张三", 2: "李四", 3: "王五", 4: "赵六", 5: "钱七" }
const nameOf = (id: number) => NAME_MAP[id] || `员工(${id})`

let nextId = 5
let nextOptionId = 100

let MOCK_VOTES: Vote[] = [
  {
    id: 1,
    title: "10月团建活动地点评选",
    description: "从三个候选地点中选出本次团建目的地",
    relatedType: "",
    voteType: "single",
    options: [
      { id: 1, text: "户外烧烤" },
      { id: 2, text: "周边徒步" },
      { id: 3, text: "温泉度假村" }
    ],
    startTime: atISO(-1),
    endTime: atISO(2),
    participantIds: [1, 2, 3, 4, 5],
    participantNames: [1, 2, 3, 4, 5].map(nameOf),
    createdBy: "系统管理员",
    createdAt: at(2),
    updatedAt: at(2)
  },
  {
    id: 2,
    title: "季度优秀员工评选",
    description: "多选，每人最多勾选 2 人",
    relatedType: "application",
    relatedId: 3,
    relatedLabel: "积分申请 #3 李四",
    voteType: "multiple",
    options: [
      { id: 4, text: "张三" },
      { id: 5, text: "王五" },
      { id: 6, text: "钱七" }
    ],
    startTime: atISO(1),
    endTime: atISO(8),
    participantIds: [1, 3],
    participantNames: [1, 3].map(nameOf),
    createdBy: "系统管理员",
    createdAt: at(1),
    updatedAt: at(1)
  },
  {
    id: 3,
    title: "新版工作服款式投票",
    description: "",
    relatedType: "",
    voteType: "single",
    options: [
      { id: 7, text: "方案 A（商务蓝）" },
      { id: 8, text: "方案 B（极简灰）" }
    ],
    startTime: atISO(-10),
    endTime: atISO(-3),
    participantIds: [1, 2, 3, 4],
    participantNames: [1, 2, 3, 4].map(nameOf),
    createdBy: "人事管理员",
    createdAt: at(12),
    updatedAt: at(12)
  },
  {
    id: 4,
    title: "周末值班意向收集",
    description: "因客户项目需要，收集周末值班意愿",
    relatedType: "task",
    relatedId: 2,
    relatedLabel: "任务 #2 新员工入职引导协助",
    voteType: "single",
    options: [
      { id: 9, text: "周六可值班" },
      { id: 10, text: "周日可值班" }
    ],
    startTime: atISO(-2),
    endTime: atISO(1),
    participantIds: [2, 4],
    participantNames: [2, 4].map(nameOf),
    closed: true,
    createdBy: "系统管理员",
    createdAt: at(3),
    updatedAt: at(1)
  }
]

/** 员工提交记录：voteId → 提交明细（提交行为发生在小程序端，管理端只读统计） */
const MOCK_SUBMISSIONS: Record<number, { employeeId: number; selected: number[]; submittedAt: string }[]> = {
  1: [
    { employeeId: 1, selected: [1], submittedAt: at(0.5) },
    { employeeId: 2, selected: [1], submittedAt: at(0.4) },
    { employeeId: 3, selected: [2], submittedAt: at(0.3) }
  ],
  3: [
    { employeeId: 1, selected: [7], submittedAt: at(9) },
    { employeeId: 3, selected: [8], submittedAt: at(8) },
    { employeeId: 4, selected: [7], submittedAt: at(7) }
  ],
  4: [{ employeeId: 2, selected: [9], submittedAt: at(1.5) }]
}

// ==============================
// 投票操作日志（PRD 5.9.3：新增日志类型「投票操作日志」，永久留存）
// ==============================
const VOTE_ACTION_TEXT: Record<string, string> = {
  "vote.created": "投票创建",
  "vote.updated": "投票编辑",
  "vote.closed": "投票关闭",
  "vote.exported": "统计导出",
  "vote.submitted": "员工提交投票"
}

let nextLogId = 1
const MOCK_VOTE_LOGS: VoteOpLog[] = []

/** 日志字段按 PRD 5.6 拆分：target=操作对象（投票标题）、content=操作内容、remark=备注详情 */
function pushVoteLog(action: string, actorText: string, voteTitle: string, content: string, remark = "") {
  MOCK_VOTE_LOGS.push({
    id: nextLogId++,
    action,
    actionText: VOTE_ACTION_TEXT[action] || action,
    actorText,
    target: `投票「${voteTitle}」`,
    content,
    remark,
    createdAt: new Date().toISOString()
  })
}

/** 投票操作日志（时间倒序） */
export function mockVoteLogs(): VoteOpLog[] {
  return MOCK_VOTE_LOGS.slice().sort((a, b) => b.id - a.id).map((item) => ({ ...item }))
}

// 种子日志：既有投票的管理动作 + 员工提交行为（remark=备注详情）
pushVoteLog("vote.created", "系统管理员", "10月团建活动地点评选", "创建单选投票，3 个选项，参与 5 人", "普通调研")
pushVoteLog("vote.created", "系统管理员", "季度优秀员工评选", "创建多选投票，2 个选项，参与 2 人", "关联：积分申请 #3")
pushVoteLog("vote.created", "人事管理员", "新版工作服款式投票", "创建单选投票，2 个选项，参与 4 人", "普通调研")
pushVoteLog("vote.submitted", "张三", "新版工作服款式投票", "员工提交投票", "所选选项：方案 A（商务蓝）")
pushVoteLog("vote.submitted", "王五", "新版工作服款式投票", "员工提交投票", "所选选项：方案 B（极简灰）")
pushVoteLog("vote.submitted", "赵六", "新版工作服款式投票", "员工提交投票", "所选选项：方案 A（商务蓝）")
pushVoteLog("vote.closed", "系统管理员", "周末值班意向收集", "手动关闭投票，员工不可再提交")
pushVoteLog("vote.submitted", "李四", "周末值班意向收集", "员工提交投票", "所选选项：周六可值班")
pushVoteLog("vote.submitted", "张三", "10月团建活动地点评选", "员工提交投票", "所选选项：户外烧烤")
pushVoteLog("vote.submitted", "李四", "10月团建活动地点评选", "员工提交投票", "所选选项：户外烧烤")
pushVoteLog("vote.submitted", "王五", "10月团建活动地点评选", "员工提交投票", "所选选项：周边徒步")

function snapshot(vote: Vote): Vote {
  return {
    ...vote,
    options: vote.options.map((option) => ({ ...option })),
    submittedCount: (MOCK_SUBMISSIONS[vote.id] || []).length
  };
}

/** 列表：创建时间倒序 + 标题模糊 + 推导状态筛选 */
export function mockVotesPaged(params: VoteQuery = {}) {
  const pendingPriority = () => 0
  let items = MOCK_VOTES.slice()
    .sort((a, b) => pendingPriority() || b.id - a.id)
    .map(snapshot)
  if (params.title) items = items.filter((item) => item.title.includes(params.title!))
  if (params.status) items = items.filter((item) => deriveVoteStatus(item) === params.status)
  const page = Number(params.page || 1)
  const pageSize = Number(params.pageSize || 50)
  return Promise.resolve({
    data: items.slice((page - 1) * pageSize, page * pageSize),
    meta: { total: items.length, page, pageSize }
  })
}

export function mockCreateVote(payload: VotePayload): Promise<Vote> {
  const vote: Vote = {
    id: nextId++,
    ...payload,
    options: payload.options.map((text, index) => ({ id: nextOptionId++, text })),
    createdBy: "当前管理员",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
  MOCK_VOTES.push(vote)
  pushVoteLog(
    "vote.created",
    "当前管理员",
    vote.title,
    `创建${vote.voteType === "single" ? "单选" : "多选"}投票，${vote.options.length} 个选项，参与 ${vote.participantIds.length} 人`,
    vote.relatedLabel || "普通调研"
  )
  return Promise.resolve(snapshot(vote))
}

/** 编辑：仅未开始允许（PRD 5.9.2）；开始后不可改题目/选项/参与人 */
export async function mockUpdateVote(id: number | string, payload: VotePayload): Promise<Vote> {
  const vote = MOCK_VOTES.find((item) => item.id === Number(id))
  if (!vote) throw new Error("投票不存在")
  if (deriveVoteStatus(vote) !== "not_started") throw new Error("仅未开始的投票可编辑")
  vote.title = payload.title
  vote.description = payload.description
  vote.relatedType = payload.relatedType
  vote.relatedId = payload.relatedId
  vote.relatedLabel = payload.relatedLabel
  vote.voteType = payload.voteType
  vote.options = payload.options.map((text, index) => ({ id: nextOptionId++, text }))
  vote.startTime = payload.startTime
  vote.endTime = payload.endTime
  vote.participantIds = payload.participantIds
  vote.participantNames = payload.participantIds.map(nameOf)
  vote.updatedAt = new Date().toISOString()
  pushVoteLog("vote.updated", "当前管理员", vote.title, `编辑投票内容（未开始阶段），现 ${vote.options.length} 个选项，参与 ${vote.participantIds.length} 人`)
  return Promise.resolve(snapshot(vote))
}

/** 手动关闭：关闭后员工不可提交，状态视为已结束 */
export async function mockCloseVote(id: number | string): Promise<unknown> {
  const vote = MOCK_VOTES.find((item) => item.id === Number(id))
  if (!vote) throw new Error("投票不存在")
  if (deriveVoteStatus(vote) === "ended") throw new Error("投票已结束，无需关闭")
  vote.closed = true
  vote.updatedAt = new Date().toISOString()
  pushVoteLog("vote.closed", "当前管理员", vote.title, "手动关闭投票，员工不可再提交")
  return Promise.resolve(null)
}

/** 导出统计写日志（导出文件由前端 CSV 生成；真实导出写日志由后端负责） */
export function mockLogVoteExported(id: number | string): void {
  const vote = MOCK_VOTES.find((item) => item.id === Number(id))
  if (vote) pushVoteLog("vote.exported", "当前管理员", vote.title, "导出投票统计结果")
}

/** 统计结果：进行中、已结束均可查看；未开始无统计 */
export function mockVoteStats(id: number | string): Promise<VoteStats> {  const vote = MOCK_VOTES.find((item) => item.id === Number(id))
  if (!vote) return Promise.reject(new Error("投票不存在"))
  if (deriveVoteStatus(vote) === "not_started") return Promise.reject(new Error("投票未开始，暂无统计结果"))
  const submissions = MOCK_SUBMISSIONS[vote.id] || []
  const optionStats = vote.options.map((option) => {
    const votes = submissions.filter((submission) => submission.selected.includes(option.id)).length
    return { text: option.text, votes, percent: submissions.length ? Math.round((votes / submissions.length) * 100) : 0 }
  })
  const details = submissions.map((submission) => ({
    employeeId: submission.employeeId,
    employeeName: nameOf(submission.employeeId),
    selectedTexts: vote.options.filter((option) => submission.selected.includes(option.id)).map((option) => option.text),
    submittedAt: submission.submittedAt
  }))
  const stats: VoteStats = {
    totalParticipants: vote.participantIds.length,
    submittedCount: submissions.length,
    participationRate: vote.participantIds.length ? Math.round((submissions.length / vote.participantIds.length) * 100) : 0,
    optionStats,
    details
  }
  return Promise.resolve(stats)
}
