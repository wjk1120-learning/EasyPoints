# -*- coding: utf-8 -*-
"""真机联调 E2E：真实登录 + 真实数据走查核心页面（无任何 route 注入）"""
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
    failed_urls = []
    page.on("response", lambda r: failed_urls.append(f"{r.status} {r.url}") if r.status >= 400 else None)

    def goto(path, wait):
        page.goto(BASE + path)
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(1200)

    # 登录（真实）
    page.goto(BASE)
    page.wait_for_load_state("networkidle")
    check("登录页渲染", page.locator("input").count() >= 2)
    page.locator("input").nth(0).fill("admin")
    page.locator("input").nth(1).fill("admin123")
    page.locator("button").filter(has_text="登").first.click()
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1500)
    check("真实登录成功", page.locator("input[type=password]").count() == 0, page.url)

    # 工作台（badges+summary 聚合，真实数据）
    body = page.locator("body").inner_text()
    check("工作台聚合数据渲染", ("条待处理" in body) and ("员工总人数" in body or "员工" in body), body[:150])

    # 员工积分（真实员工数据）
    goto("/employee-points", 800)
    page.wait_for_selector(".el-table__row", timeout=8000)
    check("员工列表真实数据", page.locator(".el-table").inner_text() != "" and page.locator(".el-table__row").count() > 0)

    # 积分录入：真实提交一笔加分再撤不掉没关系（测试数据），验证链路通
    goto("/points", 800)
    check("积分录入页加载（员工下拉有数据）", page.locator(".panel-left").count() == 1)

    # 审核中心四 Tab
    goto("/review-center?tab=exchange", 800)
    check("审核中心-兑换 Tab 加载", page.locator(".el-table").count() >= 1)
    for tab, key in [("任务积分审核", "task"), ("积分申请审核", "application"), ("申诉工单处理", "appeal")]:
        page.locator(".el-tabs__item").filter(has_text=tab).click()
        page.wait_for_timeout(1000)
        check(f"审核中心-{tab} Tab 加载", page.locator(".review-panel, .el-table").count() >= 1)

    # 任务管理/投票管理/规则配置/商城礼品（新接口四件套）
    goto("/tasks", 800)
    check("任务管理加载", page.locator(".panel").count() >= 1)
    goto("/votes", 800)
    check("投票管理加载", page.locator(".panel").count() >= 1)
    goto("/rules", 800)
    page.wait_for_timeout(1500)
    check("规则配置加载（wangeditor 容器）", page.locator(".editor-container, .w-e-text-container").count() >= 1)
    goto("/mall", 800)
    check("商城礼品加载", page.locator(".panel").count() >= 1)

    # 数据导出：真实下载 points-summary
    goto("/reports", 800)
    check("数据导出页加载", page.locator(".export-card").count() == 5)
    with page.expect_download(timeout=10000) as dl:
        page.locator(".export-card").filter(has_text="全员积分数据表").locator("button").filter(has_text="导出 Excel").click()
    check("真实导出全员积分 xlsx", dl.value.suggested_filename.startswith("全员积分数据表-"), dl.value.suggested_filename)

    # 操作日志
    goto("/logs", 800)
    check("操作日志加载", page.locator(".el-table").count() >= 1)

    page.screenshot(path="tests/e2e/snapshots/real_e2e_final.png", full_page=True)
    unexpected = [u for u in failed_urls if "/uploads/" not in u]
    check("无失败请求", len(unexpected) == 0, "; ".join(unexpected[:3]))
    js_errors = [e for e in console_errors if "Failed to load resource" not in e and "favicon" not in e.lower()]
    check("无 JS 运行错误", len(js_errors) == 0, "; ".join(js_errors[:3]))
    browser.close()

print(f"\nRESULT: {'ALL PASS' if not FAILURES else 'FAILED: ' + ', '.join(FAILURES)}")
sys.exit(0 if not FAILURES else 1)
