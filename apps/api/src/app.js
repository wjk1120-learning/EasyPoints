const { createStore } = require("./data/store");
const points = require("./services/points");
const appeals = require("./services/appeals");
const orders = require("./services/orders");
const wecom = require("./services/wecom");
const employeeAi = require("./services/employee-ai");
const { sendJson, readBody, getAdminId, getEmployeeId } = require("./http");
const { canManageEmployee } = require("./services/permissions");
const { scryptSync, timingSafeEqual, randomUUID, randomBytes } = require("node:crypto");
const fs = require("node:fs");
const pathModule = require("node:path");
const jwt = require("jsonwebtoken");
const XLSX = require("xlsx");

function groupByMonth(records) {
  return records.reduce((result, record) => {
    result[record.month] ||= [];
    result[record.month].push(record);
    return result;
  }, {});
}

function formatMessageStatus(status) {
  const value = String(status || "");
  if (value === "pending") return "待发送";
  if (value === "processing") return "发送中";
  if (value === "mock_sent") return "已发送";
  if (value === "failed") return "发送失败";
  return value || "未知状态";
}

function formatOrderStatus(status) {
  const value = String(status || "");
  if (value === "pending_review") return "待审核";
  if (value === "approved") return "已通过";
  if (value === "shipped") return "已发货";
  if (value === "completed") return "已完成";
  if (value === "rejected") return "已驳回";
  if (value === "cancelled") return "已取消";
  return value || "状态更新";
}

function formatAppealStatus(status) {
  const value = String(status || "");
  if (value === "pending_department_review") return "待部门审核";
  if (value === "pending_hr_review") return "待人事审核";
  if (value === "department_approved") return "部门初审通过";
  if (value === "hr_approved") return "人事审核通过";
  if (value === "department_rejected") return "部门初审驳回";
  if (value === "hr_rejected") return "人事审核驳回";
  if (value === "approved") return "申诉通过";
  if (value === "rejected") return "申诉驳回";
  return value || "申诉状态更新";
}

function formatEmployeeMessage(message) {
  const payload = message?.payload && typeof message.payload === "object" ? message.payload : {};
  let title = "系统通知";
  let summary = "您有一条新的通知，请及时查看。";

  if (message.type === "point_changed") {
    const delta = Number(payload.pointsDelta || 0);
    const deltaText = `${delta > 0 ? "+" : ""}${delta}`;
    const balanceText = payload.balance == null ? "余额待更新" : `当前余额 ${payload.balance}`;
    title = "积分变动通知";
    summary = `${deltaText} 分，${balanceText}${payload.remark ? `，备注：${payload.remark}` : ""}`;
  } else if (message.type === "order_status") {
    title = "订单状态更新";
    const parts = [];
    if (payload.giftName) parts.push(`礼品：${payload.giftName}`);
    else if (payload.orderId != null) parts.push(`订单：#${payload.orderId}`);
    if (payload.pointsCost != null && payload.pointsCost !== "") parts.push(`积分：${payload.pointsCost}`);
    parts.push(`状态：${formatOrderStatus(payload.status)}`);
    if (payload.reviewRemark) parts.push(`处理备注：${payload.reviewRemark}`);
    summary = parts.join("；");
  } else if (message.type === "appeal_result") {
    title = "申诉处理结果";
    const parts = [];
    if (payload.reason) parts.push(`申诉原因：${payload.reason}`);
    parts.push(`处理结果：${formatAppealStatus(payload.status)}`);
    if (payload.resultRemark) parts.push(`处理备注：${payload.resultRemark}`);
    summary = parts.join("；");
  } else if (payload.remark) {
    summary = String(payload.remark);
  } else if (Object.keys(payload).length) {
    summary = JSON.stringify(payload);
  }

  return {
    id: message.id,
    type: message.type,
    status: message.status,
    statusText: formatMessageStatus(message.status),
    isRead: Boolean(message.readAt),
    readAt: message.readAt || null,
    title,
    summary,
    createdAt: message.createdAt,
    updatedAt: message.updatedAt
  };
}

function formatOperationAction(action, payload = {}) {
  const value = String(action || "");
  if (value === "order.created") return "订单创建";
  if (value === "order.status_changed") return "订单状态变更";
  if (value === "point_record.created") {
    if (payload.sourceType === "mall_order_refund" || payload.type === "refund") return "积分回退";
    if (payload.sourceType === "mall_order" || payload.type === "exchange") return "积分扣减";
    if (payload.type === "reward") return "积分加分";
    if (payload.type === "penalty") return "积分扣减";
    if (payload.type === "performance") return "绩效录分";
    if (payload.type === "reversal") return "积分冲正";
    return "积分变动";
  }
  if (value === "appeal.created") return "发起申诉";
  if (value === "appeal.reviewed") return "申诉处理";
  if (value === "gift.created") return "礼品创建";
  if (value === "gift.updated") return "礼品编辑";
  if (value === "gift.published") return "礼品上架";
  if (value === "gift.unpublished") return "礼品下架";
  if (value === "gift.cover_uploaded") return "封面上传";
  return value || "未知动作";
}

function normalizeLogPayload(payload) {
  return payload && typeof payload === "object" ? payload : {};
}

function formatPointsNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? Math.abs(number) : 0;
}

function buildEmployeeLabel(employeeId, context) {
  const id = Number(employeeId);
  if (!Number.isFinite(id)) return `用户 ${employeeId ?? "-"}`;
  const employee = context.employeeMap.get(id);
  return employee ? `${employee.name} (${employee.id})` : `用户 ${id}`;
}

function getRefundSourceLabel(payload = {}) {
  const remark = String(payload.remark || "");
  if (remark.includes("驳回")) return "订单驳回";
  if (remark.includes("取消")) return "订单取消";
  return "订单退回";
}

