const test = require("node:test");
const assert = require("node:assert/strict");
process.env.FORCE_MEMORY_STORE = "1";
const { createStore } = require("../src/data/store");
const points = require("../src/services/points");
const appeals = require("../src/services/appeals");
const orders = require("../src/services/orders");
const wecom = require("../src/services/wecom");

test("单笔加减分必须填写备注", async () => {
  const store = createStore();
  await assert.rejects(
    () =>
      points.adjustment(store, 1, {
        employeeId: 1,
        pointsDelta: 10,
        remark: ""
      }),
    /必须填写变动原因备注/
  );
});

test("单笔扣分：选择扣分时会按负数计入", async () => {
  const store = createStore();
  const before = (await store.getEmployee(1)).pointsBalance;
  await points.adjustment(store, 1, {
    employeeId: 1,
    type: "penalty",
    pointsDelta: 10,
    remark: "违规扣分"
  });
  const after = (await store.getEmployee(1)).pointsBalance;
  assert.equal(after, before - 10);
  const records = await points.listEmployeeRecords(store, 1);
  assert.equal(records[0].type, "penalty");
  assert.equal(records[0].pointsDelta, -10);
});

test("月度批量录分支持统一备注和单人备注覆盖", async () => {
  const store = createStore();
  const records = await points.monthlyBatch(store, 1, {
    month: "2026-06",
    batchRemark: "本月工作优秀",
    items: [
      { employeeId: 1, pointsDelta: 100 },
      { employeeId: 2, pointsDelta: 80, remark: "项目攻坚奖励" }
    ]
  });
  assert.equal(records[0].remark, "本月工作优秀");
  assert.equal(records[1].remark, "项目攻坚奖励");
});

test("部门管理员不能操作非本部门员工", async () => {
  const store = createStore();
  await assert.rejects(
    () =>
      points.adjustment(store, 2, {
        employeeId: 2,
        pointsDelta: 10,
        remark: "跨部门测试"
      }),
    /无权操作该员工/
  );
});

test("员工只能申诉自己的积分流水", async () => {
  const store = createStore();
  const [record] = await points.monthlyBatch(store, 1, {
    month: "2026-06",
    batchRemark: "月度绩效",
    items: [{ employeeId: 1, pointsDelta: 100 }]
  });
  await assert.rejects(
    () =>
      appeals.createAppeal(store, 2, {
        pointRecordId: record.id,
        reason: "不是我的流水"
      }),
    /只能申诉本人存在的积分流水/
  );
});

test("积分流水创建后不可修改", () => {
  assert.throws(() => points.updatePointRecord(), /不可修改/);
});

test("员工积分明细返回完整备注", async () => {
  const store = createStore();
  await points.adjustment(store, 1, {
    employeeId: 1,
    pointsDelta: 30,
    remark: "项目攻坚奖励"
  });
  const records = await points.listEmployeeRecords(store, 1);
  assert.equal(records[0].remark, "项目攻坚奖励");
});

test("订单驳回退回积分、回补库存并生成退分流水", async () => {
  const store = createStore();
  const before = (await store.getEmployee(1)).pointsBalance;
  const giftBeforeStock = (await store.getGift(1)).stock;
  const order = await orders.redeemGift(store, 1, 1);
  assert.equal((await store.getEmployee(1)).pointsBalance, before - 1000);
  assert.equal((await store.getGift(1)).stock, giftBeforeStock - 1);
  await orders.updateOrderStatus(store, 1, order.id, "rejected", "库存异常");
  assert.equal((await store.getEmployee(1)).pointsBalance, before);
  assert.equal((await store.getGift(1)).stock, giftBeforeStock);
  const records = await store.listPointRecordsByEmployee(1);
  assert.equal(records.at(-1).type, "refund");
});

test("订单驳回必须填写处理备注", async () => {
  const store = createStore();
  const order = await orders.redeemGift(store, 1, 1);
  await assert.rejects(() => orders.updateOrderStatus(store, 1, order.id, "rejected", ""), /处理备注不能为空/);
});

test("角标：分页查询支持 createdAfter 过滤", async () => {
  const store = createStore();
  store.now = () => "2026-06-01T00:00:00.000Z";
  const [record] = await points.monthlyBatch(store, 1, {
    month: "2026-06",
    batchRemark: "月度绩效",
    items: [{ employeeId: 1, pointsDelta: 10 }]
  });

  store.now = () => "2026-06-02T00:00:00.000Z";
  await appeals.createAppeal(store, 1, { pointRecordId: record.id, reason: "第一次申诉" });
  store.now = () => "2026-06-03T00:00:00.000Z";
  await appeals.createAppeal(store, 1, { pointRecordId: record.id, reason: "第二次申诉" });

  const appealsPaged = await store.listAppealsPaged({
    page: 1,
    pageSize: 1,
    status: "pending_department_review",
    createdAfter: "2026-06-02T00:00:00.000Z"
  });
  assert.equal(appealsPaged.total, 1);

  store.now = () => "2026-06-03T12:00:00.000Z";
  await points.adjustment(store, 1, { employeeId: 1, pointsDelta: 5000, remark: "补足兑换积分" });
  store.now = () => "2026-06-04T00:00:00.000Z";
  await orders.redeemGift(store, 1, 1);
  store.now = () => "2026-06-05T00:00:00.000Z";
  await orders.redeemGift(store, 1, 1);

  const ordersPaged = await store.listOrdersPaged({
    page: 1,
    pageSize: 1,
    status: "pending_review",
    createdAfter: "2026-06-04T00:00:00.000Z"
  });
  assert.equal(ordersPaged.total, 1);
});

