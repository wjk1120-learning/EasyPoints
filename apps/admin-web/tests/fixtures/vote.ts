/**
 * vote 域测试 fixture：字段与时间格式严格按 docs/Easy-Points-API.md 9.1 响应示例。
 */

export const VOTES_FIXTURE = [
  {
    id: 11,
    title: "月度之星评选",
    description: "本月之星投票",
    voteType: "single",
    relatedType: "",
    relatedId: null,
    relatedLabel: null,
    startTime: "2026-10-08 09:00",
    endTime: "2026-10-12 18:00",
    closed: false,
    participantCount: 5,
    participantIds: [1, 2, 3, 4, 5],
    submittedCount: 3,
    status: "ended",
    options: [
      { id: 101, text: "张三" },
      { id: 102, text: "李四" },
    ],
    participantNames: ["张三", "李四", "王五", "赵六", "钱七"],
    createdBy: 1,
    createdAt: "2026-10-07 10:00:00",
    updatedAt: "2026-10-07 10:00:00",
    submittedByMe: false,
  },
  {
    id: 12,
    title: "团建活动选址（进行中）",
    description: "下周团建去哪儿",
    voteType: "multiple",
    relatedType: "",
    relatedId: null,
    relatedLabel: null,
    startTime: "2026-10-01 09:00",
    endTime: "2027-01-01 18:00",
    closed: false,
    participantCount: 2,
    participantIds: [1, 2],
    submittedCount: 1,
    status: "in_progress",
    options: [
      { id: 201, text: "爬山" },
      { id: 202, text: "泡温泉" },
    ],
    participantNames: ["张三", "李四"],
    createdBy: 1,
    createdAt: "2026-09-30 10:00:00",
    updatedAt: "2026-09-30 10:00:00",
    submittedByMe: false,
  },
] as const

export const VOTE_STATS_FIXTURE = {
  totalParticipants: 5,
  submittedCount: 3,
  participationRate: 60,
  optionStats: [
    { optionId: 101, text: "张三", votes: 2, percent: 66.67 },
    { optionId: 102, text: "李四", votes: 1, percent: 33.33 },
  ],
  details: [{ employeeId: 1, employeeName: "张三", selectedTexts: ["张三"], submittedAt: "2026-10-10 09:30:00" }],
} as const
