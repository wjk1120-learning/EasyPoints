import type { UploadResult } from "./types"
import { createNetworkError, getApiBase } from "../../utils/request"

/** 佐证图片上传 REST 路径（契约见 docs/Easy-Points-API.md 11.9） */
export const UploadApi = {
  Images: "/miniapp/uploads",
} as const

export type { UploadResult } from "./types"

/**
 * 上传一张佐证图（11.9：uni.uploadFile multipart，字段名 file）→ 返回相对路径 url。
 * 注意 uploadFile 的 res.data 是字符串 body，需自行 JSON.parse。
 */
export function uploadImage(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    uni.uploadFile({
      url: `${getApiBase()}${UploadApi.Images}`,
      filePath,
      name: "file",
      header: { authorization: `Bearer ${uni.getStorageSync("employeeToken") || ""}` },
      success(res) {
        try {
          const body = JSON.parse(
            typeof res.data === "string" ? res.data : JSON.stringify(res.data)
          ) as { code?: number; msg?: string; data?: UploadResult | null }
          if (res.statusCode >= 200 && res.statusCode < 300 && body?.code === 1 && body.data?.url) {
            resolve(body.data.url)
          } else {
            reject(new Error(body?.msg || "上传失败"))
          }
        } catch {
          reject(new Error("上传失败"))
        }
      },
      fail(err) {
        reject(createNetworkError(err))
      }
    })
  })
}