function formatOperationSummary(log, context) {
  const payload = normalizeLogPayload(log.payload);
  switch (String(log.action || "")) {
    case "order.created":
      return `创建兑换订单 ID:${payload.id ?? "-"}，礼品：${payload.giftName || "-"}，扣减积分 ${payload.pointsCost ?? "-"}`;
    case "order.status_changed":
      return `订单 ID:${payload.orderId ?? "-"} 状态从「${formatOrderStatus(payload.previous)}」变更为「${formatOrderStatus(payload.status)}」`;
    case "point_record.created":
      if (payload.sourceType === "mall_order" || payload.type === "exchange") {
        return `扣减${buildEmployeeLabel(payload.employeeId, context)} 积分 ${formatPointsNumber(payload.pointsDelta)} 分，来源：兑换订单 ID:${payload.sourceId ?? "-"}`;
      }
      if (payload.sourceType === "mall_order_refund" || payload.type === "refund") {
        return `回退${buildEmployeeLabel(payload.employeeId, context)} 积分 ${formatPointsNumber(payload.pointsDelta)} 分，来源：${getRefundSourceLabel(payload)} ID:${payload.sourceId ?? "-"}`;
      }
      if (payload.sourceType === "manual_adjustment") {
        return `${Number(payload.pointsDelta || 0) >= 0 ? "增加" : "扣减"}${buildEmployeeLabel(payload.employeeId, context)} 积分 ${formatPointsNumber(payload.pointsDelta)} 分${payload.remark ? `，备注：${payload.remark}` : ""}`;
      }
      if (payload.sourceType === "monthly_performance") {
        return `为${buildEmployeeLabel(payload.employeeId, context)}录入 ${payload.sourceId || "-"} 月绩效积分 ${payload.pointsDelta ?? "-"} 分${payload.remark ? `，备注：${payload.remark}` : ""}`;
      }
      if (payload.sourceType === "reversal" || payload.type === "reversal") {
        return `冲正${buildEmployeeLabel(payload.employeeId, context)} 积分 ${formatPointsNumber(payload.pointsDelta)} 分，原流水 ID:${payload.reversalOfId ?? payload.sourceId ?? "-"}`;
      }
      return `${buildEmployeeLabel(payload.employeeId, context)} 积分变动 ${payload.pointsDelta ?? "-"} 分${payload.remark ? `，备注：${payload.remark}` : ""}`;
    case "appeal.created":
      return `${buildEmployeeLabel(payload.employeeId, context)} 针对流水 ID:${payload.pointRecordId ?? "-"} 发起申诉，原因：${payload.reason || "-"}`;
    case "appeal.reviewed":
      return `申诉 ID:${payload.id ?? "-"} 处理为「${formatAppealStatus(payload.status)}」${payload.resultRemark ? `，备注：${payload.resultRemark}` : ""}`;
    case "gift.created":
      return `创建礼品 ID:${payload.id ?? "-"}，名称：${payload.name || "-"}`;
    case "gift.updated":
      return `更新礼品 ID:${payload.id ?? "-"}${payload.name ? `，名称：${payload.name}` : ""}`;
    case "gift.published":
      return `上架礼品 ID:${payload.id ?? "-"}`;
    case "gift.unpublished":
      return `下架礼品 ID:${payload.id ?? "-"}`;
    case "gift.cover_uploaded":
      return `上传礼品 ID:${payload.id ?? "-"} 的封面图`;
    default:
      return Object.keys(payload).length ? JSON.stringify(payload) : "无摘要";
  }
}

function getOperationTraceKey(log) {
  const payload = normalizeLogPayload(log.payload);
  if (payload.traceId) return String(payload.traceId);
  if (log.action === "order.created") return `order-create-${payload.id ?? log.id}`;
  if (log.action === "order.status_changed") {
    const timeKey = String(log.createdAt || "").slice(0, 19).replace(/[-:TZ]/g, "");
    return `order-status-${payload.orderId ?? log.id}-${timeKey}`;
  }
  if (log.action === "point_record.created") {
    if (payload.sourceType === "mall_order") return `order-create-${payload.sourceId ?? log.id}`;
    if (payload.sourceType === "mall_order_refund") {
      const timeKey = String(log.createdAt || "").slice(0, 19).replace(/[-:TZ]/g, "");
      return `order-status-${payload.sourceId ?? log.id}-${timeKey}`;
    }
    if (payload.sourceType === "reversal" || payload.type === "reversal") {
      return `point-reversal-${payload.reversalOfId ?? payload.sourceId ?? log.id}`;
    }
  }
  if (log.action === "appeal.created") return `appeal-create-${payload.id ?? log.id}`;
  if (log.action === "appeal.reviewed") return `appeal-review-${payload.id ?? log.id}`;
  return `${log.action || "log"}-${payload.id ?? log.id}`;
}

function buildTraceId(log) {
  const date = new Date(log.createdAt || Date.now());
  const datePart = Number.isNaN(date.getTime()) ? "00000000" : date.toISOString().slice(0, 10).replace(/-/g, "");
  const traceKey = getOperationTraceKey(log)
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
  return traceKey.startsWith("trace-") ? traceKey : `trace-${datePart}-${traceKey || log.id}`;
}

async function buildActorLabel(log, context) {
  const payload = normalizeLogPayload(log.payload);
  const actorId = log.actorId;
  if (actorId == null || String(actorId) === "system" || payload.operatorName === "系统") return "系统";

  // 员工发起的订单与申诉优先展示员工身份，避免与管理员 ID 混淆。
  if (log.action === "order.created" || log.action === "appeal.created") {
    return buildEmployeeLabel(payload.employeeId ?? actorId, context);
  }

  const adminId = Number(actorId);
  if (Number.isFinite(adminId)) {
    if (!context.adminCache.has(adminId)) {
      context.adminCache.set(adminId, await context.store.getAdmin(adminId));
    }
    const admin = context.adminCache.get(adminId);
    if (admin) return `${admin.name} (${admin.id})`;
  }

  return buildEmployeeLabel(actorId, context);
}

async function enrichOperationLogs(store, rows) {
  const employees = await store.listEmployees();
  const context = {
    store,
    employeeMap: new Map(employees.map((item) => [Number(item.id), item])),
    adminCache: new Map()
  };

  return Promise.all(
    (rows || []).map(async (log) => ({
      ...log,
      traceId: buildTraceId(log),
      actionText: formatOperationAction(log.action, normalizeLogPayload(log.payload)),
      actorText: await buildActorLabel(log, context),
      businessSummary: formatOperationSummary(log, context),
      resultText: "成功"
    }))
  );
}

function getUploadDir() {
  const configured = process.env.UPLOAD_DIR ? String(process.env.UPLOAD_DIR) : "";
  if (configured) return pathModule.resolve(configured);
  return pathModule.resolve(__dirname, "..", "uploads");
}

