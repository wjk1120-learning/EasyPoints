import type { Paged } from "../types"
import type { PointRecord, RecordQuery } from "./types"
import { download, get } from "../../utils/request"

/** 积分报表 REST 路径（契约见 docs/Easy-Points-API.md 3.4/3.5/11.5） */
export const ReportApi = {
  Records: "/admin/reports/point-records",
  RecordsXlsx: "/admin/reports/point-records.xlsx",
  /** 全员积分汇总导出（每人一行：姓名/可用积分/累计积分，累计倒序） */
  PointsSummaryXlsx: "/admin/reports/points-summary.xlsx",
} as const

export type { PointRecord, RecordQuery } from "./types"

/** 分页流水（3.4：支持月份/员工筛选） */
export function reportsPaged(params: RecordQuery): Promise<Paged<PointRecord>> {
  return get<Paged<PointRecord>>(ReportApi.Records, { ...params })
}

/**
 * 个人积分明细导出（3.5，v4.3 定稿：employeeId 必填；month 选填——缺省导出该员工全部月份流水）。
 * 列含可用/累计积分变动与完整备注，文件名由前端拼接。
 */
export function exportPointRecordsXlsx(params: RecordQuery & { employeeId: number | string; month?: string }): Promise<Blob> {
  return download(ReportApi.RecordsXlsx, { ...params })
}

/** 全员积分汇总导出（11.5：无筛选参数） */
export function exportPointsSummaryXlsx(): Promise<Blob> {
  return download(ReportApi.PointsSummaryXlsx)
}
