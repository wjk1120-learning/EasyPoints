const { requireManageEmployee } = require("./permissions");

async function createAppeal(store, employeeId, payload) {
  return store.transaction(async (tx) => {
    const record = await tx.getPointRecord(payload.pointRecordId);
    if (!record || record.employeeId !== Number(employeeId)) {
      const error = new Error("只能申诉本人存在的积分流水");
      error.statusCode = 400;
      throw error;
    }
    const reason = String(payload.reason || "").trim();
    if (!reason) {
      const error = new Error("申诉原因不能为空");
      error.statusCode = 400;
      throw error;
    }
    const appeal = await tx.createAppeal({
      pointRecordId: record.id,
      employeeId: Number(employeeId),
      reason,
      status: "pending_department_review",
      departmentReviewerId: null,
      hrReviewerId: null,
      resultRemark: null
    });
    await tx.log("appeal.created", employeeId, appeal);
    return appeal;
  });
}

async function reviewAppeal(store, adminId, appealId, payload) {
  return store.transaction(async (tx) => {
    const admin = await tx.getAdmin(adminId);
    const existing = await tx.getAppeal(appealId);
    if (!existing) {
      const error = new Error("申诉不存在");
      error.statusCode = 404;
      throw error;
    }
    const employee = await tx.getEmployee(existing.employeeId);
    requireManageEmployee(admin, employee);
    const resultRemark = String(payload.resultRemark || "").trim();
    if (!resultRemark) {
      const error = new Error("处理备注不能为空");
      error.statusCode = 400;
      throw error;
    }
    const patch = {
      status: payload.status,
      resultRemark,
      departmentReviewerId: payload.stage === "hr" ? null : Number(adminId),
      hrReviewerId: payload.stage === "hr" ? Number(adminId) : null
    };
    const appeal = await tx.updateAppeal(appealId, patch);
    await tx.log("appeal.reviewed", adminId, appeal);
    await tx.enqueueMessage("appeal_result", appeal.employeeId, {
      reason: existing.reason,
      status: appeal.status,
      resultRemark: appeal.resultRemark
    });
    return appeal;
  });
}

module.exports = { createAppeal, reviewAppeal };