function guessContentTypeByExt(ext) {
  const value = String(ext || "").toLowerCase();
  if (value === ".jpg" || value === ".jpeg") return "image/jpeg";
  if (value === ".png") return "image/png";
  if (value === ".webp") return "image/webp";
  if (value === ".gif") return "image/gif";
  return "application/octet-stream";
}

async function readRawBody(req, options = {}) {
  const limit = Number(options.limitBytes || 5 * 1024 * 1024);
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (Number.isFinite(limit) && limit > 0 && size > limit) {
      const error = new Error("文件过大");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function parseMultipart(bodyBuffer, boundary) {
  const boundaryText = `--${boundary}`;
  const text = bodyBuffer.toString("latin1");
  const parts = text.split(boundaryText);
  const files = [];
  const fields = {};

  for (const part of parts) {
    let chunk = part;
    if (chunk.startsWith("\r\n")) chunk = chunk.slice(2);
    if (chunk.endsWith("\r\n")) chunk = chunk.slice(0, -2);
    if (!chunk || chunk === "--" || chunk.startsWith("--\r\n")) continue;
    if (chunk.startsWith("--")) continue;
    const headerIndex = chunk.indexOf("\r\n\r\n");
    if (headerIndex < 0) continue;
    const headersText = chunk.slice(0, headerIndex);
    let bodyText = chunk.slice(headerIndex + 4);
    if (bodyText.endsWith("\r\n")) bodyText = bodyText.slice(0, -2);

    const headers = {};
    for (const line of headersText.split("\r\n")) {
      const idx = line.indexOf(":");
      if (idx < 0) continue;
      const key = line.slice(0, idx).trim().toLowerCase();
      const value = line.slice(idx + 1).trim();
      headers[key] = value;
    }

    const disposition = headers["content-disposition"] || "";
    const nameMatch = disposition.match(/name="([^"]+)"/i);
    if (!nameMatch) continue;
    const fieldName = nameMatch[1];
    const filenameMatch = disposition.match(/filename="([^"]*)"/i);
    if (!filenameMatch) {
      fields[fieldName] = Buffer.from(bodyText, "latin1").toString("utf8");
      continue;
    }

    const filename = filenameMatch[1] || "";
    const contentType = headers["content-type"] || "";
    const data = Buffer.from(bodyText, "latin1");
    files.push({ fieldName, filename, contentType, data });
  }

  return { fields, files };
}

function requireMallAdmin(admin) {
  if (!admin || (admin.role !== "super_admin" && admin.role !== "hr_admin")) {
    const error = new Error("无权操作礼品");
    error.statusCode = 403;
    throw error;
  }
}

