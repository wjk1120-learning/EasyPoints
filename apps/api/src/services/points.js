const { requireManageEmployee } = require("./permissions");

const immutableFields = ["employeeId", "pointsDelta", "remark"];

function normalizeRemark(value) {
  return String(value || "").trim();
}

function assertRemark(value, message = "积分备注不能为空") {
  if (!normalizeRemark(value)) {
    const error = new Error(message);
    error.statusCode = 400;
    throw error;
  }
}

async function createPointRecord(store, input) {
  const employee = await store.getEmployee(input.employeeId);
  if (!employee) {
    const error = new Error("员工不存在");
    error.statusCode = 404;
    throw error;
  }

  const rawPointsDelta = Number(input.pointsDelta);
  if (!Number.isFinite(rawPointsDelta) || rawPointsDelta === 0) {
    const error = new Error("积分变动值必须为非零数字");
    error.statusCode = 400;
    throw error;
  }

  assertRemark(input.remark);

  const pointsDelta =
    input.type === "reward"
      ? Math.abs(rawPointsDelta)
      : input.type === "penalty"
        ? -Math.abs(rawPointsDelta)
        : rawPointsDelta;

  const record = await store.createPointRecord({
    employeeId: employee.id,
    pointsDelta,
    type: input.type || (pointsDelta > 0 ? "reward" : "penalty"),
    sourceType: input.sourceType,
    sourceId: input.sourceId ?? null,
    operatorId: input.operatorId ?? null,
    operatorName: input.operatorName,
    remark: normalizeRemark(input.remark),
    occurredAt: input.occurredAt,
    reversalOfId: input.reversalOfId ?? null
  });
  await store.log("point_record.created", input.operatorId ?? "system", record);
  const updatedEmployee = await store.getEmployee(employee.id);
  await store.enqueueMessage("point_changed", employee.id, {
    pointsDelta: record.pointsDelta,
    balance: updatedEmployee?.pointsBalance ?? null,
    remark: record.remark
  });
  return record;
}

async function adjustment(store, adminId, payload) {
  return store.transaction(async (tx) => {
    const admin = await tx.getAdmin(adminId);
    const employee = await tx.getEmployee(payload.employeeId);
    requireManageEmployee(admin, employee);
    assertRemark(payload.remark, "单笔奖惩积分必须填写变动原因备注");

    return createPointRecord(tx, {
      employeeId: payload.employeeId,
      pointsDelta: payload.pointsDelta,
      type: payload.type,
      sourceType: "manual_adjustment",
      operatorId: admin.id,
      operatorName: admin.name,
      remark: payload.remark
    });
  });
}

async function monthlyBatch(store, adminId, payload) {
  return store.transaction(async (tx) => {
    const admin = await tx.getAdmin(adminId);
    const batchRemark = normalizeRemark(payload.batchRemark);
    const records = [];

    for (const item of payload.items || []) {
      const employee = await tx.getEmployee(item.employeeId);
      requireManageEmployee(admin, employee);
      const remark = normalizeRemark(item.remark) || batchRemark;
      assertRemark(remark, "月度批量录分必须填写统一备注或单人备注");
      records.push(
        await createPointRecord(tx, {
          employeeId: item.employeeId,
          pointsDelta: item.pointsDelta,
          type: "performance",
          sourceType: "monthly_performance",
          sourceId: payload.month,
          operatorId: admin.id,
          operatorName: admin.name,
          remark
        })
      );
    }

    return records;
  });
}

async function listEmployeeRecords(store, employeeId) {
  const records = await store.listPointRecordsByEmployee(employeeId);
  return records
    .slice()
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .map((record) => ({ ...record, month: record.occurredAt.slice(0, 7) }));
}

function updatePointRecord() {
  const error = new Error(`积分流水创建后不可修改：${immutableFields.join(", ")}`);
  error.statusCode = 405;
  throw error;
}

async function reverseRecord(store, adminId, recordId, remark) {
  return store.transaction(async (tx) => {
    const admin = await tx.getAdmin(adminId);
    const original = await tx.getPointRecord(recordId);
    if (!original) {
      const error = new Error("原积分流水不存在");
      error.statusCode = 404;
      throw error;
    }
    const employee = await tx.getEmployee(original.employeeId);
    requireManageEmployee(admin, employee);
    assertRemark(remark, "冲正必须填写原因备注");

    return createPointRecord(tx, {
      employeeId: original.employeeId,
      pointsDelta: -original.pointsDelta,
      type: "reversal",
      sourceType: "reversal",
      sourceId: String(original.id),
      operatorId: admin.id,
      operatorName: admin.name,
      remark,
      reversalOfId: original.id
    });
  });
}

module.exports = {
  createPointRecord,
  adjustment,
  monthlyBatch,
  listEmployeeRecords,
  reverseRecord,
  updatePointRecord
};
