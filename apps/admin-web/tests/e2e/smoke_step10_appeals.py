# -*- coding: utf-8 -*-
"""L4 冒烟（第 10 页）：申诉工单 — fixture 注入验证三态列表/处理 payload（无 stage）/详情 targetSummary"""
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
APPEALS = [
    {"id": 21, "targetType": "point_record", "targetId": 101, "pointRecordId": 101,
     "pointRecord": {"id": 101, "employeeId": 1, "pointsDelta": -50, "type": "penalty", "remark": "月度检查不合格扣分", "occurredAt": "2026-10-09 15:30:00"},
     "employeeId": 1, "employeeName": "张三", "reason": "当月有客户表扬，不应扣分",
     "evidenceImages": "[\"/uploads/ev/a1.png\"]",
     "targetSummary": {"title": "积分流水 #101", "content": "月度检查不合格扣分", "reviewRemark": None},
     "status": "pending_review", "statusText": "待审核", "resolution": None, "reviewerId": None, "resultRemark": None,
     "createdAt": "2026-10-10 10:00:00", "updatedAt": "2026-10-10 10:00:00"},
    {"id": 22, "targetType": "task_claim", "targetId": 87, "pointRecordId": None, "pointRecord": None,
     "employeeId": 1, "employeeName": "张三", "reason": "成果已按文档要求提交",
     "evidenceImages": "[]",
     "targetSummary": {"title": "整理客户回访文档", "content": "初步整理稿", "reviewRemark": "缺少回访记录明细"},
     "status": "pending_review", "statusText": "待审核", "resolution": None, "reviewerId": None, "resultRemark": None,
     "createdAt": "2026-10-10 11:00:00", "updatedAt": "2026-10-10 11:00:00"},
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
        path_only = url.split("?")[0]
        if "/admin/employees" in url:
            route.fulfill(status=200, content_type="application/json", body=paged(EMPLOYEES))
        elif path_only.endswith("/admin/appeals") and method == "GET":
            route.fulfill(status=200, content_type="application/json", body=paged(APPEALS))
        elif "/admin/appeals/" in path_only and path_only.endswith("/review") and method == "POST":
            review_bodies.append((url, route.request.post_data_json))
            route.fulfill(status=200, content_type="application/json", body=paged([]))
        elif any(k in url for k in ("/admin/orders", "/admin/applications", "/admin/task-records")):
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

    page.goto(BASE + "/review-center?tab=appeal")
    page.wait_for_selector(".el-table__row", timeout=8000)

    table_text = page.locator(".el-table").inner_text()
    check("待审行渲染（张三/申诉原因）", "张三" in table_text and "当月有客户表扬" in table_text)
    check("任务类申诉事件列展示 targetSummary 摘要", "整理客户回访文档 · 初步整理稿" in table_text)

    # 详情：targetSummary 上下文（原"盲审"场景）
    page.locator(".el-table__row").filter(has_text="整理客户回访文档").locator("button").filter(has_text="详情").click()
    page.wait_for_selector(".el-dialog", timeout=5000)
    dialog_text = page.locator(".el-dialog").inner_text()
    check("详情展示申诉目标（targetSummary.title）", "整理客户回访文档" in dialog_text)
    check("详情展示当时审核备注", "缺少回访记录明细" in dialog_text)
    page.keyboard.press("Escape")
    page.wait_for_timeout(500)

    # 处理：通过 → payload 无 stage
    page.locator(".el-table__row").filter(has_text="当月有客户表扬").locator("button").filter(has_text="处理").click()
    page.wait_for_selector(".el-dialog", timeout=5000)
    page.locator(".el-dialog textarea").fill("申诉成立，予以补分")
    page.locator(".el-dialog button").filter(has_text="提交").click()
    page.wait_for_timeout(1000)

    check("POST /admin/appeals/21/review 已发出", len(review_bodies) == 1, f"calls={review_bodies}")
    if review_bodies:
        _, body = review_bodies[0]
        check("payload 仅 {status:'approved', resultRemark}（无 stage）",
              body.get("status") == "approved" and body.get("resultRemark") == "申诉成立，予以补分" and "stage" not in body,
              json.dumps(body, ensure_ascii=False))
    check("成功提示", "申诉审核已通过" in page.locator("body").inner_text())

    page.screenshot(path="tests/e2e/snapshots/step10_appeals.png", full_page=True)
    js_errors = [e for e in console_errors if "Failed to load resource" not in e and "favicon" not in e.lower()]
    check("无 JS 运行错误", len(js_errors) == 0, "; ".join(js_errors[:3]))
    browser.close()

print(f"\nRESULT: {'ALL PASS' if not FAILURES else 'FAILED: ' + ', '.join(FAILURES)}")
sys.exit(0 if not FAILURES else 1)
