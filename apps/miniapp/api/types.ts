/**
 * 跨域公共类型（仅放多个域共用的传输层泛型）。
 * 各业务域的请求参数/响应数据类型一律写在各自域目录的 types.ts 里，如 src/api/auth/types.ts。
 */

/** 分页结构：现状老信封 { data, meta }（meta 形状随接口而异）；第 2 步切新后端 PageResult{total,rows} 后收紧 meta 类型 */
export interface Paged<T> {
  data: T
  meta: unknown
}
