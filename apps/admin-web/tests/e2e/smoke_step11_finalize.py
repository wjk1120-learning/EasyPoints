# -*- coding: utf-8 -*-
"""L4 冒烟（第 11 页收官）：badges/dashboard 聚合优先 + department_admin 菜单裁剪 + 日志服务端筛选"""
import json
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

from playwright.sync_api import sync_playwright

BASE = "http://localhost:5173"
FAILURES: list[str] = []

SUMMARY = {"employeeCount": 45, "giftCount": 6, "taskCount": 3,
           "pending": {"orders": 2, "taskClaims": 3, "applications": 4, "appeals": 1}}
BADGES = {"exchangePending": 2, "taskPending": 3, "applicationPending": 4, "appealPending": 1}


def check(name: str, ok: bool, detail: str = ""):
    print(("PASS " if ok else "FAIL ") + name + (f" | {detail}" if detail and not ok else ""))
    if not ok:
        FAILURES.append(name)


def paged(rows):
    return json.dumps({"code": 1, "msg": "成功", "data": {"total": len(rows), "rows": rows}}, ensure_ascii=False)


def run_session(browser, username: str):
    """登录指定账号，返回 (page, 拦截记录)"""
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    hits = []
    console_errors = []
    page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)

    def handle(route):
        url, method = route.request.url, route.request.method
        path_only = url.split("?")[0]
        hits.append(path_only + ("?" + url.split("?")[1] if "?" in url else ""))
        if path_only.endswith("/admin/auth/login"):
            role = "department_admin" if username == "rd_manager" else "super_admin"
            route.fulfill(status=200, content_type="application/json",
                          body=json.dumps({"code": 1, "msg": "成功", "data": {
                              "token": "fake-token", "admin": {
                                  "id": 2 if role == "department_admin" else 1,
                                  "username": username, "name": "冒烟" + ("部门管理员" if role == "department_admin" else "超管"),
                                  "role": role, "departmentIds": [2] if role == "department_admin" else []}}}, ensure_ascii=False))
        elif path_only.endswith("/admin/badges"):
            route.fulfill(status=200, content_type="application/json",
                          body=json.dumps({"code": 1, "msg": "成功", "data": BADGES}, ensure_ascii=False))
        elif path_only.endswith("/admin/dashboard/summary"):
            route.fulfill(status=200, content_type="application/json",
                          body=json.dumps({"code": 1, "msg": "成功", "data": SUMMARY}, ensure_ascii=False))
        elif path_only.endswith("/admin/operation-logs"):
            route.fulfill(status=200, content_type="application/json", body=paged([]))
        elif any(path_only.endswith(k) or k in path_only for k in (
                "/admin/employees", "/admin/orders", "/admin/task-records", "/admin/applications",
                "/admin/appeals", "/admin/tasks", "/admin/rules", "/admin/mall/gifts", "/admin/votes")):
            route.fulfill(status=200, content_type="application/json", body=paged([]))
        else:
            route.continue_()

    page.route("**/admin/**", handle)
    page.goto(BASE)
    page.wait_for_load_state("networkidle")
    page.locator("input").nth(0).fill(username)
    page.locator("input").nth(1).fill("admin123")
    page.locator("button").filter(has_text="登").first.click()
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1500)
    return page, hits, console_errors


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)

    # ---- 超管：聚合接口优先 ----
    page, hits, console_errors = run_session(browser, "admin")
    check("badges 聚合接口被调用", any(h.endswith("/admin/badges") for h in hits))
    check("dashboard/summary 聚合接口被调用", any(h.endswith("/admin/dashboard/summary") for h in hits))
    body_text = page.locator("body").inner_text()
    check("工作台计数来自 summary（员工 45/礼品 6）", "45" in body_text and "6" in body_text)
    check("待办合计 2+3+4+1=10", "10 条待处理" in body_text, body_text[:150])
    check("超管菜单含四个内容管理项", all(k in body_text for k in ["任务管理", "投票管理", "规则配置", "商城礼品"]))
    js_errors = [e for e in console_errors if "Failed to load resource" not in e and "favicon" not in e.lower()]
    check("超管无 JS 运行错误", len(js_errors) == 0, "; ".join(js_errors[:3]))
    page.close()

    # ---- 部门管理员：四内容菜单隐藏（只查侧边栏菜单，避免工作台文案干扰）----
    page, hits, console_errors = run_session(browser, "rd_manager")
    menu_text = page.locator(".el-menu").inner_text()
    check("部门管理员隐藏 任务管理/投票管理/规则配置/商城礼品",
          all(k not in menu_text for k in ["任务管理", "投票管理", "规则配置", "商城礼品"]), menu_text)
    check("部门管理员保留 工作台/员工积分/审核中心/数据导出",
          all(k in menu_text for k in ["工作台", "员工积分", "审核中心", "数据导出"]))
    check("右上角角色展示部门管理员", "部门管理员" in page.locator("body").inner_text())

    # 日志页：服务端筛选参数
    page.goto(BASE + "/logs")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(800)
    log_hits = [h for h in hits if "/admin/operation-logs" in h]
    check("日志请求带分页参数", any("page=1" in h and "pageSize=50" in h for h in log_hits), f"hits={log_hits[-2:]}")
    js_errors = [e for e in console_errors if "Failed to load resource" not in e and "favicon" not in e.lower()]
    check("部门管理员无 JS 运行错误", len(js_errors) == 0, "; ".join(js_errors[:3]))
    page.screenshot(path="tests/e2e/snapshots/step11_dept_admin.png", full_page=True)
    page.close()
    browser.close()

print(f"\nRESULT: {'ALL PASS' if not FAILURES else 'FAILED: ' + ', '.join(FAILURES)}")
sys.exit(0 if not FAILURES else 1)
