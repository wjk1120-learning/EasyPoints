/** upload 域类型：佐证图片上传（契约见 docs/Easy-Points-API.md 11.9，multipart 字段 file，≤5MB） */

export interface UploadResult {
  /** 相对路径（如 /uploads/ev/uuid.png），随业务提交回传 evidenceImages */
  url: string
}
