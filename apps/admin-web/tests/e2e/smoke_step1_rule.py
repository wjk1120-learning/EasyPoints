# -*- coding: utf-8 -*-
"""L4 冒烟（第 1 页）：规则配置 — fixture 注入验证加载/回显/保存链路（真实浏览器 + wangeditor）"""
import json
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

from playwright.sync_api import sync_playwright

BASE = "http://localhost:5173"
FAILURES: list[str] = []

RULE_FIXTURE = {
    "content": "<h2>积分加减规则</h2><ul><li>加分场景：项目攻坚、客户表扬等，备注必填。</li></ul>",
    "updatedAt": "2026-10-12 16:30:00",
    "updatedBy": "系统管理员",
}
SAVED_FIXTURE = {
    "content": RULE_FIXTURE["content"],
    "updatedAt": "2026-10-13 09:40:00",
    "updatedBy": "冒烟测试",
}
put_bodies: list[dict] = []


def check(name: str, ok: bool, detail: str = ""):
    print(("PASS " if ok else "FAIL ") + name + (f" | {detail}" if detail and not ok else ""))
    if not ok:
        FAILURES.append(name)


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    console_errors = []
    page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)

    # fixture 注入：拦截规则接口（旧 Node 无此接口，必须拦截才可验证）
    def handle_rules(route):
        if route.request.method == "GET":
            route.fulfill(status=200, content_type="application/json",
                          body=json.dumps({"code": 1, "msg": "成功", "data": RULE_FIXTURE}, ensure_ascii=False))
        else:  # PUT
            put_bodies.append(route.request.post_data_json)
            route.fulfill(status=200, content_type="application/json",
                          body=json.dumps({"code": 1, "msg": "成功", "data": SAVED_FIXTURE}, ensure_ascii=False))

    page.route("**/admin/rules", handle_rules)

    # 登录（真实）
    page.goto(BASE)
    page.wait_for_load_state("networkidle")
    page.locator("input").nth(0).fill("admin")
    page.locator("input").nth(1).fill("admin123")
    page.locator("button").filter(has_text="登").first.click()
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1200)

    # 进入规则配置页
    page.goto(BASE + "/rules")
    page.wait_for_load_state("networkidle")
    page.wait_for_selector(".w-e-text-container", timeout=8000)
    page.wait_for_timeout(800)

    editor_text = page.locator(".w-e-text-container").inner_text()
    check("编辑器加载规则内容", "加分场景" in editor_text, editor_text[:80])
    body_text = page.locator("body").inner_text()
    check("最近保存信息展示（人+时间）", "系统管理员" in body_text and "2026-10-12 16:30:00" in body_text)

    # 保存（原内容非空，应通过前端校验并发出 PUT）
    page.locator("button").filter(has_text="保存并生效").first.click()
    page.wait_for_timeout(1000)

    check("PUT /admin/rules 已发出", len(put_bodies) == 1, f"count={len(put_bodies)}")
    if put_bodies:
        check("PUT 请求体仅 {content}", set(put_bodies[0].keys()) == {"content"} and "加分场景" in put_bodies[0]["content"], json.dumps(put_bodies[0], ensure_ascii=False)[:100])
    check("保存后最近保存时间刷新", "2026-10-13 09:40:00" in page.locator("body").inner_text())

    page.screenshot(path="tests/e2e/snapshots/step1_rule.png", full_page=True)
    js_errors = [e for e in console_errors if "Failed to load resource" not in e and "favicon" not in e.lower()]
    check("无 JS 运行错误", len(js_errors) == 0, "; ".join(js_errors[:3]))
    browser.close()

print(f"\nRESULT: {'ALL PASS' if not FAILURES else 'FAILED: ' + ', '.join(FAILURES)}")
sys.exit(0 if not FAILURES else 1)