function createApp(store = createStore()) {
  async function handler(req, res) {
    if (req.method === "OPTIONS") return sendJson(res, 204, {});

    try {
      const url = new URL(req.url, "http://localhost");
      const path = url.pathname;

      if (req.method === "GET" && path.startsWith("/uploads/")) {
        const uploadDir = getUploadDir();
        const rel = path.slice("/uploads/".length);
        const safeRel = rel.replace(/\\/g, "/").replace(/^\/+/, "");
        const abs = pathResolveSafe(uploadDir, safeRel);
        if (!abs) return sendJson(res, 404, { message: "文件不存在" });
        if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) return sendJson(res, 404, { message: "文件不存在" });
        const ext = pathModuleExtname(abs);
        const contentType = guessContentTypeByExt(ext);
        res.writeHead(200, {
          "content-type": contentType,
          "cache-control": "public, max-age=31536000, immutable"
        });
        fs.createReadStream(abs).pipe(res);
        return;
      }

      if (req.method === "GET" && path === "/health") {
        const health = { ok: true, service: "easy-points-api", driver: store.driver || "memory" };
        if (store.driver === "mysql") {
          try {
            await store.listEmployees();
            health.db = "ok";
          } catch {
            health.db = "error";
            health.ok = false;
          }
        }
        return sendJson(res, 200, health);
      }

      if (req.method === "POST" && path === "/admin/auth/login") {
        const body = await readBody(req);
        const admin = await store.findAdminByUsername(body.username);
        if (!admin) return sendJson(res, 401, { message: "账号或密码错误" });
        if (!verifyPassword(body.password, admin)) return sendJson(res, 401, { message: "账号或密码错误" });
        const token = jwt.sign(
          { typ: "admin", sub: String(admin.id), role: admin.role },
          process.env.JWT_SECRET || "change-me",
          { expiresIn: "12h" }
        );
        const safeAdmin = {
          id: admin.id,
          username: admin.username,
          name: admin.name,
          role: admin.role,
          departmentIds: admin.departmentIds
        };
        return sendJson(res, 200, { token, admin: safeAdmin });
      }

      if (req.method === "GET" && path === "/admin/employees") {
        const admin = await requireAdmin(req, store);
        const employees = await store.listEmployees();
        const filtered = filterEmployeesByAdmin(admin, employees);
        if (!isPaginationRequested(url)) return sendJson(res, 200, { data: filtered });
        const meta = getPagination(url, filtered.length);
        return sendJson(res, 200, { data: filtered.slice(meta.offset, meta.offset + meta.pageSize), meta });
      }

      if (req.method === "GET" && path === "/admin/mall/gifts") {
        const admin = await requireAdmin(req, store);
        requireMallAdmin(admin);
        const gifts = await store.listGifts();
        return sendJson(res, 200, { data: gifts });
      }

      if (req.method === "POST" && path === "/admin/mall/gifts") {
        const admin = await requireAdmin(req, store);
        requireMallAdmin(admin);
        if (typeof store.createGift !== "function") return sendJson(res, 501, { message: "礼品创建未实现" });
        const body = await readBody(req);
        const created = await store.createGift({
          name: body.name,
          pointsCost: body.pointsCost,
          stock: body.stock,
          status: body.status,
          limitPerUser: body.limitPerUser
        });
        if (!created) return sendJson(res, 400, { message: "礼品参数不合法" });
        await store.log("gift.created", admin.id, { id: created.id, name: created.name });
        return sendJson(res, 201, { data: created });
      }

      if (req.method === "PUT" && path.startsWith("/admin/mall/gifts/")) {
        const admin = await requireAdmin(req, store);
        requireMallAdmin(admin);
        const giftId = path.split("/")[4];
        if (path.split("/").length !== 5) return sendJson(res, 404, { message: "接口不存在" });
        if (typeof store.updateGift !== "function") return sendJson(res, 501, { message: "礼品更新未实现" });
        const body = await readBody(req);
        const updated = await store.updateGift(giftId, {
          name: body.name,
          pointsCost: body.pointsCost,
          stock: body.stock,
          status: body.status,
          limitPerUser: body.limitPerUser
        });
        if (!updated) return sendJson(res, 400, { message: "礼品不存在或参数不合法" });
        await store.log("gift.updated", admin.id, { id: updated.id });
        return sendJson(res, 200, { data: updated });
      }

      if (req.method === "POST" && path.startsWith("/admin/mall/gifts/") && path.endsWith("/publish")) {
        const admin = await requireAdmin(req, store);
        requireMallAdmin(admin);
        const giftId = path.split("/")[4];
        if (typeof store.updateGift !== "function") return sendJson(res, 501, { message: "礼品更新未实现" });
        const updated = await store.updateGift(giftId, { status: "active" });
        if (!updated) return sendJson(res, 404, { message: "礼品不存在" });
        await store.log("gift.published", admin.id, { id: updated.id });
        return sendJson(res, 200, { data: updated });
      }

      if (req.method === "POST" && path.startsWith("/admin/mall/gifts/") && path.endsWith("/unpublish")) {
        const admin = await requireAdmin(req, store);
        requireMallAdmin(admin);
        const giftId = path.split("/")[4];
        if (typeof store.updateGift !== "function") return sendJson(res, 501, { message: "礼品更新未实现" });
        const updated = await store.updateGift(giftId, { status: "inactive" });
        if (!updated) return sendJson(res, 404, { message: "礼品不存在" });
        await store.log("gift.unpublished", admin.id, { id: updated.id });
        return sendJson(res, 200, { data: updated });
      }

      if (req.method === "POST" && path.startsWith("/admin/mall/gifts/") && path.endsWith("/cover")) {
        const admin = await requireAdmin(req, store);
        requireMallAdmin(admin);
        const giftId = path.split("/")[4];
        if (typeof store.getGift !== "function" || typeof store.updateGift !== "function") {
          return sendJson(res, 501, { message: "礼品封面未实现" });
        }
        const gift = await store.getGift(giftId);
        if (!gift) return sendJson(res, 404, { message: "礼品不存在" });
        const contentType = String(req.headers["content-type"] || "");
        const match = contentType.match(/multipart\/form-data;\s*boundary=([^\s;]+)/i);
        if (!match) return sendJson(res, 400, { message: "请使用 multipart/form-data 上传" });
        const boundary = match[1];
        const raw = await readRawBody(req, { limitBytes: Number(process.env.UPLOAD_MAX_BYTES || 5 * 1024 * 1024) });
        const parsed = parseMultipart(raw, boundary);
        const file = parsed.files.find((f) => f.fieldName === "file") || parsed.files[0];
        if (!file || !file.data || !file.data.length) return sendJson(res, 400, { message: "请选择图片文件" });
        if (!String(file.contentType || "").toLowerCase().startsWith("image/")) {
          return sendJson(res, 400, { message: "仅支持图片文件" });
        }
        const originalExt = pathModule.extname(String(file.filename || "")).toLowerCase();
        const ext = [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(originalExt) ? originalExt : "";
        if (!ext) return sendJson(res, 400, { message: "仅支持 jpg/png/webp/gif" });

        const uploadDir = getUploadDir();
        const fileId = typeof randomUUID === "function" ? randomUUID() : randomBytes(16).toString("hex");
        const relDir = pathModule.join("gifts", String(gift.id));
        const absDir = pathModule.join(uploadDir, relDir);
        fs.mkdirSync(absDir, { recursive: true });
        const filename = `cover-${fileId}${ext}`;
        const absPath = pathModule.join(absDir, filename);
        fs.writeFileSync(absPath, file.data);
        const urlPath = `/${["uploads", "gifts", String(gift.id), filename].join("/")}`;
        const updated = await store.updateGift(gift.id, { coverImageUrl: urlPath });
        await store.log("gift.cover_uploaded", admin.id, { id: updated.id, coverImageUrl: updated.coverImageUrl });
        return sendJson(res, 200, { data: updated });
      }

      if (req.method === "POST" && path === "/admin/points/adjustment") {
        const record = await points.adjustment(store, requireAdminAccess(req), await readBody(req));
        return sendJson(res, 201, { data: record });
      }

      if (req.method === "POST" && path === "/admin/points/monthly-batch") {
        const records = await points.monthlyBatch(store, requireAdminAccess(req), await readBody(req));
        return sendJson(res, 201, { data: records });
      }

      if (req.method === "POST" && path.startsWith("/admin/points/") && path.endsWith("/reverse")) {
        const adminId = requireAdminAccess(req);
        const recordId = path.split("/")[3];
        const body = await readBody(req);
        const record = await points.reverseRecord(store, adminId, recordId, body.remark);
        return sendJson(res, 201, { data: record });
      }

      if (req.method === "GET" && path === "/admin/reports/point-records") {
        const admin = await requireAdmin(req, store);
        if (isPaginationRequested(url) && typeof store.listPointRecordsWithEmployeePaged === "function") {
          const options = {
            page: url.searchParams.get("page"),
            pageSize: url.searchParams.get("pageSize"),
            employeeId: url.searchParams.get("employeeId"),
            month: url.searchParams.get("month"),
            departmentIds: admin.role === "super_admin" || admin.role === "hr_admin" ? null : admin.departmentIds
          };
          const result = await store.listPointRecordsWithEmployeePaged(options);
          const rows = filterReportRowsByAdmin(admin, result.rows);
          const meta = { total: result.total, page: result.page, pageSize: result.pageSize };
          return sendJson(res, 200, { data: rows, meta });
        }

        if (typeof store.listPointRecordsWithEmployee === "function") {
          const data = await store.listPointRecordsWithEmployee();
          const rows = filterReportRowsByAdmin(admin, data);
          if (!isPaginationRequested(url)) return sendJson(res, 200, { data: rows });
          const meta = getPagination(url, rows.length);
          return sendJson(res, 200, { data: rows.slice(meta.offset, meta.offset + meta.pageSize), meta });
        }

        const records = await store.listPointRecords();
        const employees = await store.listEmployees();
        const byId = new Map(employees.map((e) => [e.id, e]));
        const rows = filterReportRowsByAdmin(
          admin,
          records.map((record) => ({
            ...record,
            employeeName: byId.get(record.employeeId)?.name || "",
            departmentId: byId.get(record.employeeId)?.departmentId || ""
          }))
        );
        if (!isPaginationRequested(url)) return sendJson(res, 200, { data: rows });
        const meta = getPagination(url, rows.length);
        return sendJson(res, 200, { data: rows.slice(meta.offset, meta.offset + meta.pageSize), meta });
      }

      if (req.method === "GET" && path === "/admin/reports/point-records.xlsx") {
        const admin = await requireAdmin(req, store);
        const data =
          typeof store.listPointRecordsWithEmployee === "function"
            ? await store.listPointRecordsWithEmployee()
            : await store.listPointRecords();
        const rows = filterReportRowsByAdmin(admin, data).map((record) => ({
          员工: record.employeeName || record.employeeId,
          部门: record.departmentId || "",
          分值: record.pointsDelta,
          类型: record.type,
          操作人: record.operatorName,
          时间: record.occurredAt,
          备注: record.remark,
          来源类型: record.sourceType,
          来源ID: record.sourceId,
          冲正原流水ID: record.reversalOfId || ""
        }));
        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(rows);
        XLSX.utils.book_append_sheet(workbook, worksheet, "积分流水");
        const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
        return sendFile(res, 200, buffer, {
          contentType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          filename: `point-records-${new Date().toISOString().slice(0, 10)}.xlsx`
        });
      }

      if (req.method === "GET" && path === "/admin/operation-logs") {
        requireAdminAccess(req);
        if (isPaginationRequested(url) && typeof store.listOperationLogsPaged === "function") {
          const result = await store.listOperationLogsPaged({
            page: url.searchParams.get("page"),
            pageSize: url.searchParams.get("pageSize")
          });
          const data = await enrichOperationLogs(store, result.rows);
          return sendJson(res, 200, { data, meta: { total: result.total, page: result.page, pageSize: result.pageSize } });
        }
        const data = await enrichOperationLogs(store, await store.listOperationLogs());
        if (!isPaginationRequested(url)) return sendJson(res, 200, { data });
        const meta = getPagination(url, data.length);
        return sendJson(res, 200, { data: data.slice(meta.offset, meta.offset + meta.pageSize), meta });
      }

      if (req.method === "GET" && path === "/admin/badges") {
        const admin = await requireAdmin(req, store);
        if (typeof store.listAppealsPaged !== "function" || typeof store.listOrdersPaged !== "function") {
          return sendJson(res, 501, { message: "角标统计未实现" });
        }

        const employees = await store.listEmployees();
        const allowedEmployees = filterEmployeesByAdmin(admin, employees);
        const departmentIds = admin.role === "super_admin" || admin.role === "hr_admin" ? null : admin.departmentIds;
        const employeeIds = allowedEmployees.map((e) => e.id);

        const pendingAppeals = await store.listAppealsPaged({
          page: 1,
          pageSize: 1,
          status: "pending_department_review",
          departmentIds,
          employeeIds
        });
        const pendingHrAppeals = await store.listAppealsPaged({
          page: 1,
          pageSize: 1,
          status: "pending_hr_review",
          departmentIds,
          employeeIds
        });
        const pendingOrders = await store.listOrdersPaged({
          page: 1,
          pageSize: 1,
          status: "pending_review",
          departmentIds,
          employeeIds
        });

        return sendJson(res, 200, {
          data: {
            appealsUnread: Number(pendingAppeals.total || 0) + Number(pendingHrAppeals.total || 0),
            ordersUnread: Number(pendingOrders.total || 0)
          }
        });
      }

      if (req.method === "POST" && path === "/admin/badges/mark-seen") {
        const admin = await requireAdmin(req, store);
        if (typeof store.setAdminSeenAt !== "function") return sendJson(res, 501, { message: "角标未读状态未实现" });
        const body = await readBody(req);
        const keys = Array.isArray(body?.keys)
          ? body.keys.map(String)
          : body?.key
            ? [String(body.key)]
            : [];
        const allowed = new Set(["appeals", "orders"]);
        const seenAt = store.now();
        const result = {};
        for (const key of keys) {
          const normalized = String(key || "").trim();
          if (!allowed.has(normalized)) continue;
          result[normalized] = await store.setAdminSeenAt(admin.id, normalized, seenAt);
        }
        return sendJson(res, 200, { data: { seenAt: result } });
      }

      if (req.method === "GET" && path === "/admin/appeals") {
        const admin = await requireAdmin(req, store);
        const status = url.searchParams.get("status");
        const employeeId = url.searchParams.get("employeeId");
        const employees = await store.listEmployees();
        const allowedEmployees = filterEmployeesByAdmin(admin, employees);
        const employeeById = new Map(employees.map((e) => [e.id, e]));

        async function enrichAppeals(items) {
          const rows = await Promise.all(
            (items || []).map(async (row) => {
              const employee = employeeById.get(row.employeeId);
              const record = await store.getPointRecord(row.pointRecordId);
              return { ...row, employeeName: employee?.name || "", pointRecord: record || null };
            })
          );
          return rows;
        }
        if (isPaginationRequested(url) && typeof store.listAppealsPaged === "function") {
          const options = {
            page: url.searchParams.get("page"),
            pageSize: url.searchParams.get("pageSize"),
            status,
            employeeId,
            departmentIds: admin.role === "super_admin" || admin.role === "hr_admin" ? null : admin.departmentIds,
            employeeIds: allowedEmployees.map((e) => e.id)
          };
          const result = await store.listAppealsPaged(options);
          const meta = { total: result.total, page: result.page, pageSize: result.pageSize };
          return sendJson(res, 200, { data: await enrichAppeals(result.rows), meta });
        }

        const appealsData = await store.listAppeals();
        const byId = new Map(employees.map((e) => [e.id, e]));
        const filtered =
          admin.role === "super_admin" || admin.role === "hr_admin"
            ? appealsData.filter((item) => {
                if (status && item.status !== status) return false;
                if (employeeId != null && String(item.employeeId) !== String(employeeId)) return false;
                return true;
              })
            : appealsData.filter((item) => {
                if (status && item.status !== status) return false;
                if (employeeId != null && String(item.employeeId) !== String(employeeId)) return false;
                const employee = byId.get(item.employeeId);
                return canManageEmployee(admin, employee);
              });
        if (!isPaginationRequested(url)) return sendJson(res, 200, { data: await enrichAppeals(filtered) });
        const meta = getPagination(url, filtered.length);
        return sendJson(res, 200, { data: await enrichAppeals(filtered.slice(meta.offset, meta.offset + meta.pageSize)), meta });
      }

      if (req.method === "POST" && path.startsWith("/admin/appeals/") && path.endsWith("/review")) {
        const adminId = requireAdminAccess(req);
        const appealId = path.split("/")[3];
        const appeal = await appeals.reviewAppeal(store, adminId, appealId, await readBody(req));
        return sendJson(res, 200, { data: appeal });
      }

      if (req.method === "GET" && path === "/admin/orders") {
        const admin = await requireAdmin(req, store);
        const status = url.searchParams.get("status");
        const employeeId = url.searchParams.get("employeeId");
        const employees = await store.listEmployees();
        const allowedEmployees = filterEmployeesByAdmin(admin, employees);

        if (isPaginationRequested(url) && typeof store.listOrdersPaged === "function") {
          const options = {
            page: url.searchParams.get("page"),
            pageSize: url.searchParams.get("pageSize"),
            status,
            employeeId,
            departmentIds: admin.role === "super_admin" || admin.role === "hr_admin" ? null : admin.departmentIds,
            employeeIds: allowedEmployees.map((e) => e.id)
          };
          const result = await store.listOrdersPaged(options);
          const meta = { total: result.total, page: result.page, pageSize: result.pageSize };
          return sendJson(res, 200, { data: result.rows, meta });
        }

        const ordersData = await store.listOrders();
        const byId = new Map(employees.map((e) => [e.id, e]));
        const filtered =
          admin.role === "super_admin" || admin.role === "hr_admin"
            ? ordersData.filter((order) => {
                if (status && order.status !== status) return false;
                if (employeeId != null && String(order.employeeId) !== String(employeeId)) return false;
                return true;
              })
            : ordersData.filter((order) => {
                if (status && order.status !== status) return false;
                if (employeeId != null && String(order.employeeId) !== String(employeeId)) return false;
                const employee = byId.get(order.employeeId);
                return canManageEmployee(admin, employee);
              });
        if (!isPaginationRequested(url)) return sendJson(res, 200, { data: filtered });
        const meta = getPagination(url, filtered.length);
        return sendJson(res, 200, { data: filtered.slice(meta.offset, meta.offset + meta.pageSize), meta });
      }

      if (req.method === "POST" && path.startsWith("/admin/orders/") && path.endsWith("/status")) {
        const adminId = requireAdminAccess(req);
        const orderId = path.split("/")[3];
        const body = await readBody(req);
        const order = await orders.updateOrderStatus(
          store,
          adminId,
          orderId,
          body.status,
          body.remark
        );
        return sendJson(res, 200, { data: order });
      }

      if (req.method === "POST" && path === "/admin/wecom/sync-contacts") {
        requireAdminAccess(req);
        const body = await readBody(req);
        return sendJson(res, 200, { data: await wecom.syncContacts(store, body.contacts || []) });
      }

      if (req.method === "POST" && path === "/admin/wecom/dispatch-messages") {
        requireAdminAccess(req);
        return sendJson(res, 200, { data: await wecom.dispatchPendingMessages(store) });
      }

      if (req.method === "GET" && path === "/admin/outbox") {
        const admin = await requireAdmin(req, store);
        const status = url.searchParams.get("status");
        const type = url.searchParams.get("type");
        const employeeId = url.searchParams.get("employeeId");
        const employees = await store.listEmployees();
        const allowedEmployees = filterEmployeesByAdmin(admin, employees);
        const options = {
          page: url.searchParams.get("page") || "1",
          pageSize: url.searchParams.get("pageSize") || "50",
          status,
          type,
          employeeId,
          departmentIds: admin.role === "super_admin" || admin.role === "hr_admin" ? null : admin.departmentIds,
          employeeIds: allowedEmployees.map((e) => e.id)
        };
        if (typeof store.listMessagesPaged !== "function") {
          return sendJson(res, 501, { message: "outbox 查询未实现" });
        }
        const result = await store.listMessagesPaged(options);
        return sendJson(res, 200, {
          data: result.rows,
          meta: { total: result.total, page: result.page, pageSize: result.pageSize }
        });
      }

      if (req.method === "GET" && path === "/admin/outbox/meta") {
        const admin = await requireAdmin(req, store);
        const employees = await store.listEmployees();
        const allowedEmployees = filterEmployeesByAdmin(admin, employees);
        const departmentIds = admin.role === "super_admin" || admin.role === "hr_admin" ? null : admin.departmentIds;
        const employeeIds = allowedEmployees.map((e) => e.id);
        const types =
          typeof store.listOutboxTypes === "function"
            ? await store.listOutboxTypes({ departmentIds, employeeIds })
            : [];
        const processingTimeoutSec = Number(process.env.OUTBOX_PROCESSING_TIMEOUT_SEC || 60);
        const maxRetries = Number(process.env.OUTBOX_MAX_RETRIES || 3);
        const batchSize = Number(process.env.OUTBOX_BATCH_SIZE || 50);
        return sendJson(res, 200, {
          data: {
            types,
            config: {
              processingTimeoutSec: Number.isFinite(processingTimeoutSec) ? processingTimeoutSec : 60,
              maxRetries: Number.isFinite(maxRetries) ? maxRetries : 3,
              batchSize: Number.isFinite(batchSize) ? batchSize : 50
            }
          }
        });
      }

      if (req.method === "POST" && path.startsWith("/admin/outbox/") && path.endsWith("/retry")) {
        const admin = await requireAdmin(req, store);
        const messageId = path.split("/")[3];
        if (typeof store.getMessage !== "function" || typeof store.resetMessageToPending !== "function") {
          return sendJson(res, 501, { message: "outbox 重试未实现" });
        }
        const msg = await store.getMessage(messageId);
        if (!msg) return sendJson(res, 404, { message: "消息不存在" });
        const employees = await store.listEmployees();
        const byId = new Map(employees.map((e) => [e.id, e]));
        const employee = byId.get(msg.employeeId);
        if (admin.role !== "super_admin" && admin.role !== "hr_admin") {
          if (!canManageEmployee(admin, employee)) return sendJson(res, 403, { message: "无权操作该员工" });
        }
        const updated = await store.resetMessageToPending(msg.id);
        await store.log("outbox.retried", admin.id, { id: updated.id, employeeId: updated.employeeId, type: updated.type });
        return sendJson(res, 200, { data: updated });
      }

      if (req.method === "POST" && path === "/admin/outbox/retry-failed") {
        const admin = await requireAdmin(req, store);
        if (typeof store.retryFailedMessages !== "function") {
          return sendJson(res, 501, { message: "outbox 批量重试未实现" });
        }
        const body = await readBody(req);
        const employees = await store.listEmployees();
        const allowedEmployees = filterEmployeesByAdmin(admin, employees);
        const employeeId = body.employeeId;
        const employeeIds =
          employeeId != null
            ? allowedEmployees.filter((e) => String(e.id) === String(employeeId)).map((e) => e.id)
            : allowedEmployees.map((e) => e.id);
        const type = body.type ? String(body.type) : "";
        const result = await store.retryFailedMessages({ employeeIds, type: type || undefined });
        await store.log("outbox.retry_failed", admin.id, { count: result.count, type: type || null });
        return sendJson(res, 200, { data: result });
      }

      if (req.method === "POST" && path === "/miniapp/auth/login") {
        const body = await readBody(req);
        let employee = null;
        if (body.employeeId != null) employee = await store.getEmployee(body.employeeId);
        if (!employee && body.wecomUserId) employee = await store.findEmployeeByWecomUserId(body.wecomUserId);
        if (!employee) return sendJson(res, 401, { message: "员工不存在" });
        const token = jwt.sign(
          { typ: "employee", sub: String(employee.id) },
          process.env.JWT_SECRET || "change-me",
          { expiresIn: "30d" }
        );
        const safeEmployee = {
          id: employee.id,
          name: employee.name,
          wecomUserId: employee.wecomUserId,
          departmentId: employee.departmentId,
          status: employee.status
        };
        return sendJson(res, 200, { token, employee: safeEmployee });
      }

      if (req.method === "GET" && path === "/miniapp/home") {
        const employee = await store.getEmployee(requireEmployeeAccess(req));
        if (!employee) return sendJson(res, 404, { message: "员工不存在" });
        const records = await points.listEmployeeRecords(store, employee.id);
        const month = new Date().toISOString().slice(0, 7);
        const monthDelta = records
          .filter((record) => record.month === month)
          .reduce((sum, record) => sum + record.pointsDelta, 0);
        return sendJson(res, 200, {
          data: {
            employee,
            pointsBalance: employee.pointsBalance,
            monthDelta,
            unreadMessages:
              typeof store.countUnreadMessages === "function"
                ? await store.countUnreadMessages(employee.id)
                : await store.countPendingMessages(employee.id)
          }
        });
      }

      if (req.method === "GET" && path === "/miniapp/messages") {
        const employeeId = requireEmployeeAccess(req);
        if (typeof store.listMessagesPaged !== "function") {
          return sendJson(res, 501, { message: "通知列表未实现" });
        }
        const unreadOnly = url.searchParams.get("unreadOnly") === "1";
        const options = {
          page: url.searchParams.get("page") || "1",
          pageSize: url.searchParams.get("pageSize") || "50",
          employeeId,
          unreadOnly
        };
        const result = await store.listMessagesPaged(options);
        const rows = result.rows.map(formatEmployeeMessage);
        if (!isPaginationRequested(url)) return sendJson(res, 200, { data: rows });
        return sendJson(res, 200, {
          data: rows,
          meta: { total: result.total, page: result.page, pageSize: result.pageSize }
        });
      }

      if (req.method === "GET" && path === "/miniapp/hall") {
        requireEmployeeAccess(req);
        if (typeof store.listPointRecordsWithEmployeePaged !== "function") {
          return sendJson(res, 501, { message: "大厅未实现" });
        }
        const options = {
          page: url.searchParams.get("page") || "1",
          pageSize: url.searchParams.get("pageSize") || "50",
          sourceTypes: ["manual_adjustment", "monthly_performance", "reversal"],
          month: url.searchParams.get("month") || undefined,
          pointsDirection: url.searchParams.get("pointsDirection") || undefined,
          keyword: url.searchParams.get("keyword") || undefined
        };
        const result = await store.listPointRecordsWithEmployeePaged(options);
        const rows = result.rows.map((row) => ({
          id: row.id,
          employeeId: row.employeeId,
          employeeName: row.employeeName || "",
          pointsDelta: row.pointsDelta,
          remark: row.remark,
          operatorName: row.operatorName,
          occurredAt: row.occurredAt,
          sourceType: row.sourceType,
          sourceId: row.sourceId
        }));
        if (!isPaginationRequested(url)) return sendJson(res, 200, { data: rows });
        return sendJson(res, 200, {
          data: rows,
          meta: { total: result.total, page: result.page, pageSize: result.pageSize }
        });
      }

      if (req.method === "GET" && path === "/miniapp/hall/unread-count") {
        requireEmployeeAccess(req);
        if (typeof store.listPointRecordsWithEmployeePaged !== "function") {
          return sendJson(res, 501, { message: "大厅未实现" });
        }
        const since = url.searchParams.get("since");
        const sourceTypes = ["manual_adjustment", "monthly_performance", "reversal"];

        const latest = await store.listPointRecordsWithEmployeePaged({
          page: "1",
          pageSize: "1",
          sourceTypes
        });

        if (!since) {
          return sendJson(res, 200, { data: { count: 0, latestOccurredAt: latest.rows[0]?.occurredAt || null } });
        }

        const result = await store.listPointRecordsWithEmployeePaged({
          page: "1",
          pageSize: "1",
          sourceTypes,
          occurredAfter: since
        });

        return sendJson(res, 200, {
          data: { count: result.total, latestOccurredAt: latest.rows[0]?.occurredAt || null }
        });
      }

      if (req.method === "POST" && path.startsWith("/miniapp/messages/") && path.endsWith("/read")) {
        const employeeId = requireEmployeeAccess(req);
        if (typeof store.markMessageRead !== "function") {
          return sendJson(res, 501, { message: "通知已读未实现" });
        }
        const parts = path.split("/");
        if (parts.length !== 5) return sendJson(res, 404, { message: "接口不存在" });
        const messageId = parts[3];
        const updated = await store.markMessageRead(employeeId, messageId);
        if (!updated) return sendJson(res, 404, { message: "消息不存在" });
        return sendJson(res, 200, { data: formatEmployeeMessage(updated) });
      }

      if (req.method === "POST" && path === "/miniapp/messages/read-all") {
        const employeeId = requireEmployeeAccess(req);
        if (typeof store.markAllMessagesRead !== "function") {
          return sendJson(res, 501, { message: "通知已读未实现" });
        }
        return sendJson(res, 200, { data: await store.markAllMessagesRead(employeeId) });
      }

      if (req.method === "GET" && path === "/miniapp/points/records") {
        const employeeId = requireEmployeeAccess(req);
        const options = {
          month: url.searchParams.get("month") || undefined,
          pointsDirection: url.searchParams.get("pointsDirection") || undefined
        };
        const records = await points.listEmployeeRecords(store, employeeId, options);
        return sendJson(res, 200, { data: groupByMonth(records) });
      }

      if (req.method === "POST" && path === "/miniapp/appeals") {
        const appeal = await appeals.createAppeal(store, requireEmployeeAccess(req), await readBody(req));
        return sendJson(res, 201, { data: appeal });
      }

      if (req.method === "GET" && path === "/miniapp/mall/gifts") {
        const gifts = await store.listGifts();
        return sendJson(res, 200, { data: gifts.filter((gift) => gift.status === "active") });
      }

      if (req.method === "POST" && path === "/miniapp/orders") {
        const employeeId = requireEmployeeAccess(req);
        const body = await readBody(req);
        const order = await orders.redeemGift(store, employeeId, body.giftId);
        return sendJson(res, 201, { data: order });
      }

      if (req.method === "GET" && path === "/miniapp/orders") {
        return sendJson(res, 200, { data: await store.listOrdersByEmployee(requireEmployeeAccess(req)) });
      }

      if (req.method === "POST" && path === "/miniapp/ai/ask") {
        const employeeId = requireEmployeeAccess(req);
        const body = await readBody(req);
        const question = String(body.question || "").trim();
        if (!question) return sendJson(res, 400, { message: "请输入问题" });
        const result = await employeeAi.askEmployeeQuestion(store, employeeId, question);
        return sendJson(res, 200, { data: result });
      }

      return sendJson(res, 404, { message: "接口不存在" });
    } catch (error) {
      return sendJson(res, error.statusCode || 500, {
        message: error.message || "服务器错误"
      });
    }
  }

  return { handler, store };
}

