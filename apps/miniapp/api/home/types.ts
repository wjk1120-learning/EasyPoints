/** home 域类型：员工首页聚合（契约见 docs/Easy-Points-API.md 2.2 HomeVo） */
import type { PointRecordItem } from "../points/types"

export interface HomeVo {
  /** 实际积分（=pointsBalance） */
  pointsBalance?: number
  cumulativePoints?: number
  /** 累计积分（小程序契约别名，=cumulativePoints） */
  actualPoints?: number
  /** 本月积分变动（东八区自然月） */
  monthDelta?: number
  /** 未读消息数 */
  unreadMessages?: number
  recentRecords?: PointRecordItem[]
  employee?: {
    id?: number | string
    name?: string
    departmentName?: string
    title?: string
    position?: string
    employmentType?: string
  }
}
