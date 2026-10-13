# -*- coding: utf-8 -*-
"""L4 冒烟（第 5 页）：数据导出 — fixture 注入验证五卡渲染与 xlsx 下载链路（文件名前端拼接）"""
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
VOTES = [
    {"id": 11, "title": "月度之星评选", "description": "", "voteType": "single", "relatedType": "", "relatedId": None,
     "relatedLabel": None, "startTime": "2026-10-08 09:00", "endTime": "2026-10-12 18:00", "closed": False,
     "status": "ended", "options": [], "participantIds": [1], "participantCount": 1, "participantNames": ["张三"],
     "submittedCount": 1, "createdBy": 1, "createdAt": "2026-10-07 10:00:00", "updatedAt": "2026-10-07 10:00:00", "submittedByMe": False},
]
XLSX_BYTES = b"PK\x03\x04fake-xlsx"


def check(name: str, ok: bool, detail: str = ""):
    print(("PASS " if ok else "FAIL ") + name + (f" | {detail}" if detail and not ok else ""))
    if not ok:
        FAILURES.append(name)


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={"width": 1440, "height": 900}, accept_downloads=True)
    page = context.new_page()
    console_errors = []
    page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)

    xlsx_hits: list[str] = []

    def handle(route):
        url, method = route.request.url, route.request.method
        if "/admin/employees" in url:
            route.fulfill(status=200, content_type="application/json",
                          body=json.dumps({"code": 1, "msg": "成功", "data": {"total": 1, "rows": EMPLOYEES}}, ensure_ascii=False))
        elif "/admin/votes" in url:
            route.fulfill(status=200, content_type="application/json",
                          body=json.dumps({"code": 1, "msg": "成功", "data": {"total": 1, "rows": VOTES}}, ensure_ascii=False))
        elif url.split("?")[0].endswith(".xlsx") and method == "GET":
            xlsx_hits.append(url)
            route.fulfill(status=200, content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", body=XLSX_BYTES)
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

    page.goto(BASE + "/reports")
    page.wait_for_selector(".export-card", timeout=8000)
    grid_text = page.locator(".export-grid").inner_text()
    for name in ["全员积分数据表", "个人积分明细", "兑换记录表", "任务审核记录表", "投票统计数据表"]:
        check(f"导出卡「{name}」渲染", name in grid_text)

    # 1. 全员积分数据表：直接导出
    with page.expect_download(timeout=8000) as dl_info:
        page.locator(".export-card").filter(has_text="全员积分数据表").locator("button").filter(has_text="导出 Excel").click()
    download = dl_info.value
    check("全员导出触发下载", any("points-summary.xlsx" in u for u in xlsx_hits), f"hits={xlsx_hits}")
    check("文件名前端拼接（全员积分数据表-*.xlsx）", download.suggested_filename.startswith("全员积分数据表-"), download.suggested_filename)

    # 2. 个人积分明细：未选员工先拦截
    card = page.locator(".export-card").filter(has_text="个人积分明细")
    card.locator("button").filter(has_text="导出 Excel").click()
    page.wait_for_timeout(600)
    hits_before = len(xlsx_hits)
    check("未选员工被拦截（无新请求）", len(xlsx_hits) == hits_before)

    # 只选员工不选月份：导出全部流水（2026-10-13 口径）
    card.locator(".el-select").click()
    page.wait_for_timeout(400)
    page.locator(".el-select-dropdown__item").filter(has_text="张三").first.click()
    page.wait_for_timeout(400)
    with page.expect_download(timeout=8000) as dl_info2:
        card.locator("button").filter(has_text="导出 Excel").click()
    download2 = dl_info2.value
    check("个人明细导出触发 point-records.xlsx", any("point-records.xlsx" in u for u in xlsx_hits), f"hits={xlsx_hits}")
    check("不选月份文件名含「全部」", "张三" in download2.suggested_filename and "全部" in download2.suggested_filename, download2.suggested_filename)

    page.screenshot(path="tests/e2e/snapshots/step5_reports.png", full_page=True)
    js_errors = [e for e in console_errors if "Failed to load resource" not in e and "favicon" not in e.lower()]
    check("无 JS 运行错误", len(js_errors) == 0, "; ".join(js_errors[:3]))
    browser.close()

print(f"\nRESULT: {'ALL PASS' if not FAILURES else 'FAILED: ' + ', '.join(FAILURES)}")
sys.exit(0 if not FAILURES else 1)
