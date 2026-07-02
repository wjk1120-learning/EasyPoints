function canManageEmployee(admin, employee) {
  if (!admin || !employee) return false;
  if (admin.role === "super_admin" || admin.role === "hr_admin") return true;
  if (admin.role === "department_admin") {
    return admin.departmentIds.includes(employee.departmentId);
  }
  return false;
}

function requireManageEmployee(admin, employee) {
  if (!canManageEmployee(admin, employee)) {
    const error = new Error("无权操作该员工");
    error.statusCode = 403;
    throw error;
  }
}

module.exports = { canManageEmployee, requireManageEmployee };
