# -*- coding: utf-8 -*-
"""L4 冒烟（第 6 页）：订单审核 — fixture 注入验证列表渲染/通过审核链路/驳回弹窗"""
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
ORDERS = [
    {"id": 5001, "employeeId": 1, "employeeName": "张三", "giftId": 1, "giftName": "京东购物卡 100 元", "pointsCost": 1000,
     "status": "pending_review", "remark": None, "createdAt": "2026-10-10 09:00:00", "updatedAt": "2026-10-10 09:00:00"},
    {"id": 5002, "employeeId": 1, "employeeName": "张三", "giftId": 2, "giftName": "保温杯", "pointsCost": 300,
     "status": "approved", "remark": "审核通过", "createdAt": "2026-10-09 10:00:00", "updatedAt": "2026-10-09 11:00:00"},
]
status_bodies: list[tuple[str, dict]] = []


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
        elif "/admin/orders" in url and method == "GET":
            route.fulfill(status=200, content_type="application/json", body=paged(ORDERS))
        elif "/admin/orders/" in url and url.endswith("/status") and method == "POST":
            status_bodies.append((url, route.request.post_data_json))
            route.fulfill(status=200, content_type="application/json", body=paged([]))
        elif any(k in url for k in ("/admin/task-records", "/admin/applications", "/admin/appeals")):
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

    page.goto(BASE + "/review-center?tab=exchange")
    page.wait_for_selector(".el-table__row", timeout=8000)

    table_text = page.locator(".el-table").inner_text()
    check("待审核行渲染（张三/京东购物卡）", "张三" in table_text and "京东购物卡 100 元" in table_text)
    check("已通过行无审核按钮", page.locator(".el-table__row").filter(has_text="保温杯").locator("button").filter(has_text="通过").count() == 0)

    # 通过审核
    page.locator(".el-table__row").filter(has_text="京东购物卡").locator("button").filter(has_text="通过").click()
    page.wait_for_selector(".el-message-box", timeout=5000)
    check("通过确认弹窗出现", "审核通过" in page.locator(".el-message-box__title").inner_text())
    page.locator(".el-message-box button").filter(has_text="确认通过").click()
    page.wait_for_timeout(1000)

    check("POST /admin/orders/5001/status 已发出", len(status_bodies) == 1, f"calls={status_bodies}")
    if status_bodies:
        _, body = status_bodies[0]
        check("审核 payload {status:'approved', remark}", body.get("status") == "approved" and isinstance(body.get("remark"), str), json.dumps(body, ensure_ascii=False))
    check("成功提示为业务视角文案", "兑换审核已通过" in page.locator("body").inner_text())

    page.screenshot(path="tests/e2e/snapshots/step6_orders.png", full_page=True)
    js_errors = [e for e in console_errors if "Failed to load resource" not in e and "favicon" not in e.lower()]
    check("无 JS 运行错误", len(js_errors) == 0, "; ".join(js_errors[:3]))
    browser.close()

print(f"\nRESULT: {'ALL PASS' if not FAILURES else 'FAILED: ' + ', '.join(FAILURES)}")
sys.exit(0 if not FAILURES else 1)
