const test = require("node:test");
const assert = require("node:assert/strict");
const { Readable } = require("node:stream");

process.env.FORCE_MEMORY_STORE = "1";

const { createApp } = require("../src/app");
const { createStore } = require("../src/data/store");

function createRequest({ method = "GET", url = "/", headers = {}, body = "" } = {}) {
  const req = Readable.from(body ? [body] : []);
  req.method = method;
  req.url = url;
  req.headers = headers;
  return req;
}

function createResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: "",
    writeHead(statusCode, headers) {
      this.statusCode = statusCode;
      this.headers = headers;
    },
    end(chunk = "") {
      this.body += chunk;
    }
  };
}

async function call(app, options) {
  const req = createRequest(options);
  const res = createResponse();
  await app.handler(req, res);
  return {
    statusCode: res.statusCode,
    headers: res.headers,
    json: res.body ? JSON.parse(res.body) : null
  };
}

test("员工端通知列表返回当前员工的格式化通知", async () => {
  const store = createStore();
  await store.enqueueMessage("point_changed", 1, {
    pointsDelta: 10,
    balance: 110,
    remark: "项目攻坚奖励"
  });
  await store.enqueueMessage("order_status", 1, {
    orderId: 9,
    giftName: "大疆无人机",
    pointsCost: 10000,
    status: "rejected",
    reviewRemark: "库存不足"
  });
  await store.enqueueMessage("appeal_result", 1, {
    status: "approved",
    resultRemark: "已核实通过"
  });
  await store.enqueueMessage("point_changed", 2, {
    pointsDelta: 99,
    balance: 999,
    remark: "不应出现在当前员工列表"
  });

  const app = createApp(store);
  const response = await call(app, {
    method: "GET",
    url: "/miniapp/messages",
    headers: { "x-employee-id": "1" }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json.data.length, 3);
  assert.deepEqual(
    response.json.data.map((item) => item.title),
    ["申诉处理结果", "订单状态更新", "积分变动通知"]
  );
  assert.match(response.json.data[0].summary, /处理结果：申诉通过；处理备注：已核实通过/);
  assert.match(response.json.data[1].summary, /礼品：大疆无人机；积分：10000；状态：已驳回；处理备注：库存不足/);
  assert.match(response.json.data[2].summary, /\+10 分，当前余额 110，备注：项目攻坚奖励/);
  assert.deepEqual(
    response.json.data.map((item) => item.statusText),
    ["待发送", "待发送", "待发送"]
  );
  assert.deepEqual(
    response.json.data.map((item) => item.isRead),
    [false, false, false]
  );
});

test("员工端通知列表支持分页元信息", async () => {
  const store = createStore();
  await store.enqueueMessage("point_changed", 1, { pointsDelta: 1, balance: 101, remark: "a" });
  await store.enqueueMessage("point_changed", 1, { pointsDelta: 2, balance: 103, remark: "b" });

  const app = createApp(store);
  const response = await call(app, {
    method: "GET",
    url: "/miniapp/messages?page=1&pageSize=1",
    headers: { "x-employee-id": "1" }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json.data.length, 1);
  assert.equal(response.json.meta.total, 2);
  assert.equal(response.json.meta.page, 1);
  assert.equal(response.json.meta.pageSize, 1);
});

test("员工端通知支持全部标记已读，首页未读数随之变化", async () => {
  const store = createStore();
  await store.enqueueMessage("point_changed", 1, { pointsDelta: 1, balance: 101, remark: "a" });
  await store.enqueueMessage("order_status", 1, { orderId: 2, status: "approved" });

  const app = createApp(store);

  const homeBefore = await call(app, {
    method: "GET",
    url: "/miniapp/home",
    headers: { "x-employee-id": "1" }
  });
  assert.equal(homeBefore.statusCode, 200);
  assert.equal(homeBefore.json.data.unreadMessages, 2);

  const readAll = await call(app, {
    method: "POST",
    url: "/miniapp/messages/read-all",
    headers: { "x-employee-id": "1" }
  });
  assert.equal(readAll.statusCode, 200);
  assert.equal(readAll.json.data.count, 2);

  const listAfter = await call(app, {
    method: "GET",
    url: "/miniapp/messages",
    headers: { "x-employee-id": "1" }
  });
  assert.equal(listAfter.statusCode, 200);
  assert.deepEqual(
    listAfter.json.data.map((item) => item.isRead),
    [true, true]
  );

  const homeAfter = await call(app, {
    method: "GET",
    url: "/miniapp/home",
    headers: { "x-employee-id": "1" }
  });
  assert.equal(homeAfter.statusCode, 200);
  assert.equal(homeAfter.json.data.unreadMessages, 0);
});

test("员工端通知支持单条已读与未读筛选", async () => {
  const store = createStore();
  const m1 = await store.enqueueMessage("point_changed", 1, { pointsDelta: 1, balance: 101, remark: "a" });
  const m2 = await store.enqueueMessage("order_status", 1, { orderId: 2, status: "approved" });
  await store.enqueueMessage("point_changed", 2, { pointsDelta: 9, balance: 9, remark: "skip" });

  const app = createApp(store);

  const unreadList = await call(app, {
    method: "GET",
    url: "/miniapp/messages?unreadOnly=1",
    headers: { "x-employee-id": "1" }
  });
  assert.equal(unreadList.statusCode, 200);
  assert.equal(unreadList.json.data.length, 2);

  const readOne = await call(app, {
    method: "POST",
    url: `/miniapp/messages/${m2.id}/read`,
    headers: { "x-employee-id": "1" }
  });
  assert.equal(readOne.statusCode, 200);
  assert.equal(readOne.json.data.id, m2.id);
  assert.equal(readOne.json.data.isRead, true);
  assert.ok(readOne.json.data.readAt);

  const unreadListAfter = await call(app, {
    method: "GET",
    url: "/miniapp/messages?unreadOnly=1",
    headers: { "x-employee-id": "1" }
  });
  assert.equal(unreadListAfter.statusCode, 200);
  assert.equal(unreadListAfter.json.data.length, 1);
  assert.equal(unreadListAfter.json.data[0].id, m1.id);

  const homeAfter = await call(app, {
    method: "GET",
    url: "/miniapp/home",
    headers: { "x-employee-id": "1" }
  });
  assert.equal(homeAfter.statusCode, 200);
  assert.equal(homeAfter.json.data.unreadMessages, 1);
});

test("管理端操作日志返回中文审计摘要与关联 trace_id", async () => {
  const store = createStore();
  const order = await store.createOrder({
    employeeId: 1,
    giftId: 3,
    giftName: "大疆无人机",
    pointsCost: 10000,
    status: "pending_review"
  });
  await store.log("order.created", 1, {
    id: order.id,
    employeeId: 1,
    giftName: "大疆无人机",
    pointsCost: 10000,
    status: "pending_review"
  });
  await store.log("point_record.created", "system", {
    employeeId: 1,
    pointsDelta: -10000,
    type: "exchange",
    sourceType: "mall_order",
    sourceId: String(order.id)
  });
  await store.log("order.status_changed", 1, {
    orderId: order.id,
    previous: "pending_review",
    status: "rejected"
  });
  await store.log("point_record.created", 1, {
    employeeId: 1,
    pointsDelta: 10000,
    type: "refund",
    sourceType: "mall_order_refund",
    sourceId: String(order.id),
    remark: "订单驳回退回积分：大疆无人机"
  });

  const app = createApp(store);
  const response = await call(app, {
    method: "GET",
    url: "/admin/operation-logs?page=1&pageSize=10",
    headers: { "x-admin-id": "1" }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json.data.length, 4);

  const [refundLog, statusLog, deductionLog, createLog] = response.json.data;
  assert.match(createLog.traceId, /^trace-\d{8}-order-create-/);
  assert.equal(createLog.traceId, deductionLog.traceId);
  assert.equal(statusLog.traceId, refundLog.traceId);
  assert.equal(createLog.actionText, "订单创建");
  assert.match(createLog.businessSummary, /创建兑换订单 ID:\d+，礼品：大疆无人机，扣减积分 10000/);
  assert.equal(deductionLog.actionText, "积分扣减");
  assert.match(deductionLog.businessSummary, /扣减张三 \(1\) 积分 10000 分，来源：兑换订单 ID:\d+/);
  assert.equal(refundLog.actionText, "积分回退");
  assert.match(refundLog.businessSummary, /回退张三 \(1\) 积分 10000 分，来源：订单驳回 ID:\d+/);
  assert.equal(statusLog.resultText, "成功");
});

test("员工端大厅返回全员积分变动（仅 PC 侧来源）", async () => {
  const store = createStore();
  const app = createApp(store);

  const response = await call(app, {
    method: "GET",
    url: "/miniapp/hall?page=1&pageSize=50",
    headers: { "x-employee-id": "1" }
  });

  assert.equal(response.statusCode, 200);
  assert.ok(Array.isArray(response.json.data));
  assert.ok(response.json.data.every((row) => ["manual_adjustment", "monthly_performance", "reversal"].includes(row.sourceType)));
});

test("员工端大厅未读数基于 hallSeenAt 统计", async () => {
  const store = createStore();
  const app = createApp(store);

  const before = await call(app, {
    method: "GET",
    url: "/miniapp/hall/unread-count?since=2026-01-01T00:00:00.000Z",
    headers: { "x-employee-id": "1" }
  });
  assert.equal(before.statusCode, 200);
  const beforeCount = Number(before.json.data.count || 0);

  const points = require("../src/services/points");
  await points.adjustment(store, 1, { employeeId: 2, pointsDelta: 5, remark: "测试加分" });

  const after = await call(app, {
    method: "GET",
    url: "/miniapp/hall/unread-count?since=2026-01-01T00:00:00.000Z",
    headers: { "x-employee-id": "1" }
  });
  assert.equal(after.statusCode, 200);
  assert.equal(Number(after.json.data.count || 0), beforeCount + 1);
});