function pathResolveSafe(rootDir, relPath) {
  const resolved = pathModule.resolve(rootDir, relPath);
  const root = pathModule.resolve(rootDir);
  if (resolved !== root && !resolved.startsWith(`${root}${pathModule.sep}`)) return null;
  return resolved;
}

function pathModuleExtname(value) {
  return pathModule.extname(String(value || ""));
}

function sendFile(res, statusCode, buffer, options) {
  const contentType = options?.contentType || "application/octet-stream";
  const filename = options?.filename;
  const headers = {
    "content-type": contentType,
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,PUT,OPTIONS",
    "access-control-allow-headers": "content-type,authorization,x-admin-id,x-employee-id"
  };
  if (filename) headers["content-disposition"] = `attachment; filename="${filename}"`;
  res.writeHead(statusCode, headers);
  res.end(buffer);
}

function verifyPassword(inputPassword, admin) {
  const password = String(inputPassword || "");
  if (admin.password != null) return admin.password === password;
  const encoded = String(admin.passwordHash || "");
  if (!encoded.startsWith("scrypt$")) return false;
  const parts = encoded.split("$");
  if (parts.length !== 6) return false;
  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  const salt = Buffer.from(parts[4], "base64");
  const expected = Buffer.from(parts[5], "base64");
  if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p) || !salt.length || !expected.length) {
    return false;
  }
  const derived = scryptSync(password, salt, expected.length, { N, r, p });
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

