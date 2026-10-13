# -*- coding: utf-8 -*-
"""L4 冒烟：登录 → 工作台（真实 dev server + 真实后端链路，验证 request.ts 双兼容改造）"""
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

from playwright.sync_api import sync_playwright

BASE = "http://localhost:5173"
FAILURES: list[str] = []


def check(name: str, ok: bool, detail: str = ""):
    print(("PASS " if ok else "FAIL ") + name + (f" | {detail}" if detail and not ok else ""))
    if not ok:
        FAILURES.append(name)


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    console_errors = []
    page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)
    failed_urls: list[str] = []
    page.on("response", lambda r: failed_urls.append(r.url) if r.status >= 400 else None)

    page.goto(BASE)
    page.wait_for_load_state("networkidle")

    # 登录页
    check("登录页渲染", page.locator("input").count() >= 2, f"inputs={page.locator('input').count()}")
    page.locator("input").nth(0).fill("admin")
    page.locator("input").nth(1).fill("admin123")
    page.locator("button").filter(has_text="登").first.click()
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1500)

    # 工作台：侧边栏 + 主区域渲染
    check("登录后离开登录页", page.locator("input[type=password]").count() == 0, page.url)
    check("侧边栏菜单渲染", page.locator(".el-menu").count() >= 1)
    body_text = page.locator("body").inner_text()
    check("工作台有数据内容", any(k in body_text for k in ["员工", "积分", "待审", "订单"]), body_text[:120])

    page.screenshot(path="tests/e2e/snapshots/step0_dashboard.png", full_page=True)
    # 已知豁免：mock 五域（task/application/vote/rule + task-records）在旧 Node 后端无接口，
    # 干净浏览器（未开 adminMock）走真实请求必然 404；逐页切换完成 + 新后端可连后移除豁免
    KNOWN_404 = ("/admin/tasks", "/admin/task-records", "/admin/applications", "/admin/votes", "/admin/rules")
    unexpected = [u for u in failed_urls if not any(u.startswith(f"{BASE}{k}") or k in u for k in KNOWN_404)]
    check("无非预期失败请求", len(unexpected) == 0, "; ".join(unexpected[:3]))
    js_errors = [e for e in console_errors if "Failed to load resource" not in e and "favicon" not in e.lower()]
    check("无 JS 运行错误", len(js_errors) == 0, "; ".join(js_errors[:3]))
    browser.close()

print(f"\nRESULT: {'ALL PASS' if not FAILURES else 'FAILED: ' + ', '.join(FAILURES)}")
sys.exit(0 if not FAILURES else 1)
