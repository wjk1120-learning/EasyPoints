/**
 * 跨域公共类型（仅放多个域共用的传输层泛型）。
 * 各业务域的请求参数/响应数据类型一律写在各自域目录的 types.ts 里，如 src/api/auth/types.ts。
 */

/** 分页响应包装：后端所有 ?page=&pageSize= 接口统一返回 { data, meta } */
export interface Paged<T> {
  data: T[]
  meta: {
    total: number
    page: number
    pageSize: number
  }
}
