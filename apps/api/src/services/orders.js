const { createPointRecord } = require("./points");
const { requireManageEmployee } = require("./permissions");

async function redeemGift(store, employeeId, giftId) {
  return store.transaction(async (tx) => {
    const employee = await tx.getEmployee(employeeId, { forUpdate: true });
    const gift = await tx.getGift(giftId, { forUpdate: true });
    if (!employee || !gift || gift.status !== "active") {
      const error = new Error("礼品不存在或已下架");
      error.statusCode = 404;
      throw error;
    }
    if (gift.stock <= 0) {
      const error = new Error("库存不足");
      error.statusCode = 400;
      throw error;
    }
    if (employee.pointsBalance < gift.pointsCost) {
      const error = new Error("积分余额不足");
      error.statusCode = 400;
      throw error;
    }

    await tx.updateGiftStock(gift.id, -1);
    const order = await tx.createOrder({
      employeeId: employee.id,
      giftId: gift.id,
      giftName: gift.name,
      pointsCost: gift.pointsCost,
      status: "pending_review"
    });
    await createPointRecord(tx, {
      employeeId: employee.id,
      pointsDelta: -gift.pointsCost,
      type: "exchange",
      sourceType: "mall_order",
      sourceId: String(order.id),
      operatorId: null,
      operatorName: "系统",
      remark: `兑换礼品：${gift.name}`
    });
    await tx.log("order.created", employee.id, order);
    return order;
  });
}

async function updateOrderStatus(store, adminId, orderId, status, remark = "") {
  return store.transaction(async (tx) => {
    const admin = await tx.getAdmin(adminId);
    const order = await tx.getOrder(orderId, { forUpdate: true });
    if (!order) {
      const error = new Error("订单不存在");
      error.statusCode = 404;
      throw error;
    }
    const normalizedRemark = String(remark || "").trim();
    if ((status === "rejected" || status === "cancelled") && !normalizedRemark) {
      const error = new Error("处理备注不能为空");
      error.statusCode = 400;
      throw error;
    }
    const employee = await tx.getEmployee(order.employeeId);
    requireManageEmployee(admin, employee);
    const previous = order.status;
    const updated = await tx.updateOrder(order.id, {
      status,
      reviewRemark: normalizedRemark
    });

    if (["rejected", "cancelled"].includes(status) && !["rejected", "cancelled"].includes(previous)) {
      const gift = await tx.getGift(order.giftId, { forUpdate: true });
      if (gift) {
        await tx.updateGiftStock(gift.id, 1);
      }
      await createPointRecord(tx, {
        employeeId: order.employeeId,
        pointsDelta: order.pointsCost,
        type: "refund",
        sourceType: "mall_order_refund",
        sourceId: String(order.id),
        operatorId: adminId,
        operatorName: "管理员",
        remark: `订单${status === "rejected" ? "驳回" : "取消"}退回积分：${order.giftName}`
      });
    }

    await tx.log("order.status_changed", adminId, { orderId: order.id, previous, status });
    await tx.enqueueMessage("order_status", order.employeeId, {
      orderId: order.id,
      giftName: order.giftName,
      pointsCost: order.pointsCost,
      status,
      reviewRemark: normalizedRemark
    });
    return updated;
  });
}

module.exports = { redeemGift, updateOrderStatus };
