const seed = require("./seed");
const mysql = require("mysql2/promise");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function toNumberId(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function createMemoryStore() {
  const state = {
    departments: clone(seed.departments),
    employees: clone(seed.employees),
    admins: clone(seed.admins),
    gifts: clone(seed.gifts),
    pointRecords: [],
    appeals: [],
    orders: [],
    operationLogs: [],
    messageOutbox: []
  };
  const adminSeen = new Map();
  const counters = {
    pointRecords: 0,
    appeals: 0,
    orders: 0,
    operationLogs: 0,
    messageOutbox: 0
  };

  function clampPageSize(value) {
    const size = Number(value);
    if (!Number.isFinite(size) || size <= 0) return 50;
    return Math.min(Math.floor(size), 200);
  }

  function normalizePagination(options) {
    const page = Number(options?.page);
    const pageSize = clampPageSize(options?.pageSize);
    const normalizedPage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
    return { page: normalizedPage, pageSize, offset: (normalizedPage - 1) * pageSize };
  }

  function paginate(items, options) {
    const { page, pageSize, offset } = normalizePagination(options);
    const total = items.length;
    const rows = items.slice(offset, offset + pageSize);
    return { rows, total, page, pageSize };
  }

  const store = {
    driver: "memory",
    state,
    now: () => new Date().toISOString(),
    transaction: async (fn) => fn(store),
    getAdmin: async (id) => state.admins.find((item) => item.id === toNumberId(id)) || null,
    findAdminByUsername: async (username) =>
      state.admins.find((item) => item.username === String(username || "")) || null,
    getEmployee: async (id) => state.employees.find((item) => item.id === toNumberId(id)) || null,
    findEmployeeByWecomUserId: async (wecomUserId) => {
      const value = String(wecomUserId || "").trim();
      if (!value) return null;
      return state.employees.find((item) => item.wecomUserId === value) || null;
    },
    listEmployees: async () => state.employees.slice(),
    upsertEmployeeByWecomUserId: async (payload) => {
      const wecomUserId = String(payload.wecomUserId || "").trim();
      if (!wecomUserId) return null;
      let employee = state.employees.find((item) => item.wecomUserId === wecomUserId);
      if (!employee) {
        employee = {
          id: state.employees.length ? Math.max(...state.employees.map((e) => e.id)) + 1 : 1,
          wecomUserId,
          name: payload.name,
          departmentId: toNumberId(payload.departmentId),
          pointsBalance: 0,
          status: payload.status || "active"
        };
        state.employees.push(employee);
      } else {
        employee.name = payload.name || employee.name;
        employee.departmentId = toNumberId(payload.departmentId) ?? employee.departmentId;
        employee.status = payload.status || employee.status;
      }
      return employee;
    },
    getGift: async (id) => state.gifts.find((item) => item.id === toNumberId(id)) || null,
    listGifts: async () => state.gifts.slice(),
    createGift: async (input) => {
      const name = String(input?.name || "").trim();
      if (!name) return null;
      const gift = {
        id: state.gifts.length ? Math.max(...state.gifts.map((g) => g.id)) + 1 : 1,
        name,
        pointsCost: Number(input?.pointsCost || 0),
        stock: Number(input?.stock || 0),
        status: String(input?.status || "inactive"),
        limitPerUser: input?.limitPerUser == null || input?.limitPerUser === "" ? null : Number(input?.limitPerUser),
        coverImageUrl: input?.coverImageUrl ? String(input.coverImageUrl) : null
      };
      state.gifts.push(gift);
      return gift;
    },
    updateGift: async (id, patch = {}) => {
      const gift = state.gifts.find((item) => item.id === toNumberId(id));
      if (!gift) return null;
      if (patch.name != null) {
        const name = String(patch.name || "").trim();
        if (!name) return null;
        gift.name = name;
      }
      if (patch.pointsCost != null) gift.pointsCost = Number(patch.pointsCost);
      if (patch.stock != null) gift.stock = Number(patch.stock);
      if (patch.status != null) gift.status = String(patch.status);
      if ("limitPerUser" in patch) {
        gift.limitPerUser = patch.limitPerUser == null || patch.limitPerUser === "" ? null : Number(patch.limitPerUser);
      }
      if ("coverImageUrl" in patch) {
        gift.coverImageUrl = patch.coverImageUrl ? String(patch.coverImageUrl) : null;
      }
      return gift;
    },
    updateGiftStock: async (giftId, delta) => {
      const gift = state.gifts.find((item) => item.id === toNumberId(giftId));
      if (!gift) return null;
      gift.stock += Number(delta);
      return gift;
    },
    getPointRecord: async (id) =>
      state.pointRecords.find((item) => item.id === toNumberId(id)) || null,
    listPointRecords: async () => state.pointRecords.slice(),
    listPointRecordsByEmployee: async (employeeId) =>
      state.pointRecords.filter((item) => item.employeeId === toNumberId(employeeId)),
    listPointRecordsWithEmployee: async () => {
      const byId = new Map(state.employees.map((e) => [e.id, e]));
      return state.pointRecords
        .slice()
        .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
        .map((record) => ({
          ...record,
          employeeName: byId.get(record.employeeId)?.name || "",
          departmentId: byId.get(record.employeeId)?.departmentId || null
        }));
    },
    listPointRecordsWithEmployeePaged: async (options = {}) => {
      let items = await store.listPointRecordsWithEmployee();
      if (options.employeeId != null) {
        const id = toNumberId(options.employeeId);
        items = items.filter((row) => row.employeeId === id);
      }
      if (Array.isArray(options.sourceTypes) && options.sourceTypes.length) {
        const allowed = new Set(options.sourceTypes.map(String));
        items = items.filter((row) => allowed.has(String(row.sourceType)));
      }
      if (Array.isArray(options.excludeSourceTypes) && options.excludeSourceTypes.length) {
        const excluded = new Set(options.excludeSourceTypes.map(String));
        items = items.filter((row) => !excluded.has(String(row.sourceType)));
      }
      if (options.occurredAfter) {
        const since = new Date(String(options.occurredAfter));
        if (!Number.isNaN(since.getTime())) {
          items = items.filter((row) => new Date(String(row.occurredAt || 0)).getTime() > since.getTime());
        }
      }
      if (Array.isArray(options.departmentIds) && options.departmentIds.length) {
        const allowed = new Set(options.departmentIds.map(toNumberId).filter(Boolean));
        items = items.filter((row) => allowed.has(toNumberId(row.departmentId)));
      }
      if (options.month) {
        const month = String(options.month);
        items = items.filter((row) => String(row.occurredAt || "").slice(0, 7) === month);
      }
      if (options.pointsDirection === "positive") {
        items = items.filter((row) => Number(row.pointsDelta) > 0);
      } else if (options.pointsDirection === "negative") {
        items = items.filter((row) => Number(row.pointsDelta) < 0);
      }
      if (options.keyword) {
        const key = String(options.keyword).trim().toLowerCase();
        if (key) {
          items = items.filter((row) => {
            const name = String(row.employeeName || "").toLowerCase();
            const id = String(row.employeeId || "");
            return name.includes(key) || id.includes(key);
          });
        }
      }
      return paginate(items, options);
    },
    createPointRecord: async (input) => {
      const employee = state.employees.find((item) => item.id === toNumberId(input.employeeId));
      if (!employee) return null;
      counters.pointRecords += 1;
      const record = Object.freeze({
        id: counters.pointRecords,
        employeeId: employee.id,
        pointsDelta: Number(input.pointsDelta),
        type: input.type,
        sourceType: input.sourceType,
        sourceId: input.sourceId ?? null,
        operatorId: input.operatorId ?? null,
        operatorName: input.operatorName,
        remark: input.remark,
        occurredAt: input.occurredAt || store.now(),
        createdAt: store.now(),
        reversalOfId: input.reversalOfId ?? null
      });
      employee.pointsBalance += record.pointsDelta;
      state.pointRecords.push(record);
      return record;
    },
    createAppeal: async (input) => {
      counters.appeals += 1;
      const appeal = {
        id: counters.appeals,
        pointRecordId: toNumberId(input.pointRecordId),
        employeeId: toNumberId(input.employeeId),
        reason: input.reason,
        status: input.status,
        departmentReviewerId: input.departmentReviewerId ?? null,
        hrReviewerId: input.hrReviewerId ?? null,
        resultRemark: input.resultRemark ?? null,
        createdAt: store.now(),
        updatedAt: store.now()
      };
      state.appeals.push(appeal);
      return appeal;
    },
    listAppeals: async () => state.appeals.slice(),
    listAppealsPaged: async (options = {}) => {
      let items = state.appeals.slice().sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
      if (options.status) items = items.filter((row) => row.status === options.status);
      if (options.createdAfter) {
        const since = new Date(String(options.createdAfter));
        if (!Number.isNaN(since.getTime())) {
          items = items.filter((row) => new Date(String(row.createdAt || 0)).getTime() > since.getTime());
        }
      }
      if (options.employeeId != null) {
        const id = toNumberId(options.employeeId);
        items = items.filter((row) => row.employeeId === id);
      }
      if (Array.isArray(options.employeeIds) && options.employeeIds.length) {
        const allowed = new Set(options.employeeIds.map(toNumberId).filter(Boolean));
        items = items.filter((row) => allowed.has(toNumberId(row.employeeId)));
      }
      return paginate(items, options);
    },
    getAppeal: async (id) => state.appeals.find((item) => item.id === toNumberId(id)) || null,
    updateAppeal: async (id, patch) => {
      const appeal = state.appeals.find((item) => item.id === toNumberId(id));
      if (!appeal) return null;
      Object.assign(appeal, patch, { updatedAt: store.now() });
      return appeal;
    },
    createOrder: async (input) => {
      counters.orders += 1;
      const order = {
        id: counters.orders,
        employeeId: toNumberId(input.employeeId),
        giftId: toNumberId(input.giftId),
        giftName: input.giftName,
        pointsCost: Number(input.pointsCost),
        status: input.status,
        reviewRemark: input.reviewRemark ?? null,
        createdAt: store.now(),
        updatedAt: store.now()
      };
      state.orders.push(order);
      return order;
    },
    getOrder: async (id) => state.orders.find((item) => item.id === toNumberId(id)) || null,
    listOrders: async () => state.orders.slice(),
    listOrdersPaged: async (options = {}) => {
      let items = state.orders.slice().sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
      if (options.status) items = items.filter((row) => row.status === options.status);
      if (options.createdAfter) {
        const since = new Date(String(options.createdAfter));
        if (!Number.isNaN(since.getTime())) {
          items = items.filter((row) => new Date(String(row.createdAt || 0)).getTime() > since.getTime());
        }
      }
      if (options.employeeId != null) {
        const id = toNumberId(options.employeeId);
        items = items.filter((row) => row.employeeId === id);
      }
      if (Array.isArray(options.employeeIds) && options.employeeIds.length) {
        const allowed = new Set(options.employeeIds.map(toNumberId).filter(Boolean));
        items = items.filter((row) => allowed.has(toNumberId(row.employeeId)));
      }
      return paginate(items, options);
    },
    listOrdersByEmployee: async (employeeId) =>
      state.orders.filter((item) => item.employeeId === toNumberId(employeeId)),
    updateOrder: async (id, patch) => {
      const order = state.orders.find((item) => item.id === toNumberId(id));
      if (!order) return null;
      Object.assign(order, patch, { updatedAt: store.now() });
      return order;
    },
    log: async (action, actorId, payload) => {
      counters.operationLogs += 1;
      const entry = {
        id: counters.operationLogs,
        action,
        actorId: String(actorId),
        payload,
        createdAt: store.now()
      };
      state.operationLogs.push(entry);
      return entry;
    },
    listOperationLogs: async () => state.operationLogs.slice(),
    listOperationLogsPaged: async (options = {}) => {
      const items = state.operationLogs.slice().sort((a, b) => b.id - a.id);
      return paginate(items, options);
    },
    enqueueMessage: async (type, employeeId, payload) => {
      counters.messageOutbox += 1;
      const message = {
        id: counters.messageOutbox,
        type,
        employeeId: toNumberId(employeeId),
        payload,
        status: "pending",
        retryCount: 0,
        readAt: null,
        createdAt: store.now(),
        updatedAt: store.now()
      };
      state.messageOutbox.push(message);
      return message;
    },
    getMessage: async (id) => state.messageOutbox.find((item) => item.id === toNumberId(id)) || null,
    listMessagesPaged: async (options = {}) => {
      let items = state.messageOutbox.slice().sort((a, b) => b.id - a.id);
      if (options.status) items = items.filter((row) => row.status === options.status);
      if (options.type) items = items.filter((row) => row.type === options.type);
      if (options.unreadOnly) items = items.filter((row) => !row.readAt);
      if (options.employeeId != null) {
        const id = toNumberId(options.employeeId);
        items = items.filter((row) => row.employeeId === id);
      }
      if (Array.isArray(options.employeeIds) && options.employeeIds.length) {
        const allowed = new Set(options.employeeIds.map(toNumberId).filter(Boolean));
        items = items.filter((row) => allowed.has(toNumberId(row.employeeId)));
      }
      return paginate(items, options);
    },
    listOutboxTypes: async (options = {}) => {
      let items = state.messageOutbox.slice();
      if (options.status) items = items.filter((row) => row.status === options.status);
      if (options.employeeId != null) {
        const id = toNumberId(options.employeeId);
        items = items.filter((row) => row.employeeId === id);
      }
      if (Array.isArray(options.employeeIds) && options.employeeIds.length) {
        const allowed = new Set(options.employeeIds.map(toNumberId).filter(Boolean));
        items = items.filter((row) => allowed.has(toNumberId(row.employeeId)));
      }
      const types = Array.from(
        new Set(items.map((row) => String(row.type || "")).filter(Boolean))
      ).sort((a, b) => a.localeCompare(b));
      return types;
    },
    resetMessageToPending: async (id) => {
      const msg = state.messageOutbox.find((item) => item.id === toNumberId(id));
      if (!msg) return null;
      msg.status = "pending";
      msg.retryCount = 0;
      msg.updatedAt = store.now();
      return msg;
    },
    retryFailedMessages: async (options = {}) => {
      let items = state.messageOutbox.slice();
      items = items.filter((row) => row.status === "failed");
      if (options.type) items = items.filter((row) => row.type === options.type);
      if (options.employeeId != null) {
        const id = toNumberId(options.employeeId);
        items = items.filter((row) => row.employeeId === id);
      }
      if (Array.isArray(options.employeeIds) && options.employeeIds.length) {
        const allowed = new Set(options.employeeIds.map(toNumberId).filter(Boolean));
        items = items.filter((row) => allowed.has(toNumberId(row.employeeId)));
      }
      for (const msg of items) {
        msg.status = "pending";
        msg.retryCount = 0;
        msg.updatedAt = store.now();
      }
      return { count: items.length };
    },
    markAllMessagesRead: async (employeeId) => {
      const id = toNumberId(employeeId);
      if (!id) return { count: 0 };
      const readAt = store.now();
      let count = 0;
      for (const msg of state.messageOutbox) {
        if (msg.employeeId !== id || msg.readAt) continue;
        msg.readAt = readAt;
        msg.updatedAt = store.now();
        count += 1;
      }
      return { count, readAt };
    },
    markMessageRead: async (employeeId, messageId) => {
      const empId = toNumberId(employeeId);
      const msgId = toNumberId(messageId);
      if (!empId || !msgId) return null;
      const msg = state.messageOutbox.find((item) => item.id === msgId);
      if (!msg || msg.employeeId !== empId) return null;
      if (!msg.readAt) msg.readAt = store.now();
      msg.updatedAt = store.now();
      return msg;
    },
    claimPendingMessages: async (limit = 50) => {
      const timeoutSec = Number(process.env.OUTBOX_PROCESSING_TIMEOUT_SEC || 60);
      const now = Date.now();
      for (const msg of state.messageOutbox) {
        if (msg.status !== "processing") continue;
        const updatedAtMs = Date.parse(msg.updatedAt);
        if (!Number.isFinite(updatedAtMs)) continue;
        if (Number.isFinite(timeoutSec) && timeoutSec > 0 && now - updatedAtMs >= timeoutSec * 1000) {
          msg.status = "pending";
          msg.updatedAt = store.now();
        }
      }

      const size = Number(limit);
      const items = state.messageOutbox
        .filter((msg) => msg.status === "pending")
        .slice(0, Number.isFinite(size) && size > 0 ? size : 50);
      for (const msg of items) {
        msg.status = "processing";
        msg.updatedAt = store.now();
      }
      return items.slice();
    },
    markMessageMockSent: async (id) => {
      const msg = state.messageOutbox.find((item) => item.id === toNumberId(id));
      if (!msg) return null;
      msg.status = "mock_sent";
      msg.updatedAt = store.now();
      return msg;
    },
    markMessageFailed: async (id, maxRetries = 3) => {
      const msg = state.messageOutbox.find((item) => item.id === toNumberId(id));
      if (!msg) return null;
      msg.retryCount = Number(msg.retryCount || 0) + 1;
      const threshold = Number(maxRetries);
      msg.status =
        Number.isFinite(threshold) && threshold > 0 && msg.retryCount >= threshold ? "failed" : "pending";
      msg.updatedAt = store.now();
      return msg;
    },
    countUnreadMessages: async (employeeId) =>
      state.messageOutbox.filter(
        (msg) => msg.employeeId === toNumberId(employeeId) && !msg.readAt
      ).length,
    countPendingMessages: async (employeeId) =>
      state.messageOutbox.filter(
        (msg) => msg.employeeId === toNumberId(employeeId) && msg.status === "pending"
      ).length,
    dispatchPendingMessages: async () => {
      const claimed = await store.claimPendingMessages(50);
      for (const msg of claimed) await store.markMessageMockSent(msg.id);
      return claimed;
    },
    getAdminSeenAt: async (adminId, badgeKey) => {
      const id = toNumberId(adminId);
      const key = String(badgeKey || "").trim();
      if (!id || !key) return null;
      return adminSeen.get(`${id}:${key}`) || null;
    },
    setAdminSeenAt: async (adminId, badgeKey, seenAt) => {
      const id = toNumberId(adminId);
      const key = String(badgeKey || "").trim();
      if (!id || !key) return null;
      const fallback = store.now();
      const value = seenAt ? new Date(String(seenAt)) : new Date(fallback);
      const iso = Number.isNaN(value.getTime()) ? fallback : value.toISOString();
      adminSeen.set(`${id}:${key}`, iso);
      return iso;
    }
  };

  return store;
}

function mapAdmin(row, departmentIds = []) {
  if (!row) return null;
  return {
    id: Number(row.id),
    username: row.username,
    name: row.name,
    role: row.role,
    departmentIds: departmentIds.map(Number),
    passwordHash: row.password_hash
  };
}

function mapEmployee(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    wecomUserId: row.wecom_user_id,
    name: row.name,
    departmentId: Number(row.department_id),
    pointsBalance: Number(row.points_balance),
    status: row.status
  };
}

