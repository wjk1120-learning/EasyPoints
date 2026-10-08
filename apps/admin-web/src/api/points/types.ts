/** points 域类型：积分录入请求参数 */

/** 单笔人工加减分：type=reward/penalty，pointsDelta 统一正数由后端按 type 定符号 */
export interface AdjustmentPayload {
  employeeId: number
  type: "reward" | "penalty" | string
  pointsDelta: number
  /** 备注：后端强校验，为空直接拒绝（业务底线） */
  remark: string
}

/** 月度批量录分：统一备注 + 单人备注覆盖 */
export interface MonthlyBatchPayload {
  /** 月份 YYYY-MM */
  month: string
  batchRemark: string
  items: { employeeId: number; pointsDelta: number; remark: string }[]
}
