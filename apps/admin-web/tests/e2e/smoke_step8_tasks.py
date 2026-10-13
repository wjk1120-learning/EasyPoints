# -*- coding: utf-8 -*-
"""L4 冒烟（第 8 页）：任务管理 — fixture 注入验证任务 CRUD 链路与成果审核 payload（mock 已拆除）"""
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
TASKS = [
    {"id": 3, "name": "整理客户回访文档", "description": "汇总本季度客户回访记录", "rewardPoints": 100,
     "requirement": "输出文档并发送至部门邮箱", "deadline": "2026-10-31", "status": "published",
     "createdBy": 1, "createdAt": "2026-10-01 09:00:00", "updatedAt": "2026-10-02 09:00:00"},
]
TASK_RECORDS = [
    {"id": 88, "taskId": 3, "taskName": "整理客户回访文档", "rewardPoints": 100, "employeeId": 1, "employeeName": "张三",
     "status": "pending_review", "submissionText": "文档已发送至部门邮箱，见附件截图", "submissionImages": [],
     "submittedAt": "2026-10-09 15:30:00", "reviewRemark": None, "reviewerId": None, "reviewedAt": None,
     "createdAt": "2026-10-05 10:00:00", "updatedAt": "2026-10-09 15:30:00"},
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
        elif path_only.endswith("/admin/tasks") and method == "GET":
            route.fulfill(status=200, content_type="application/json", body=paged(TASKS))
        elif path_only.endswith("/admin/task-records") and method == "GET":
            route.fulfill(status=200, content_type="application/json", body=paged(TASK_RECORDS))
        elif "/admin/task-records/" in url and path_only.endswith("/review") and method == "POST":
            review_bodies.append((url, route.request.post_data_json))
            route.fulfill(status=200, content_type="application/json", body=paged([]))
        elif any(k in url for k in ("/admin/orders", "/admin/applications", "/admin/appeals")):
            route.fulfill(status=200, content_type="application/json", body=paged([]))
        else:
            route.continue_()

    page.route("**/admin/**", handle)

    page.goto(BASE)
    page.wait_for_load_state("networkidle")
    page.locator("input").nth(0).fill("admin")
    page.locator("input").nth(1).fill("admin123")
    page.locator("button").filter(has_text="登").first.click()
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1200)

    # ---- 任务管理页 ----
    page.goto(BASE + "/tasks")
    page.wait_for_selector(".el-table__row", timeout=8000)
    table_text = page.locator(".el-table").inner_text()
    check("任务列表渲染（名称/奖励/有效期/上架中）", "整理客户回访文档" in table_text and "+100" in table_text and "2026-10-31" in table_text and "上架中" in table_text)
    check("操作按钮齐全（记录/编辑/下架/删除）", all(b in table_text or page.locator(".el-table__row").first.locator("button").filter(has_text=b).count() > 0 for b in ["记录", "编辑", "下架", "删除"]))

    # 进度抽屉
    page.locator(".el-table__row").first.locator("button").filter(has_text="记录").click()
    page.wait_for_timeout(1000)
    drawer_text = page.locator(".el-drawer").inner_text() if page.locator(".el-drawer").count() else ""
    check("进度抽屉渲染成果记录", "张三" in drawer_text and "文档已发送至部门邮箱" in drawer_text, drawer_text[:80])
    page.keyboard.press("Escape")
    page.wait_for_timeout(500)

    # ---- 审核中心任务 Tab：通过审核链路 ----
    page.goto(BASE + "/review-center?tab=task")
    page.wait_for_selector(".el-table__row", timeout=8000)
    page.locator(".el-table__row").first.locator("button").filter(has_text="通过").click()
    page.wait_for_selector(".el-message-box", timeout=5000)
    check("通过确认弹窗（无开发术语）", "任务成果" in page.locator(".el-message-box").inner_text() and "双积分" not in page.locator(".el-message-box").inner_text())
    page.locator(".el-message-box button").filter(has_text="确认通过").click()
    page.wait_for_timeout(1000)

    check("POST /admin/task-records/88/review 已发出", len(review_bodies) == 1, f"calls={review_bodies}")
    if review_bodies:
        _, body = review_bodies[0]
        check("审核 payload {status:'approved', remark}", body.get("status") == "approved" and isinstance(body.get("remark"), str), json.dumps(body, ensure_ascii=False))
    check("成功提示为业务视角文案", "任务成果审核已通过" in page.locator("body").inner_text())

    page.screenshot(path="tests/e2e/snapshots/step8_tasks.png", full_page=True)
    js_errors = [e for e in console_errors if "Failed to load resource" not in e and "favicon" not in e.lower()]
    check("无 JS 运行错误", len(js_errors) == 0, "; ".join(js_errors[:3]))
    browser.close()

print(f"\nRESULT: {'ALL PASS' if not FAILURES else 'FAILED: ' + ', '.join(FAILURES)}")
sys.exit(0 if not FAILURES else 1)