function mapGift(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    name: row.name,
    pointsCost: Number(row.points_cost),
    stock: Number(row.stock),
    status: row.status,
    limitPerUser: row.limit_per_user == null ? null : Number(row.limit_per_user),
    coverImageUrl: row.cover_image_url ? String(row.cover_image_url) : null
  };
}

function mapPointRecord(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    employeeId: Number(row.employee_id),
    pointsDelta: Number(row.points_delta),
    type: row.type,
    sourceType: row.source_type,
    sourceId: row.source_id,
    operatorId: row.operator_id == null ? null : Number(row.operator_id),
    operatorName: row.operator_name,
    remark: row.remark,
    occurredAt: new Date(row.occurred_at).toISOString(),
    createdAt: new Date(row.created_at).toISOString(),
    reversalOfId: row.reversal_of_id == null ? null : Number(row.reversal_of_id)
  };
}

function mapAppeal(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    pointRecordId: Number(row.point_record_id),
    employeeId: Number(row.employee_id),
    reason: row.reason,
    status: row.status,
    departmentReviewerId: row.department_reviewer_id == null ? null : Number(row.department_reviewer_id),
    hrReviewerId: row.hr_reviewer_id == null ? null : Number(row.hr_reviewer_id),
    resultRemark: row.result_remark,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString()
  };
}

