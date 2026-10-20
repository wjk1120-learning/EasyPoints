# -*- coding: utf-8 -*-
"""L4 冒烟（第 3 页）：礼品商城 — fixture 注入验证列表/编辑禁库存/调库存链路"""
import json
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

from playwright.sync_api import sync_playwright

BASE = "http://localhost:5173"
FAILURES: list[str] = []

GIFTS = [
    {"id": 1, "name": "京东购物卡 100 元", "pointsCost": 1000, "stock": 20, "status": "active", "limitPerUser": 2,
     "coverImageUrl": "", "createdAt": "2026-09-01 09:00:00", "updatedAt": "2026-10-08 18:00:00"},
    {"id": 2, "name": "保温杯（下架品）", "pointsCost": 300, "stock": 0, "status": "inactive", "limitPerUser": None,
     "coverImageUrl": "", "createdAt": "2026-09-02 09:00:00", "updatedAt": "2026-10-09 10:00:00"},
]
stock_calls: list[dict] = []
put_calls: list[dict] = []


def check(name: str, ok: bool, detail: str = ""):
    print(("PASS " if ok else "FAIL ") + name + (f" | {detail}" if detail and not ok else ""))
    if not ok:
        FAILURES.append(name)


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    console_errors = []
    page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)

    def fulfill(route, data):
        route.fulfill(status=200, content_type="application/json",
                      body=json.dumps({"code": 1, "msg": "成功", "data": data}, ensure_ascii=False))

    def handle_api(route):
        url = route.request.url
        method = route.request.method
        if "/admin/mall/gifts" in url:
            if method == "GET":
                fulfill(route, {"total": len(GIFTS), "rows": GIFTS})
            elif url.endswith("/stock") and method == "POST":
                stock_calls.append(route.request.post_data_json)
                gifts0 = dict(GIFTS[0]); gifts0["stock"] = 25; gifts0["updatedAt"] = "2026-10-13 10:30:00"
                fulfill(route, gifts0)
            elif method == "PUT":
                put_calls.append(route.request.post_data_json)
                fulfill(route, GIFTS[0])
            else:
                fulfill(route, GIFTS[0])
        else:
            route.continue_()

    # 兜底：未显式拦截的 /admin 请求返回空 PageResult（终态 BaseResult 口径；先注册=低优先级）
    page.route("**/admin/**", lambda route: route.fulfill(
        status=200, content_type="application/json",
        body=json.dumps({"code": 1, "msg": "成功", "data": {"total": 0, "rows": []}}, ensure_ascii=False)))
    page.route("**/admin/mall/**", handle_api)
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

    page.goto(BASE + "/mall")
    page.wait_for_selector(".el-table__row", timeout=8000)
    table_text = page.locator(".el-table").inner_text()
    check("列表渲染（含下架礼品）", "京东购物卡 100 元" in table_text and "保温杯（下架品）" in table_text)
    check("状态列上架/下架标签", "上架" in table_text and "下架" in table_text)

    # 编辑：库存禁用
    page.locator(".el-table__row").filter(has_text="京东购物卡").locator("button").filter(has_text="编辑").click()
    page.wait_for_selector(".el-dialog", timeout=5000)
    dialog = page.locator(".el-dialog")
    check("编辑弹窗库存输入禁用", dialog.locator(".el-input-number.is-disabled").count() >= 1)
    check("编辑弹窗库存提示文案", "编辑礼品不改动库存" in dialog.inner_text())
    dialog.locator("button").filter(has_text="关闭").click()
    page.wait_for_timeout(500)

    # 调库存：prompt 输入 5
    page.locator(".el-table__row").filter(has_text="京东购物卡").locator("button").filter(has_text="调库存").click()
    page.wait_for_selector(".el-message-box", timeout=5000)
    check("弹窗标题含礼品名", "京东购物卡 100 元" in page.locator(".el-message-box__title").inner_text())
    check("弹窗正文分行展示（当前库存+规则）", "当前库存" in page.locator(".el-message-box__message").inner_text())
    page.locator(".el-message-box input").fill("5")
    page.locator(".el-message-box button").filter(has_text="确认调整").click()
    page.wait_for_timeout(1200)

    check("POST /stock 已发出且 body 仅 {delta:5}", stock_calls == [{"delta": 5}], f"calls={stock_calls}")
    body_text = page.locator("body").inner_text()
    check("调库存成功提示（20 → 25）", "已调整库存" in body_text and "25" in body_text)

    page.screenshot(path="tests/e2e/snapshots/step3_mall.png", full_page=True)
    js_errors = [e for e in console_errors if "Failed to load resource" not in e and "favicon" not in e.lower()]
    check("无 JS 运行错误", len(js_errors) == 0, "; ".join(js_errors[:3]))
    browser.close()

print(f"\nRESULT: {'ALL PASS' if not FAILURES else 'FAILED: ' + ', '.join(FAILURES)}")
sys.exit(0 if not FAILURES else 1)