function requireAdminAccess(req) {
  if (process.env.NODE_ENV === "production") {
    const auth = String(req.headers["authorization"] || "");
    if (!auth.startsWith("Bearer ")) {
      const error = new Error("未登录");
      error.statusCode = 401;
      throw error;
    }
  }
  const adminId = getAdminId(req);
  if (!adminId) {
    const error = new Error("未登录");
    error.statusCode = 401;
    throw error;
  }
  return adminId;
}

async function requireAdmin(req, store) {
  const adminId = requireAdminAccess(req);
  const admin = await store.getAdmin(adminId);
  if (!admin) {
    const error = new Error("未登录");
    error.statusCode = 401;
    throw error;
  }
  return admin;
}

function requireEmployeeAccess(req) {
  const employeeId = getEmployeeId(req);
  if (!employeeId) {
    const error = new Error("未登录");
    error.statusCode = 401;
    throw error;
  }
  return employeeId;
}

function filterEmployeesByAdmin(admin, employees) {
  if (admin.role === "super_admin" || admin.role === "hr_admin") return employees;
  return employees.filter((employee) => canManageEmployee(admin, employee));
}

function filterReportRowsByAdmin(admin, rows) {
  if (admin.role === "super_admin" || admin.role === "hr_admin") return rows;
  const allowed = new Set(admin.departmentIds || []);
  return rows.filter((row) => allowed.has(row.departmentId));
}

function isPaginationRequested(url) {
  return url.searchParams.has("page") || url.searchParams.has("pageSize");
}

function getPagination(url, total) {
  const page = Number(url.searchParams.get("page") || "1");
  const pageSize = Number(url.searchParams.get("pageSize") || "50");
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const safePageSize = Number.isFinite(pageSize) && pageSize > 0 ? Math.min(Math.floor(pageSize), 200) : 50;
  return {
    page: safePage,
    pageSize: safePageSize,
    total: Number(total || 0),
    offset: (safePage - 1) * safePageSize
  };
}

module.exports = { createApp };
