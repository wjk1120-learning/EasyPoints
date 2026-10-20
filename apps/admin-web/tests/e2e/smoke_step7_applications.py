# -*- coding: utf-8 -*-
"""L4 冒烟（第 7 页）：积分申请审核 — fixture 注入验证列表渲染/通过审核链路（mock 已拆除）"""
import json
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

from playwright.sync_api import sync_playwright

BASE = "http://localhost:5173"
FAILURES: list[str] = []

EMPLOYEES = [
    {"id": 1, "wecomUserId": "w1", "name": "张三", "departmentId": 1, "departmentName": "研发部", "pointsBalance": 100, "availablePoints": 100, "cumulativePoints": 200, "status": "active", "createdAt": "2026-09-01 09:00:00"},
]
APPLICATIONS = [
    {"id": 31, "employeeId": 1, "employeeName": "张三", "points": 50, "reason": "完成跨部门支持",
     "evidenceImages": [], "status": "pending_review", "statusText": "待审核", "reviewRemark": None,
     "reviewerId": None, "reviewedBy": None, "reviewedAt": None,
     "createdAt": "2026-10-10 09:00:00", "updatedAt": "2026-10-10 09:00:00"},
]
review_bodies: list[tuple[str, dict]] = []


def check(name: str, ok: bool, detail: str = ""):
    print(("PASS " if ok else "FAIL ") + name + (f" | {detail}" if detail and not ok else ""))
    if not ok:
        FAILURES.append(name)


def paged(rows):
    return json.dumps({"code": 1, "msg": "成功", "data": {"total": len(rows), "rows": rows}}, ensure_ascii=False)


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    console_errors = []
    page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)

    def handle(route):
        url, method = route.request.url, route.request.method
        if "/admin/employees" in url:
            route.fulfill(status=200, content_type="application/json", body=paged(EMPLOYEES))
        elif "/admin/applications" in url and method == "GET":
            route.fulfill(status=200, content_type="application/json", body=paged(APPLICATIONS))
        elif "/admin/applications/" in url and url.endswith("/review") and method == "POST":
            review_bodies.append((url, route.request.post_data_json))
            route.fulfill(status=200, content_type="application/json", body=paged([]))
        elif any(k in url for k in ("/admin/task-records", "/admin/orders", "/admin/appeals")):
            route.fulfill(status=200, content_type="application/json", body=paged([]))
        elif "/admin/" in url:
            route.fulfill(status=200, content_type="application/json",
                          body=json.dumps({"code": 1, "msg": "成功", "data": {"total": 0, "rows": []}}, ensure_ascii=False))
        else:
            route.continue_()

    # 兜底：未显式拦截的 /admin 请求返回空 PageResult（终态 BaseResult 口径；先注册=低优先级）
    page.route("**/admin/**", lambda route: route.fulfill(
        status=200, content_type="application/json",
        body=json.dumps({"code": 1, "msg": "成功", "data": {"total": 0, "rows": []}}, ensure_ascii=False)))
    page.route("**/admin/**", handle)
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

    page.goto(BASE + "/review-center?tab=application")
    page.wait_for_selector(".el-table__row", timeout=8000)

    table_text = page.locator(".el-table").inner_text()
    check("待审行渲染（张三 +50 完成跨部门支持）", "张三" in table_text and "完成跨部门支持" in table_text and "+50" in table_text)

    page.locator(".el-table__row").first.locator("button").filter(has_text="通过").click()
    page.wait_for_selector(".el-message-box", timeout=5000)
    check("通过确认弹窗（无开发术语）", "积分申请" in page.locator(".el-message-box").inner_text() and "双积分" not in page.locator(".el-message-box").inner_text())
    page.locator(".el-message-box button").filter(has_text="确认通过").click()
    page.wait_for_timeout(1000)

    check("POST /admin/applications/31/review 已发出", len(review_bodies) == 1, f"calls={review_bodies}")
    if review_bodies:
        _, body = review_bodies[0]
        check("审核 payload {status:'approved', remark}", body.get("status") == "approved" and isinstance(body.get("remark"), str), json.dumps(body, ensure_ascii=False))
    check("成功提示为业务视角文案", "积分申请已通过" in page.locator("body").inner_text())

    page.screenshot(path="tests/e2e/snapshots/step7_applications.png", full_page=True)
    js_errors = [e for e in console_errors if "Failed to load resource" not in e and "favicon" not in e.lower()]
    check("无 JS 运行错误", len(js_errors) == 0, "; ".join(js_errors[:3]))
    browser.close()

print(f"\nRESULT: {'ALL PASS' if not FAILURES else 'FAILED: ' + ', '.join(FAILURES)}")
sys.exit(0 if not FAILURES else 1)
