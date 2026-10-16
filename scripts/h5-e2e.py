# -*- coding: utf-8 -*-
"""
EasyPoints 员工端 H5 e2e 冒烟：逐页访问并断言关键内容渲染。
前置：后端（Docker，3000）与员工端 dev:h5（5174）已启动。
用法：python scripts/h5-e2e.py
"""
from playwright.sync_api import sync_playwright

BASE = "http://localhost:5174"
# (hash 路径, 任一命中的关键词列表)
PAGES = [
    ("pages/home/index", ["实时积分"]),
    ("pages/points/index", ["积分明细"]),
    ("pages/messages/index", ["通知中心"]),
    ("pages/appeals/index", ["申诉记录"]),
    ("pages/tasks/index", ["任务大厅"]),
    ("pages/votes/index", ["我的投票"]),
    ("pages/mall/index", ["积分商城", "兑换"]),
    ("pages/apply/index", ["积分申请"]),
    ("pages/rules/index", ["规则中心"]),
    ("pages/leaderboard/index", ["积分排名"]),
    ("pages/mine/index", ["积分账户安全"]),
]


def main():
    fails = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        for path, keywords in PAGES:
            page.goto(f"{BASE}/#{path}")
            page.wait_for_timeout(1800)
            text = page.locator("body").inner_text()
            ok = any(k in text for k in keywords)
            print(f"{'PASS' if ok else 'FAIL'} {path}（期望任一：{keywords}）")
            if not ok:
                fails.append((path, text[:120].replace("\n", " | ")))
        browser.close()
    print()
    if fails:
        print(f"{len(fails)} 页未通过（页面实际内容开头如下，据此修关键词或查问题）：")
        for path, head in fails:
            print(f" - {path}: {head}")
        raise SystemExit(1)
    print("全部通过。")


if __name__ == "__main__":
    main()
