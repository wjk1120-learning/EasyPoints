# -*- coding: utf-8 -*-
"""L4 冒烟（第 2 页）：员工积分 — fixture 注入验证列表渲染/排序/搜索/双积分列"""
import json
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

from playwright.sync_api import sync_playwright

BASE = "http://localhost:5173"
FAILURES: list[str] = []

EMPLOYEES = [
    {"id": 2, "wecomUserId": "wecom_1002", "name": "李四", "departmentId": 1, "departmentName": "研发部", "pointsBalance": 860, "availablePoints": 860, "cumulativePoints": 1640, "status": "active", "createdAt": "2026-09-01 09:00:00"},
    {"id": 1, "wecomUserId": "wecom_1001", "name": "张三", "departmentId": 1, "departmentName": "研发部", "pointsBalance": 1189, "availablePoints": 1189, "cumulativePoints": 2380, "status": "active", "createdAt": "2026-09-01 09:00:00"},
    {"id": 3, "wecomUserId": "wecom_1003", "name": "王五", "departmentId": 2, "departmentName": "市场部", "pointsBalance": 1520, "availablePoints": 1520, "cumulativePoints": 2980, "status": "active", "createdAt": "2026-09-02 10:00:00"},
]


def check(name: str, ok: bool, detail: str = ""):
    print(("PASS " if ok else "FAIL ") + name + (f" | {detail}" if detail and not ok else ""))
    if not ok:
        FAILURES.append(name)


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    console_errors = []
    page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)

    employee_calls: list[str] = []

    def handle_employees(route):
        employee_calls.append(route.request.url)
        route.fulfill(status=200, content_type="application/json",
                      body=json.dumps({"code": 1, "msg": "成功", "data": {"total": len(EMPLOYEES), "rows": EMPLOYEES}}, ensure_ascii=False))

    page.route("**/admin/employees*", handle_employees)

    page.goto(BASE)
    page.wait_for_load_state("networkidle")
    page.locator("input").nth(0).fill("admin")
    page.locator("input").nth(1).fill("admin123")
    page.locator("button").filter(has_text="登").first.click()
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1200)

    page.goto(BASE + "/employee-points")
    page.wait_for_load_state("networkidle")
    page.wait_for_selector(".el-table__row", timeout=8000)

    check("GET /admin/employees 无分页参数全量拉取", all("page=" not in u for u in employee_calls), "; ".join(employee_calls))
    table_text = page.locator(".el-table").inner_text()
    for name in ["张三", "李四", "王五"]:
        check(f"表格渲染员工 {name}", name in table_text)
    check("双积分列渲染（可用+累计）", "1520" in table_text and "2980" in table_text)

    rows = page.locator(".el-table__row").all_inner_texts()
    order = [r.split("\n")[0] for r in rows]
    check("按可用积分降序排序", order[:3] == ["3", "1", "2"], f"order={order}")

    page.locator("input[placeholder*='搜索员工']").fill("张三")
    page.wait_for_timeout(600)
    visible = page.locator(".el-table__row").count()
    check("搜索过滤仅剩 1 行", visible == 1, f"visible={visible}")
    check("搜索后显示张三", "张三" in page.locator(".el-table").inner_text())

    # 清空搜索后验证列头排序（回归：sortable 缺 sort-method 时点击无效）
    page.locator("input[placeholder*='搜索员工']").fill("")
    page.wait_for_timeout(600)
    page.locator(".el-table__header th").nth(4).click()  # 累计积分列整格
    page.wait_for_timeout(500)
    rows = page.locator(".el-table__row").all_inner_texts()
    order = [r.split("\n")[0] for r in rows]
    check("点击累计积分列头升序排序", order[0] == "2", f"order={order}")  # 李四累计 1640 最低

    page.screenshot(path="tests/e2e/snapshots/step2_employees.png", full_page=True)
    js_errors = [e for e in console_errors if "Failed to load resource" not in e and "favicon" not in e.lower()]
    check("无 JS 运行错误", len(js_errors) == 0, "; ".join(js_errors[:3]))
    browser.close()

print(f"\nRESULT: {'ALL PASS' if not FAILURES else 'FAILED: ' + ', '.join(FAILURES)}")
sys.exit(0 if not FAILURES else 1)
