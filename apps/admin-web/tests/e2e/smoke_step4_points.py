# -*- coding: utf-8 -*-
"""L4 冒烟（第 4 页）：积分录入 — 真实浏览器验证单笔提交 payload 与批量高危确认链路"""
import json
import re
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

from playwright.sync_api import sync_playwright

BASE = "http://localhost:5173"
FAILURES: list[str] = []

EMPLOYEES = [
    {"id": 1, "wecomUserId": "w1", "name": "张三", "departmentId": 1, "departmentName": "研发部", "pointsBalance": 100, "availablePoints": 100, "cumulativePoints": 200, "status": "active", "createdAt": "2026-09-01 09:00:00"},
    {"id": 2, "wecomUserId": "w2", "name": "李四", "departmentId": 1, "departmentName": "研发部", "pointsBalance": 80, "availablePoints": 80, "cumulativePoints": 160, "status": "active", "createdAt": "2026-09-01 09:00:00"},
]
adjust_bodies: list[dict] = []
batch_bodies: list[dict] = []


def check(name: str, ok: bool, detail: str = ""):
    print(("PASS " if ok else "FAIL ") + name + (f" | {detail}" if detail and not ok else ""))
    if not ok:
        FAILURES.append(name)


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    console_errors = []
    page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)

    def fulfill_list(route):
        route.fulfill(status=200, content_type="application/json",
                      body=json.dumps({"code": 1, "msg": "成功", "data": {"total": len(EMPLOYEES), "rows": EMPLOYEES}}, ensure_ascii=False))

    def handle_api(route):
        url, method = route.request.url, route.request.method
        if "/admin/employees" in url:
            fulfill_list(route)
        elif url.endswith("/admin/points/adjustment") and method == "POST":
            adjust_bodies.append(route.request.post_data_json)
            route.fulfill(status=200, content_type="application/json",
                          body=json.dumps({"code": 1, "msg": "成功", "data": {"id": 201, "pointsDelta": 10, "type": "reward"}}, ensure_ascii=False))
        elif url.endswith("/admin/points/monthly-batch") and method == "POST":
            batch_bodies.append(route.request.post_data_json)
            route.fulfill(status=200, content_type="application/json",
                          body=json.dumps({"code": 1, "msg": "成功", "data": []}, ensure_ascii=False))
        elif "/admin/" in url:
            route.fulfill(status=200, content_type="application/json",
                          body=json.dumps({"code": 1, "msg": "成功", "data": {"total": 0, "rows": []}}, ensure_ascii=False))
        else:
            route.continue_()

    # 兜底：未显式拦截的 /admin 请求返回空 PageResult（终态 BaseResult 口径；先注册=低优先级）
    page.route("**/admin/**", lambda route: route.fulfill(
        status=200, content_type="application/json",
        body=json.dumps({"code": 1, "msg": "成功", "data": {"total": 0, "rows": []}}, ensure_ascii=False)))
    page.route("**/admin/**", handle_api)
    # 登录接口 fixture（终态 unwrap 只认 BaseResult；接新后端后可移除）
    page.route("**/admin/auth/login", lambda route: route.fulfill(
        status=200, content_type="application/json",
        body=json.dumps({"code": 1, "msg": "成功", "data": {"token": "fake-token", "admin": {"id": 1, "username": "admin", "name": "系统管理员", "role": "super_admin", "departmentIds": []}}}, ensure_ascii=False)))

    page.goto(BASE)
    page.wait_for_load_state("networkidle")
    page.locator("input").nth(0).fill("admin")
    page.locator("input").nth(1).fill("admin123")
    page.locator("button").filter(has_text="登").first.click()
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1200)

    page.goto(BASE + "/points")
    page.wait_for_selector(".panel-left", timeout=8000)
    page.wait_for_timeout(800)

    # ---- 单笔奖惩：默认 reward +10，备注必填 ----
    left = page.locator(".panel-left")
    # 空备注提交被前端拦截（若有 required 校验）或直接提交带空备注——页面用后端校验，此处直接填备注
    left.locator("textarea").fill("客户表扬")
    left.locator("button").filter(has_text="提交").click()
    page.wait_for_timeout(1000)

    check("单笔 POST adjustment 已发出", len(adjust_bodies) == 1, f"count={len(adjust_bodies)}")
    if adjust_bodies:
        body = adjust_bodies[0]
        check("单笔 payload 四字段且符号为正", body.get("employeeId") == 1 and body.get("type") == "reward"
              and body.get("pointsDelta", 0) > 0 and body.get("remark") == "客户表扬", json.dumps(body, ensure_ascii=False))

    # ---- 批量：部门勾选加入名单 ----
    right = page.locator(".panel-right")
    right.locator(".batch-scope .el-select").first.click()
    page.wait_for_timeout(500)
    page.locator(".el-select-dropdown__item").filter(has_text=re.compile("^研发部$")).first.click()
    page.wait_for_timeout(600)
    row_count = right.locator(".el-table__row").count()
    check("勾选部门后名单加入 2 人", row_count == 2, f"rows={row_count}")

    # 填分
    inputs = right.locator(".el-table__row .el-input-number input")
    inputs.nth(0).fill("50")
    inputs.nth(1).fill("30")
    right.locator("textarea").fill("10月绩效")
    right.locator("button").filter(has_text="提交").click()
    page.wait_for_selector(".el-message-box", timeout=5000)
    check("高危确认弹窗出现", "高危操作确认" in page.locator(".el-message-box__title").inner_text())
    page.locator(".el-message-box button").filter(has_text="确认提交").click()
    page.wait_for_timeout(1000)

    check("批量 POST monthly-batch 已发出", len(batch_bodies) == 1, f"count={len(batch_bodies)}")
    if batch_bodies:
        body = batch_bodies[0]
        check("批量 payload 结构（month/batchRemark/items×2）",
              re.match(r"^\d{4}-\d{2}$", body.get("month", "")) and body.get("batchRemark") == "10月绩效"
              and isinstance(body.get("items"), list) and len(body["items"]) == 2,
              json.dumps(body, ensure_ascii=False)[:150])

    page.screenshot(path="tests/e2e/snapshots/step4_points.png", full_page=True)
    js_errors = [e for e in console_errors if "Failed to load resource" not in e and "favicon" not in e.lower()]
    check("无 JS 运行错误", len(js_errors) == 0, "; ".join(js_errors[:3]))
    browser.close()

print(f"\nRESULT: {'ALL PASS' if not FAILURES else 'FAILED: ' + ', '.join(FAILURES)}")
sys.exit(0 if not FAILURES else 1)
