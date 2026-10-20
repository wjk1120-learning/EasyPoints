/** L2/L3 fixtures：契约 2.1 我的积分明细（按月分组 Map<月份, PointRecord[]>），形状对齐 docs/Easy-Points-API.md 示例 */

export type PointRecordFixture = {
  id: number
  employeeId: number
  pointsDelta: number
  cumulativePointsDelta?: number
  type: string
  sourceType: string
  operatorName: string
  remark: string
  reversalOfId?: number | null
  occurredAt: string
  createdAt: string
  month: string
}

let seq = 1000;

/** 构造一条流水 */
export function makeRecord(overrides: Partial<PointRecordFixture> = {}): PointRecordFixture {
  seq += 1;
  return {
    id: seq,
    employeeId: 1,
    pointsDelta: 10,
    cumulativePointsDelta: 10,
    type: "performance",
    sourceType: "task_reward",
    operatorName: "系统管理员",
    remark: `流水 #${seq}`,
    reversalOfId: null,
    occurredAt: `2026-10-${String((seq % 28) + 1).padStart(2, "0")} 12:00:00`,
    createdAt: `2026-10-${String((seq % 28) + 1).padStart(2, "0")} 12:00:01`,
    month: "2026-10",
    ...overrides
  };
}

/** 大数据集：45 条（撑起上拉加载 20+20+5 的窗口流转）
 *  构成：40 条任务奖励（积分增加）+ 3 条人工扣分（人工奖惩）+ 2 条兑换（积分消耗） */
export function buildLargeMonthGroups(): Record<string, PointRecordFixture[]> {
  const oct: PointRecordFixture[] = [];
  for (let i = 0; i < 40; i++) {
    oct.push(makeRecord({ pointsDelta: 10 + i, occurredAt: `2026-10-${String((i % 28) + 1).padStart(2, "0")} 12:00:00`, remark: `任务奖励 #${i}` }));
  }
  oct.push(makeRecord({ pointsDelta: -5, type: "penalty", sourceType: "manual_adjustment", remark: "人工扣分：迟到", occurredAt: "2026-10-05 09:00:00" }));
  oct.push(makeRecord({ pointsDelta: -3, type: "penalty", sourceType: "manual_adjustment", remark: "人工扣分：周报迟交", occurredAt: "2026-10-06 09:00:00" }));
  oct.push(makeRecord({ pointsDelta: -200, type: "exchange", sourceType: "exchange", remark: "兑换：颈椎按摩仪", occurredAt: "2026-10-07 10:00:00" }));
  oct.push(makeRecord({ pointsDelta: -1, type: "reversal", sourceType: "reversal", reversalOfId: 3, operatorName: "系统管理员", remark: "录入错误，冲正", occurredAt: "2026-10-09 15:26:00" }));
  return { "2026-10": oct };
}