test("角标：管理员已读时间可记录", async () => {
  const store = createStore();
  assert.equal(await store.getAdminSeenAt(1, "appeals"), null);
  store.now = () => "2026-06-06T00:00:00.000Z";
  const seenAt = await store.setAdminSeenAt(1, "appeals");
  assert.equal(seenAt, "2026-06-06T00:00:00.000Z");
  assert.equal(await store.getAdminSeenAt(1, "appeals"), "2026-06-06T00:00:00.000Z");
});

test("outbox：积分变动会入队消息，派发后状态变更", async () => {
  const store = createStore();
  await points.adjustment(store, 1, {
    employeeId: 1,
    pointsDelta: 10,
    remark: "消息派发测试"
  });
  assert.equal(await store.countPendingMessages(1), 1);
  const result = await wecom.dispatchPendingMessages(store);
  assert.equal(result.sent.length, 1);
  assert.equal(result.failed.length, 0);
  assert.equal(await store.countPendingMessages(1), 0);
  assert.equal(store.state.messageOutbox[0].status, "mock_sent");
});

test("outbox：发送失败会重试，超过上限标记失败", async () => {
  const store = createStore();
  await store.enqueueMessage("test", 1, { hello: "world" });
  process.env.WECOM_MOCK_FAIL = "1";
  try {
    await wecom.dispatchPendingMessages(store);
    assert.equal(store.state.messageOutbox[0].retryCount, 1);
    assert.equal(store.state.messageOutbox[0].status, "pending");
    await wecom.dispatchPendingMessages(store);
    await wecom.dispatchPendingMessages(store);
    assert.equal(store.state.messageOutbox[0].retryCount, 3);
    assert.equal(store.state.messageOutbox[0].status, "failed");
  } finally {
    delete process.env.WECOM_MOCK_FAIL;
  }
});

test("outbox：processing 超时会回收为 pending", async () => {
  const store = createStore();
  process.env.OUTBOX_PROCESSING_TIMEOUT_SEC = "1";
  try {
    await store.enqueueMessage("test", 1, { hello: "world" });
    const firstClaim = await store.claimPendingMessages(1);
    assert.equal(firstClaim.length, 1);
    store.state.messageOutbox[0].updatedAt = new Date(Date.now() - 2000).toISOString();
    const secondClaim = await store.claimPendingMessages(1);
    assert.equal(secondClaim.length, 1);
    assert.equal(store.state.messageOutbox[0].status, "processing");
  } finally {
    delete process.env.OUTBOX_PROCESSING_TIMEOUT_SEC;
  }
});

test("outbox：批量重试失败消息", async () => {
  const store = createStore();
  await store.enqueueMessage("t1", 1, {});
  await store.enqueueMessage("t2", 2, {});
  await store.markMessageFailed(1, 1);
  await store.markMessageFailed(2, 1);
  const result = await store.retryFailedMessages({ employeeIds: [2], type: "t2" });
  assert.equal(result.count, 1);
  assert.equal(store.state.messageOutbox[0].status, "failed");
  assert.equal(store.state.messageOutbox[1].status, "pending");
  assert.equal(store.state.messageOutbox[1].retryCount, 0);
});

test("权限：部门管理员不能审核其它部门员工的申诉", async () => {
  const store = createStore();
  await points.adjustment(store, 1, {
    employeeId: 2,
    pointsDelta: 10,
    remark: "申诉测试"
  });
  const employee2Records = await store.listPointRecordsByEmployee(2);
  const appeal = await appeals.createAppeal(store, 2, {
    pointRecordId: employee2Records[0].id,
    reason: "我要申诉"
  });
  await assert.rejects(
    () =>
      appeals.reviewAppeal(store, 2, appeal.id, {
        stage: "department",
        status: "rejected",
        resultRemark: "不通过"
      }),
    /无权操作该员工/
  );
});

test("权限：部门管理员不能处理其它部门员工的订单", async () => {
  const store = createStore();
  await points.adjustment(store, 1, {
    employeeId: 2,
    pointsDelta: 500,
    remark: "补足积分用于兑换"
  });
  const order = await orders.redeemGift(store, 2, 1);
  await assert.rejects(() => orders.updateOrderStatus(store, 2, order.id, "rejected", "无权限"), /无权操作该员工/);
});

test("礼品管理：支持创建、上下架、设置封面图", async () => {
  const store = createStore();
  assert.equal(typeof store.createGift, "function");
  assert.equal(typeof store.updateGift, "function");

  const created = await store.createGift({
    name: "测试礼品",
    pointsCost: 10,
    stock: 3,
    status: "inactive",
    limitPerUser: 1
  });
  assert.ok(created?.id);
  assert.equal(created.status, "inactive");
  assert.equal(created.limitPerUser, 1);

  const updated = await store.updateGift(created.id, { status: "active", coverImageUrl: "/uploads/gifts/1/cover.png" });
  assert.equal(updated.status, "active");
  assert.equal(updated.coverImageUrl, "/uploads/gifts/1/cover.png");
});
