# -*- coding: utf-8 -*-
"""L4 冒烟：登录 → 工作台（真实 dev server；/admin 全量 fixture 注入，终态 BaseResult 口径）"""
import json
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

from playwright.sync_api import sync_playwright

BASE = "http://localhost:5173"
FAILURES: list[str] = []

SUMMARY = {"employeeCount": 45, "giftCount": 6, "taskCount": 3,
           "pending": {"orders": 2, "taskClaims": 3, "applications": 4, "appeals": 1}}


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
    failed_urls: list[str] = []
    page.on("response", lambda r: failed_urls.append(r.url) if r.status >= 400 else None)

    def handle(route):
        path_only = route.request.url.split("?")[0]
        if path_only.endswith("/admin/auth/login"):
            route.fulfill(status=200, content_type="application/json",
                          body=json.dumps({"code": 1, "msg": "成功", "data": {
                              "token": "fake-token", "admin": {"id": 1, "username": "admin", "name": "系统管理员",
                                                               "role": "super_admin", "departmentIds": []}}}, ensure_ascii=False))
        elif path_only.endswith("/admin/dashboard/summary"):
            route.fulfill(status=200, content_type="application/json",
                          body=json.dumps({"code": 1, "msg": "成功", "data": SUMMARY}, ensure_ascii=False))
        elif path_only.endswith("/admin/rules"):
            route.fulfill(status=200, content_type="application/json",
                          body=json.dumps({"code": 1, "msg": "成功", "data": {"content": "", "updatedAt": "2026-10-12 16:30:00", "updatedBy": "系统管理员"}}, ensure_ascii=False))
        elif "/admin/" in path_only:
            route.fulfill(status=200, content_type="application/json", body=paged([]))
        else:
            route.continue_()

    page.route("**/admin/**", handle)

    page.goto(BASE)
    page.wait_for_load_state("networkidle")

    check("登录页渲染", page.locator("input").count() >= 2, f"inputs={page.locator('input').count()}")
    page.locator("input").nth(0).fill("admin")
    page.locator("input").nth(1).fill("admin123")
    page.locator("button").filter(has_text="登").first.click()
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1500)

    check("登录后离开登录页", page.locator("input[type=password]").count() == 0, page.url)
    check("侧边栏菜单渲染", page.locator(".el-menu").count() >= 1)
    body_text = page.locator("body").inner_text()
    check("工作台有数据内容", any(k in body_text for k in ["员工", "积分", "待审", "订单"]), body_text[:120])
    check("待办合计来自 summary 聚合（10 条待处理）", "10 条待处理" in body_text, body_text[:150])

    page.screenshot(path="tests/e2e/snapshots/step0_dashboard.png", full_page=True)
    check("无非预期失败请求", len(failed_urls) == 0, "; ".join(failed_urls[:3]))
    js_errors = [e for e in console_errors if "Failed to load resource" not in e and "favicon" not in e.lower()]
    check("无 JS 运行错误", len(js_errors) == 0, "; ".join(js_errors[:3]))
    browser.close()

print(f"\nRESULT: {'ALL PASS' if not FAILURES else 'FAILED: ' + ', '.join(FAILURES)}")
sys.exit(0 if not FAILURES else 1)
