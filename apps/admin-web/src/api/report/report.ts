import type { Paged } from "../types"
import type { PointRecord, RecordQuery } from "./types"
import { download, get } from "../../utils/request"

/** 积分明细报表 REST 路径（apps/api/src/app.js） */
export const ReportApi = {
  Records: "/admin/reports/point-records",
  RecordsXlsx: "/admin/reports/point-records.xlsx",
} as const

/** 全量流水（旧接口，工作台计数用） */
export function reports(): Promise<PointRecord[]> {
  return get<PointRecord[]>(ReportApi.Records)
}

/** 分页流水（支持员工/月份筛选） */
export function reportsPaged(params: RecordQuery): Promise<Paged<PointRecord>> {
  return get<Paged<PointRecord>>(ReportApi.Records, { ...params })
}

/** 导出积分明细 Excel（含备注列；文件名带日期戳） */
export async function exportPointRecordsXlsx(params: RecordQuery = {}): Promise<Blob> {
  return download(ReportApi.RecordsXlsx, { ...params })
}
