/**
 * 跨域公共类型（仅放多个域共用的传输层泛型）。
 * 各业务域的请求参数/响应数据类型一律写在各自域目录的 types.ts 里，如 src/api/auth/types.ts。
 */

/** 分页结构：新后端 PageResult{total,rows} 由 request 层 requestPaged 统一转换为本结构（page/pageSize 从请求参数回填），页面层无感知 */
export interface Paged<T> {
  data: T[]
  meta: {
    total: number
    page: number
    pageSize: number
  }
}