function mapOrder(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    employeeId: Number(row.employee_id),
    giftId: Number(row.gift_id),
    giftName: row.gift_name,
    pointsCost: Number(row.points_cost),
    status: row.status,
    reviewRemark: row.review_remark,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString()
  };
}

function mapOperationLog(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    actorId: row.actor_id,
    action: row.action,
    payload: typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload,
    createdAt: new Date(row.created_at).toISOString()
  };
}

function mapMessage(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    employeeId: Number(row.employee_id),
    type: row.type,
    payload: typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload,
    status: row.status,
    retryCount: Number(row.retry_count),
    readAt: row.read_at ? new Date(row.read_at).toISOString() : null,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString()
  };
}

function createMysqlStore() {
  const pool = mysql.createPool({
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    charset: "utf8mb4",
    timezone: "Z",
    decimalNumbers: true,
    connectionLimit: 10
  });

  if (typeof pool.on === "function") {
    pool.on("connection", (conn) => {
      conn.query("SET NAMES utf8mb4");
    });
  }

  let ensureAdminSeenTablePromise = null;
  function ensureAdminSeenTable(executor) {
    if (!ensureAdminSeenTablePromise) {
      ensureAdminSeenTablePromise = executor.execute(
        "CREATE TABLE IF NOT EXISTS admin_seen (admin_id BIGINT NOT NULL, badge_key VARCHAR(60) NOT NULL, seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, PRIMARY KEY (admin_id, badge_key), FOREIGN KEY (admin_id) REFERENCES admins(id))"
      );
    }
    return ensureAdminSeenTablePromise;
  }

  function createQueryStore(executor) {
    const store = {
      driver: "mysql",
      now: () => new Date().toISOString(),
      transaction: async (fn) => {
        const conn = await pool.getConnection();
        try {
          await conn.beginTransaction();
          const txStore = createQueryStore(conn);
          const result = await fn(txStore);
          await conn.commit();
          return result;
        } catch (error) {
          await conn.rollback();
          throw error;
        } finally {
          conn.release();
        }
      },
      getAdmin: async (id) => {
        const adminId = toNumberId(id);
        if (!adminId) return null;
        const [rows] = await executor.execute("SELECT * FROM admins WHERE id = ?", [adminId]);
        if (!rows.length) return null;
        const [deptRows] = await executor.execute(
          "SELECT department_id FROM admin_departments WHERE admin_id = ?",
          [adminId]
        );
        return mapAdmin(rows[0], deptRows.map((r) => r.department_id));
      },
      findAdminByUsername: async (username) => {
        const value = String(username || "").trim();
        if (!value) return null;
        const [rows] = await executor.execute("SELECT * FROM admins WHERE username = ?", [value]);
        if (!rows.length) return null;
        const adminId = Number(rows[0].id);
        const [deptRows] = await executor.execute(
          "SELECT department_id FROM admin_departments WHERE admin_id = ?",
          [adminId]
        );
        return mapAdmin(rows[0], deptRows.map((r) => r.department_id));
      },
      listEmployees: async () => {
        const [rows] = await executor.execute("SELECT * FROM employees ORDER BY id ASC");
        return rows.map(mapEmployee);
      },
      getEmployee: async (id, options = {}) => {
        const employeeId = toNumberId(id);
        if (!employeeId) return null;
        const sql = `SELECT * FROM employees WHERE id = ?${options.forUpdate ? " FOR UPDATE" : ""}`;
        const [rows] = await executor.execute(sql, [employeeId]);
        return mapEmployee(rows[0]);
      },
      findEmployeeByWecomUserId: async (wecomUserId) => {
        const value = String(wecomUserId || "").trim();
        if (!value) return null;
        const [rows] = await executor.execute("SELECT * FROM employees WHERE wecom_user_id = ?", [value]);
        return mapEmployee(rows[0]);
      },
      upsertEmployeeByWecomUserId: async (payload) => {
        const wecomUserId = String(payload.wecomUserId || "").trim();
        if (!wecomUserId) return null;
        const departmentId = toNumberId(payload.departmentId);
        const name = String(payload.name || "").trim();
        const status = String(payload.status || "active");
        await executor.execute(
          "INSERT INTO employees (wecom_user_id, name, department_id, status) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name), department_id=VALUES(department_id), status=VALUES(status)",
          [wecomUserId, name, departmentId, status]
        );
        const [rows] = await executor.execute("SELECT * FROM employees WHERE wecom_user_id = ?", [
          wecomUserId
        ]);
        return mapEmployee(rows[0]);
      },
      getGift: async (id, options = {}) => {
        const giftId = toNumberId(id);
        if (!giftId) return null;
        const sql = `SELECT * FROM gifts WHERE id = ?${options.forUpdate ? " FOR UPDATE" : ""}`;
        const [rows] = await executor.execute(sql, [giftId]);
        return mapGift(rows[0]);
      },
      listGifts: async () => {
        const [rows] = await executor.execute("SELECT * FROM gifts ORDER BY id ASC");
        return rows.map(mapGift);
      },
      createGift: async (input) => {
        const name = String(input?.name || "").trim();
        if (!name) return null;
        const pointsCost = Number(input?.pointsCost || 0);
        const stock = Number(input?.stock || 0);
        const status = String(input?.status || "inactive");
        const limitPerUser = input?.limitPerUser == null || input?.limitPerUser === "" ? null : Number(input?.limitPerUser);
        const coverImageUrl = input?.coverImageUrl ? String(input.coverImageUrl) : null;
        const [result] = await executor.execute(
          "INSERT INTO gifts (name, points_cost, stock, status, limit_per_user, cover_image_url) VALUES (?,?,?,?,?,?)",
          [name, pointsCost, stock, status, limitPerUser, coverImageUrl]
        );
        const [rows] = await executor.execute("SELECT * FROM gifts WHERE id = ?", [Number(result.insertId)]);
        return mapGift(rows[0]);
      },
      updateGift: async (id, patch = {}) => {
        const giftId = toNumberId(id);
        if (!giftId) return null;
        const sets = [];
        const params = [];
        if (patch.name != null) {
          const name = String(patch.name || "").trim();
          if (!name) return null;
          sets.push("name = ?");
          params.push(name);
        }
        if (patch.pointsCost != null) {
          sets.push("points_cost = ?");
          params.push(Number(patch.pointsCost));
        }
        if (patch.stock != null) {
          sets.push("stock = ?");
          params.push(Number(patch.stock));
        }
        if (patch.status != null) {
          sets.push("status = ?");
          params.push(String(patch.status));
        }
        if ("limitPerUser" in patch) {
          sets.push("limit_per_user = ?");
          params.push(patch.limitPerUser == null || patch.limitPerUser === "" ? null : Number(patch.limitPerUser));
        }
        if ("coverImageUrl" in patch) {
          sets.push("cover_image_url = ?");
          params.push(patch.coverImageUrl ? String(patch.coverImageUrl) : null);
        }
        if (!sets.length) return store.getGift(giftId);
        params.push(giftId);
        await executor.execute(`UPDATE gifts SET ${sets.join(", ")} WHERE id = ?`, params);
        const [rows] = await executor.execute("SELECT * FROM gifts WHERE id = ?", [giftId]);
        return mapGift(rows[0]);
      },
      updateGiftStock: async (giftId, delta) => {
        const id = toNumberId(giftId);
        if (!id) return null;
        await executor.execute("UPDATE gifts SET stock = stock + ? WHERE id = ?", [Number(delta), id]);
        return store.getGift(id);
      },
      getPointRecord: async (id) => {
        const recordId = toNumberId(id);
        if (!recordId) return null;
        const [rows] = await executor.execute("SELECT * FROM point_records WHERE id = ?", [recordId]);
        return mapPointRecord(rows[0]);
      },
      listPointRecords: async () => {
        const [rows] = await executor.execute("SELECT * FROM point_records ORDER BY id ASC");
        return rows.map(mapPointRecord);
      },
      listPointRecordsByEmployee: async (employeeId) => {
        const id = toNumberId(employeeId);
        if (!id) return [];
        const [rows] = await executor.execute(
          "SELECT * FROM point_records WHERE employee_id = ? ORDER BY occurred_at DESC, id DESC",
          [id]
        );
        return rows.map(mapPointRecord);
      },
      listPointRecordsWithEmployee: async () => {
        const [rows] = await executor.execute(
          "SELECT pr.*, e.name AS employee_name, e.department_id AS employee_department_id FROM point_records pr JOIN employees e ON pr.employee_id = e.id ORDER BY pr.occurred_at DESC, pr.id DESC"
        );
        return rows.map((row) => ({
          ...mapPointRecord(row),
          employeeName: row.employee_name,
          departmentId: Number(row.employee_department_id)
        }));
      },
      listPointRecordsWithEmployeePaged: async (options = {}) => {
        const limit = Number.isFinite(Number(options.pageSize)) ? Math.min(Number(options.pageSize), 200) : 50;
        const page = Number.isFinite(Number(options.page)) && Number(options.page) > 0 ? Math.floor(Number(options.page)) : 1;
        const offset = (page - 1) * limit;
        const where = [];
        const params = [];
        const join = "FROM point_records pr JOIN employees e ON pr.employee_id = e.id";
        if (options.employeeId != null) {
          where.push("pr.employee_id = ?");
          params.push(toNumberId(options.employeeId));
        }
        if (Array.isArray(options.sourceTypes) && options.sourceTypes.length) {
          const types = options.sourceTypes.map(String).filter(Boolean);
          where.push(`pr.source_type IN (${types.map(() => "?").join(",")})`);
          params.push(...types);
        }
        if (Array.isArray(options.excludeSourceTypes) && options.excludeSourceTypes.length) {
          const types = options.excludeSourceTypes.map(String).filter(Boolean);
          where.push(`pr.source_type NOT IN (${types.map(() => "?").join(",")})`);
          params.push(...types);
        }
        if (options.occurredAfter) {
          const since = new Date(String(options.occurredAfter));
          if (!Number.isNaN(since.getTime())) {
            where.push("pr.occurred_at > ?");
            params.push(since);
          }
        }
        if (Array.isArray(options.departmentIds) && options.departmentIds.length) {
          const ids = options.departmentIds.map(toNumberId).filter(Boolean);
          where.push(`e.department_id IN (${ids.map(() => "?").join(",")})`);
          params.push(...ids);
        }
        if (options.month) {
          where.push("DATE_FORMAT(pr.occurred_at, '%Y-%m') = ?");
          params.push(String(options.month));
        }
        if (options.pointsDirection === "positive") {
          where.push("pr.points_delta > 0");
        } else if (options.pointsDirection === "negative") {
          where.push("pr.points_delta < 0");
        }
        if (options.keyword) {
          const key = String(options.keyword).trim();
          if (key) {
            if (/^\d+$/.test(key)) {
              where.push("(e.name LIKE ? OR e.id = ?)");
              params.push(`%${key}%`, toNumberId(key));
            } else {
              where.push("e.name LIKE ?");
              params.push(`%${key}%`);
            }
          }
        }
        const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
        const [countRows] = await executor.query(
          `SELECT COUNT(1) AS cnt ${join} ${whereSql}`,
          params
        );
        const total = Number(countRows[0]?.cnt || 0);
        const [rows] = await executor.query(
          `SELECT pr.*, e.name AS employee_name, e.department_id AS employee_department_id ${join} ${whereSql} ORDER BY pr.occurred_at DESC, pr.id DESC LIMIT ? OFFSET ?`,
          [...params, limit, offset]
        );
        return {
          rows: rows.map((row) => ({
            ...mapPointRecord(row),
            employeeName: row.employee_name,
            departmentId: Number(row.employee_department_id)
          })),
          total,
          page,
          pageSize: limit
        };
      },
      createPointRecord: async (input) => {
        const employeeId = toNumberId(input.employeeId);
        const pointsDelta = Number(input.pointsDelta);
        const operatorId = input.operatorId == null ? null : toNumberId(input.operatorId);
        const occurredAt = input.occurredAt ? new Date(input.occurredAt) : new Date();
        await executor.execute("SELECT id FROM employees WHERE id = ? FOR UPDATE", [employeeId]);
        await executor.execute("UPDATE employees SET points_balance = points_balance + ? WHERE id = ?", [
          pointsDelta,
          employeeId
        ]);
        const [result] = await executor.execute(
          "INSERT INTO point_records (employee_id, points_delta, type, source_type, source_id, operator_id, operator_name, remark, reversal_of_id, occurred_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
          [
            employeeId,
            pointsDelta,
            input.type,
            input.sourceType,
            input.sourceId ?? null,
            operatorId,
            input.operatorName,
            input.remark,
            input.reversalOfId ?? null,
            occurredAt
          ]
        );
        const insertedId = result.insertId;
        return store.getPointRecord(insertedId);
      },
      createAppeal: async (input) => {
        const [result] = await executor.execute(
          "INSERT INTO appeals (point_record_id, employee_id, reason, status, department_reviewer_id, hr_reviewer_id, result_remark) VALUES (?,?,?,?,?,?,?)",
          [
            toNumberId(input.pointRecordId),
            toNumberId(input.employeeId),
            input.reason,
            input.status,
            input.departmentReviewerId ?? null,
            input.hrReviewerId ?? null,
            input.resultRemark ?? null
          ]
        );
        const insertedId = result.insertId;
        const [rows] = await executor.execute("SELECT * FROM appeals WHERE id = ?", [insertedId]);
        return mapAppeal(rows[0]);
      },
      listAppeals: async () => {
        const [rows] = await executor.execute("SELECT * FROM appeals ORDER BY updated_at DESC, id DESC");
        return rows.map(mapAppeal);
      },
      listAppealsPaged: async (options = {}) => {
        const limit = Number.isFinite(Number(options.pageSize)) ? Math.min(Number(options.pageSize), 200) : 50;
        const page = Number.isFinite(Number(options.page)) && Number(options.page) > 0 ? Math.floor(Number(options.page)) : 1;
        const offset = (page - 1) * limit;
        const where = [];
        const params = [];
        const join = "FROM appeals a JOIN employees e ON a.employee_id = e.id";
        if (options.status) {
          where.push("a.status = ?");
          params.push(String(options.status));
        }
        if (options.createdAfter) {
          const since = new Date(String(options.createdAfter));
          if (!Number.isNaN(since.getTime())) {
            where.push("a.created_at > ?");
            params.push(since);
          }
        }
        if (options.employeeId != null) {
          where.push("a.employee_id = ?");
          params.push(toNumberId(options.employeeId));
        }
        if (Array.isArray(options.departmentIds) && options.departmentIds.length) {
          const ids = options.departmentIds.map(toNumberId).filter(Boolean);
          where.push(`e.department_id IN (${ids.map(() => "?").join(",")})`);
          params.push(...ids);
        }
        if (Array.isArray(options.employeeIds) && options.employeeIds.length) {
          const ids = options.employeeIds.map(toNumberId).filter(Boolean);
          where.push(`a.employee_id IN (${ids.map(() => "?").join(",")})`);
          params.push(...ids);
        }
        const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
        const [countRows] = await executor.query(`SELECT COUNT(1) AS cnt ${join} ${whereSql}`, params);
        const total = Number(countRows[0]?.cnt || 0);
        const [rows] = await executor.query(
          `SELECT a.* ${join} ${whereSql} ORDER BY a.updated_at DESC, a.id DESC LIMIT ? OFFSET ?`,
          [...params, limit, offset]
        );
        return { rows: rows.map(mapAppeal), total, page, pageSize: limit };
      },
      getAppeal: async (id) => {
        const appealId = toNumberId(id);
        if (!appealId) return null;
        const [rows] = await executor.execute("SELECT * FROM appeals WHERE id = ?", [appealId]);
        return mapAppeal(rows[0]);
      },
      updateAppeal: async (id, patch) => {
        const appealId = toNumberId(id);
        if (!appealId) return null;
        await executor.execute(
          "UPDATE appeals SET status=?, department_reviewer_id=?, hr_reviewer_id=?, result_remark=? WHERE id=?",
          [
            patch.status,
            patch.departmentReviewerId ?? null,
            patch.hrReviewerId ?? null,
            patch.resultRemark ?? null,
            appealId
          ]
        );
        return store.getAppeal(appealId);
      },
      createOrder: async (input) => {
        const [result] = await executor.execute(
          "INSERT INTO orders (employee_id, gift_id, gift_name, points_cost, status, review_remark) VALUES (?,?,?,?,?,?)",
          [
            toNumberId(input.employeeId),
            toNumberId(input.giftId),
            input.giftName,
            Number(input.pointsCost),
            input.status,
            input.reviewRemark ?? null
          ]
        );
        const insertedId = result.insertId;
        const [rows] = await executor.execute("SELECT * FROM orders WHERE id = ?", [insertedId]);
        return mapOrder(rows[0]);
      },
      getOrder: async (id, options = {}) => {
        const orderId = toNumberId(id);
        if (!orderId) return null;
        const sql = `SELECT * FROM orders WHERE id = ?${options.forUpdate ? " FOR UPDATE" : ""}`;
        const [rows] = await executor.execute(sql, [orderId]);
        return mapOrder(rows[0]);
      },
      listOrders: async () => {
        const [rows] = await executor.execute("SELECT * FROM orders ORDER BY updated_at DESC, id DESC");
        return rows.map(mapOrder);
      },
      listOrdersPaged: async (options = {}) => {
        const limit = Number.isFinite(Number(options.pageSize)) ? Math.min(Number(options.pageSize), 200) : 50;
        const page = Number.isFinite(Number(options.page)) && Number(options.page) > 0 ? Math.floor(Number(options.page)) : 1;
        const offset = (page - 1) * limit;
        const where = [];
        const params = [];
        const join = "FROM orders o JOIN employees e ON o.employee_id = e.id";
        if (options.status) {
          where.push("o.status = ?");
          params.push(String(options.status));
        }
        if (options.createdAfter) {
          const since = new Date(String(options.createdAfter));
          if (!Number.isNaN(since.getTime())) {
            where.push("o.created_at > ?");
            params.push(since);
          }
        }
        if (options.employeeId != null) {
          where.push("o.employee_id = ?");
          params.push(toNumberId(options.employeeId));
        }
        if (Array.isArray(options.departmentIds) && options.departmentIds.length) {
          const ids = options.departmentIds.map(toNumberId).filter(Boolean);
          where.push(`e.department_id IN (${ids.map(() => "?").join(",")})`);
          params.push(...ids);
        }
        if (Array.isArray(options.employeeIds) && options.employeeIds.length) {
          const ids = options.employeeIds.map(toNumberId).filter(Boolean);
          where.push(`o.employee_id IN (${ids.map(() => "?").join(",")})`);
          params.push(...ids);
        }
        const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
          const [countRows] = await executor.query(`SELECT COUNT(1) AS cnt ${join} ${whereSql}`, params);
          const total = Number(countRows[0]?.cnt || 0);
          const [rows] = await executor.query(
            `SELECT o.* ${join} ${whereSql} ORDER BY o.updated_at DESC, o.id DESC LIMIT ? OFFSET ?`,
            [...params, limit, offset]
          );
        return { rows: rows.map(mapOrder), total, page, pageSize: limit };
      },
      listOrdersByEmployee: async (employeeId) => {
        const id = toNumberId(employeeId);
        if (!id) return [];
        const [rows] = await executor.execute(
          "SELECT * FROM orders WHERE employee_id = ? ORDER BY updated_at DESC, id DESC",
          [id]
        );
        return rows.map(mapOrder);
      },
      updateOrder: async (id, patch) => {
        const orderId = toNumberId(id);
        if (!orderId) return null;
        await executor.execute("UPDATE orders SET status=?, review_remark=? WHERE id=?", [
          patch.status,
          patch.reviewRemark ?? null,
          orderId
        ]);
        return store.getOrder(orderId);
      },
      log: async (action, actorId, payload) => {
        const [result] = await executor.execute(
          "INSERT INTO operation_logs (actor_id, action, payload) VALUES (?,?,?)",
          [String(actorId), action, JSON.stringify(payload ?? {})]
        );
        const insertedId = result.insertId;
        const [rows] = await executor.execute("SELECT * FROM operation_logs WHERE id = ?", [insertedId]);
        return mapOperationLog(rows[0]);
      },
      listOperationLogs: async () => {
        const [rows] = await executor.execute("SELECT * FROM operation_logs ORDER BY id DESC");
        return rows.map(mapOperationLog);
      },
      listOperationLogsPaged: async (options = {}) => {
        const limit = Number.isFinite(Number(options.pageSize)) ? Math.min(Number(options.pageSize), 200) : 50;
        const page = Number.isFinite(Number(options.page)) && Number(options.page) > 0 ? Math.floor(Number(options.page)) : 1;
        const offset = (page - 1) * limit;
        const [countRows] = await executor.execute("SELECT COUNT(1) AS cnt FROM operation_logs");
        const total = Number(countRows[0]?.cnt || 0);
        const [rows] = await executor.query(
          "SELECT * FROM operation_logs ORDER BY id DESC LIMIT ? OFFSET ?",
          [limit, offset]
        );
        return { rows: rows.map(mapOperationLog), total, page, pageSize: limit };
      },
      enqueueMessage: async (type, employeeId, payload) => {
        const [result] = await executor.execute(
          "INSERT INTO message_outbox (employee_id, type, payload, status) VALUES (?,?,?,?)",
          [toNumberId(employeeId), type, JSON.stringify(payload ?? {}), "pending"]
        );
        const insertedId = result.insertId;
        const [rows] = await executor.execute("SELECT * FROM message_outbox WHERE id = ?", [insertedId]);
        return mapMessage(rows[0]);
      },
      getMessage: async (id) => {
        const msgId = toNumberId(id);
        if (!msgId) return null;
        const [rows] = await executor.execute("SELECT * FROM message_outbox WHERE id = ?", [msgId]);
        return mapMessage(rows[0]);
      },
      listMessagesPaged: async (options = {}) => {
        const limit = Number.isFinite(Number(options.pageSize)) ? Math.min(Number(options.pageSize), 200) : 50;
        const page = Number.isFinite(Number(options.page)) && Number(options.page) > 0 ? Math.floor(Number(options.page)) : 1;
        const offset = (page - 1) * limit;
        const where = [];
        const params = [];
        const join = "FROM message_outbox m JOIN employees e ON m.employee_id = e.id";
        if (options.status) {
          where.push("m.status = ?");
          params.push(String(options.status));
        }
        if (options.type) {
          where.push("m.type = ?");
          params.push(String(options.type));
        }
        if (options.unreadOnly) {
          where.push("m.read_at IS NULL");
        }
        if (options.employeeId != null) {
          where.push("m.employee_id = ?");
          params.push(toNumberId(options.employeeId));
        }
        if (Array.isArray(options.departmentIds) && options.departmentIds.length) {
          const ids = options.departmentIds.map(toNumberId).filter(Boolean);
          where.push(`e.department_id IN (${ids.map(() => "?").join(",")})`);
          params.push(...ids);
        }
        if (Array.isArray(options.employeeIds) && options.employeeIds.length) {
          const ids = options.employeeIds.map(toNumberId).filter(Boolean);
          where.push(`m.employee_id IN (${ids.map(() => "?").join(",")})`);
          params.push(...ids);
        }
        const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
        const [countRows] = await executor.query(`SELECT COUNT(1) AS cnt ${join} ${whereSql}`, params);
        const total = Number(countRows[0]?.cnt || 0);
        const [rows] = await executor.query(
          `SELECT m.* ${join} ${whereSql} ORDER BY m.id DESC LIMIT ? OFFSET ?`,
          [...params, limit, offset]
        );
        return { rows: rows.map(mapMessage), total, page, pageSize: limit };
      },
      listOutboxTypes: async (options = {}) => {
        const where = [];
        const params = [];
        const join = "FROM message_outbox m JOIN employees e ON m.employee_id = e.id";
        if (options.status) {
          where.push("m.status = ?");
          params.push(String(options.status));
        }
        if (options.employeeId != null) {
          where.push("m.employee_id = ?");
          params.push(toNumberId(options.employeeId));
        }
        if (Array.isArray(options.departmentIds) && options.departmentIds.length) {
          const ids = options.departmentIds.map(toNumberId).filter(Boolean);
          where.push(`e.department_id IN (${ids.map(() => "?").join(",")})`);
          params.push(...ids);
        }
        if (Array.isArray(options.employeeIds) && options.employeeIds.length) {
          const ids = options.employeeIds.map(toNumberId).filter(Boolean);
          where.push(`m.employee_id IN (${ids.map(() => "?").join(",")})`);
          params.push(...ids);
        }
        const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
        const [rows] = await executor.execute(
          `SELECT DISTINCT m.type ${join} ${whereSql} ORDER BY m.type ASC LIMIT 200`,
          params
        );
        return rows.map((row) => String(row.type || "")).filter(Boolean);
      },
      claimPendingMessages: async (limit = 50) => {
        const size = Number(limit);
        const batchSize = Number.isFinite(size) && size > 0 ? size : 50;
        const timeoutSec = Number(process.env.OUTBOX_PROCESSING_TIMEOUT_SEC || 60);
        if (Number.isFinite(timeoutSec) && timeoutSec > 0) {
          await executor.execute(
            "UPDATE message_outbox SET status = 'pending' WHERE status = 'processing' AND TIMESTAMPDIFF(SECOND, updated_at, UTC_TIMESTAMP()) >= ?",
            [Math.floor(timeoutSec)]
          );
        }
        const [rows] = await executor.execute(
          "SELECT * FROM message_outbox WHERE status = 'pending' ORDER BY id ASC LIMIT ? FOR UPDATE",
          [batchSize]
        );
        if (!rows.length) return [];
        const ids = rows.map((row) => row.id);
        await executor.execute(
          `UPDATE message_outbox SET status = 'processing' WHERE id IN (${ids.map(() => "?").join(",")})`,
          ids
        );
        const [claimedRows] = await executor.execute(
          `SELECT * FROM message_outbox WHERE id IN (${ids.map(() => "?").join(",")}) ORDER BY id ASC`,
          ids
        );
        return claimedRows.map(mapMessage);
      },
      markMessageMockSent: async (id) => {
        const msgId = toNumberId(id);
        if (!msgId) return null;
        await executor.execute("UPDATE message_outbox SET status = 'mock_sent' WHERE id = ?", [msgId]);
        const [rows] = await executor.execute("SELECT * FROM message_outbox WHERE id = ?", [msgId]);
        return mapMessage(rows[0]);
      },
      markMessageFailed: async (id, maxRetries = 3) => {
        const msgId = toNumberId(id);
        if (!msgId) return null;
        const threshold = Number(maxRetries);
        const limit = Number.isFinite(threshold) && threshold > 0 ? threshold : 3;
        await executor.execute(
          "UPDATE message_outbox SET retry_count = retry_count + 1, status = IF(retry_count + 1 >= ?, 'failed', 'pending') WHERE id = ?",
          [limit, msgId]
        );
        const [rows] = await executor.execute("SELECT * FROM message_outbox WHERE id = ?", [msgId]);
        return mapMessage(rows[0]);
      },
      resetMessageToPending: async (id) => {
        const msgId = toNumberId(id);
        if (!msgId) return null;
        await executor.execute(
          "UPDATE message_outbox SET status = 'pending', retry_count = 0 WHERE id = ?",
          [msgId]
        );
        const [rows] = await executor.execute("SELECT * FROM message_outbox WHERE id = ?", [msgId]);
        return mapMessage(rows[0]);
      },
      retryFailedMessages: async (options = {}) => {
        let employeeIds = Array.isArray(options.employeeIds) ? options.employeeIds.map(toNumberId).filter(Boolean) : [];
        if (options.employeeId != null) employeeIds = [toNumberId(options.employeeId)].filter(Boolean);
        if (!employeeIds.length) return { count: 0 };
        const where = [`status = 'failed'`, `employee_id IN (${employeeIds.map(() => "?").join(",")})`];
        const params = [...employeeIds];
        if (options.type) {
          where.push("type = ?");
          params.push(String(options.type));
        }
        const [result] = await executor.execute(
          `UPDATE message_outbox SET status = 'pending', retry_count = 0 WHERE ${where.join(" AND ")}`,
          params
        );
        return { count: Number(result.affectedRows || 0) };
      },
      markMessageRead: async (employeeId, messageId) => {
        const empId = toNumberId(employeeId);
        const msgId = toNumberId(messageId);
        if (!empId || !msgId) return null;
        await executor.execute(
          "UPDATE message_outbox SET read_at = IFNULL(read_at, UTC_TIMESTAMP()) WHERE id = ? AND employee_id = ?",
          [msgId, empId]
        );
        const [rows] = await executor.execute("SELECT * FROM message_outbox WHERE id = ? AND employee_id = ?", [msgId, empId]);
        return mapMessage(rows[0]);
      },
      markAllMessagesRead: async (employeeId) => {
        const id = toNumberId(employeeId);
        if (!id) return { count: 0, readAt: null };
        const [result] = await executor.execute(
          "UPDATE message_outbox SET read_at = UTC_TIMESTAMP() WHERE employee_id = ? AND read_at IS NULL",
          [id]
        );
        const [rows] = await executor.execute(
          "SELECT MAX(read_at) AS read_at FROM message_outbox WHERE employee_id = ? AND read_at IS NOT NULL",
          [id]
        );
        return {
          count: Number(result.affectedRows || 0),
          readAt: rows[0]?.read_at ? new Date(rows[0].read_at).toISOString() : null
        };
      },
      countUnreadMessages: async (employeeId) => {
        const id = toNumberId(employeeId);
        if (!id) return 0;
        const [rows] = await executor.execute(
          "SELECT COUNT(1) AS cnt FROM message_outbox WHERE employee_id = ? AND read_at IS NULL",
          [id]
        );
        return Number(rows[0]?.cnt || 0);
      },
      countPendingMessages: async (employeeId) => {
        const id = toNumberId(employeeId);
        if (!id) return 0;
        const [rows] = await executor.execute(
          "SELECT COUNT(1) AS cnt FROM message_outbox WHERE employee_id = ? AND status = 'pending'",
          [id]
        );
        return Number(rows[0]?.cnt || 0);
      },
      dispatchPendingMessages: async () => {
        const claimed = await store.claimPendingMessages(50);
        for (const msg of claimed) await store.markMessageMockSent(msg.id);
        return claimed;
      },
      getAdminSeenAt: async (adminId, badgeKey) => {
        const id = toNumberId(adminId);
        const key = String(badgeKey || "").trim();
        if (!id || !key) return null;
        await ensureAdminSeenTable(executor);
        const [rows] = await executor.execute(
          "SELECT seen_at FROM admin_seen WHERE admin_id = ? AND badge_key = ?",
          [id, key]
        );
        if (!rows.length || !rows[0]?.seen_at) return null;
        return new Date(rows[0].seen_at).toISOString();
      },
      setAdminSeenAt: async (adminId, badgeKey, seenAt) => {
        const id = toNumberId(adminId);
        const key = String(badgeKey || "").trim();
        if (!id || !key) return null;
        await ensureAdminSeenTable(executor);
        const fallback = store.now();
        const value = seenAt ? new Date(String(seenAt)) : new Date(fallback);
        const date = Number.isNaN(value.getTime()) ? new Date(fallback) : value;
        await executor.execute(
          "INSERT INTO admin_seen (admin_id, badge_key, seen_at) VALUES (?,?,?) ON DUPLICATE KEY UPDATE seen_at=VALUES(seen_at)",
          [id, key, date]
        );
        return date.toISOString();
      }
    };
    return store;
  }

  return createQueryStore(pool);
}

function createStore() {
  if (process.env.MYSQL_HOST && !process.env.FORCE_MEMORY_STORE) return createMysqlStore();
  return createMemoryStore();
}

module.exports = { createStore, toNumberId };
