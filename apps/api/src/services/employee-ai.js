const points = require("./points");

function getDeepSeekConfig() {
  return {
    apiKey: String(process.env.DEEPSEEK_API_KEY || "").trim(),
    apiBase: String(process.env.DEEPSEEK_API_BASE || "https://api.deepseek.com").replace(/\/$/, ""),
    model: process.env.DEEPSEEK_MODEL || "deepseek-v4-flash"
  };
}

function currentMonthKey() {
  return new Date().toISOString().slice(0, 7);
}

function previousMonthKey() {
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function parseTargetMonth(question) {
  const text = String(question || "");
  if (/上个月|上月/.test(text)) return previousMonthKey();
  if (/这个月|本月|当月/.test(text)) return currentMonthKey();
  const ym = text.match(/(20\d{2})[-/年](\d{1,2})/);
  if (ym) return `${ym[1]}-${String(ym[2]).padStart(2, "0")}`;
  const m = text.match(/(\d{1,2})\s*月/);
  if (m) {
    const year = new Date().getFullYear();
    return `${year}-${String(m[1]).padStart(2, "0")}`;
  }
  return currentMonthKey();
}

function formatMonthLabel(monthKey) {
  const [year, month] = String(monthKey).split("-");
  if (!year || !month) return monthKey;
  return `${year}年${Number(month)}月`;
}

function filterByMonth(records, monthKey) {
  return records.filter((record) => String(record.occurredAt || record.month || "").slice(0, 7) === monthKey);
}

function sumDelta(records) {
  return records.reduce((sum, record) => sum + Number(record.pointsDelta || 0), 0);
}

function summarizeByRemark(records, direction) {
  const filtered = records.filter((record) =>
    direction === "positive" ? Number(record.pointsDelta) > 0 : Number(record.pointsDelta) < 0
  );
  const map = new Map();
  for (const record of filtered) {
    const remark = String(record.remark || "无备注").trim() || "无备注";
    map.set(remark, (map.get(remark) || 0) + Math.abs(Number(record.pointsDelta || 0)));
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([remark, total]) => ({ remark, total }));
}

function formatTopList(items, unit = "分") {
  if (!items.length) return "暂无相关记录。";
  return items.map((item, index) => `${index + 1}. ${item.remark}（${item.total}${unit}）`).join("\n");
}

function listActiveGifts(context) {
  return (context.gifts || [])
    .filter((gift) => gift.status === "active" && Number(gift.stock) > 0)
    .sort((a, b) => Number(a.pointsCost) - Number(b.pointsCost));
}

function listExchangeableGifts(context) {
  const balance = Number(context.employee.pointsBalance || 0);
  return listActiveGifts(context).filter((gift) => Number(gift.pointsCost) <= balance);
}

function formatGiftLine(gift, index) {
  const limit = gift.limitPerUser != null ? `，每人限兑 ${gift.limitPerUser} 次` : "";
  return `${index + 1}. ${gift.name}（${gift.pointsCost} 分，库存 ${gift.stock}${limit}）`;
}

function answerGiftQuestion(context) {
  const { employee } = context;
  const balance = Number(employee.pointsBalance || 0);
  const activeGifts = listActiveGifts(context);
  const exchangeableGifts = listExchangeableGifts(context);

  if (!activeGifts.length) {
    return `${employee.name}，商城暂无上架礼品，请稍后再看或到「商城」页确认。`;
  }

  if (!exchangeableGifts.length) {
    const cheapest = activeGifts[0];
    return [
      `${employee.name}，你当前可用积分 ${balance} 分，暂不足以兑换任何礼品。`,
      `商城最低兑换门槛：${cheapest.name}（${cheapest.pointsCost} 分，库存 ${cheapest.stock}）。`,
      "可继续攒积分，或到「商城」页查看全部礼品。"
    ].join("\n");
  }

  return [
    `${employee.name}，你当前可用积分 ${balance} 分，可兑换以下礼品：`,
    exchangeableGifts.map((gift, index) => formatGiftLine(gift, index)).join("\n"),
    "请前往「商城」页完成兑换。"
  ].join("\n");
}

async function buildEmployeeContext(store, employeeId) {
  const employee = await store.getEmployee(employeeId);
  if (!employee) {
    const error = new Error("员工不存在");
    error.statusCode = 404;
    throw error;
  }
  const records = await points.listEmployeeRecords(store, employeeId);
  const gifts = typeof store.listGifts === "function" ? await store.listGifts() : [];
  return { employee, records, gifts };
}

function buildSystemPrompt() {
  return [
    "你是「易积分」系统的员工端 AI 助手。",
    "你只能根据系统提供的该员工积分流水、余额和商城礼品数据回答问题。",
    "规则：",
    "1. 只回答与这名员工本人积分、流水、商城兑换相关的问题，礼貌拒绝无关话题。",
    "2. 不得编造积分变动或礼品信息；数据不足时如实说明，并建议到「明细」或「商城」页查看。",
    "3. 解释加分/扣分时必须引用流水备注（remark）。",
    "4. 回答兑换问题时，只能推荐「可兑换礼品」列表中的商品，并说明所需积分与库存。",
    "5. 用简洁清晰的中文回答，必要时使用条目列表。"
  ].join("\n");
}

function buildContextPrompt(context) {
  const { employee, records } = context;
  const limit = Number(process.env.DEEPSEEK_CONTEXT_RECORDS || 80);
  const recent = records.slice(0, Number.isFinite(limit) && limit > 0 ? limit : 80);
  const lines = recent.map((record) => {
    const delta = Number(record.pointsDelta) > 0 ? `+${record.pointsDelta}` : String(record.pointsDelta);
    return `- ${record.occurredAt} ${delta} ${record.remark}`;
  });

  const balance = Number(employee.pointsBalance || 0);
  const activeGifts = listActiveGifts(context);
  const exchangeableGifts = listExchangeableGifts(context);
  const giftLines = activeGifts.map((gift) => {
    const affordable = Number(gift.pointsCost) <= balance ? "可兑换" : "积分不足";
    return `- ${gift.name}：${gift.pointsCost} 分，库存 ${gift.stock}，${affordable}`;
  });

  return [
    `员工：${employee.name}（ID ${employee.id}）`,
    `当前积分余额：${balance} 分`,
    `积分流水（最近 ${recent.length} 条，时间倒序）：`,
    lines.length ? lines.join("\n") : "（暂无流水）",
    `商城礼品（上架且有库存，共 ${activeGifts.length} 项）：`,
    giftLines.length ? giftLines.join("\n") : "（暂无上架礼品）",
    `当前余额可兑换礼品数：${exchangeableGifts.length}`
  ].join("\n");
}

async function callDeepSeekChat(systemPrompt, userContent) {
  const { apiKey, apiBase, model } = getDeepSeekConfig();
  if (!apiKey) {
    const error = new Error("未配置 DEEPSEEK_API_KEY");
    error.statusCode = 503;
    throw error;
  }

  const timeoutMs = Number(process.env.DEEPSEEK_TIMEOUT_MS || 60000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${apiBase}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent }
        ],
        thinking: { type: "disabled" },
        stream: false,
        temperature: 0.3,
        max_tokens: 1024
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      const error = new Error(
        `DeepSeek 请求失败 (${response.status})${errText ? `: ${errText.slice(0, 240)}` : ""}`
      );
      error.statusCode = 502;
      throw error;
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content || !String(content).trim()) {
      const error = new Error("DeepSeek 返回空内容");
      error.statusCode = 502;
      throw error;
    }
    return String(content).trim();
  } catch (error) {
    if (error.name === "AbortError") {
      const timeoutError = new Error("DeepSeek 请求超时");
      timeoutError.statusCode = 504;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function answerEmployeeQuestion(context, question) {
  const text = String(question || "").trim();
  if (!text) {
    return "你好，我是积分助手。你可以问我：\n· 这个月一共加了多少分？\n· 主要扣在什么地方？\n· 当前积分余额是多少？\n· 我现在能兑换什么奖品？";
  }

  const parts = text.split(/[?？]/).map((part) => part.trim()).filter(Boolean);
  if (parts.length > 1) {
    return parts.map((part) => answerEmployeeQuestion(context, `${part}？`)).join("\n\n");
  }

  const { employee, records } = context;
  const monthKey = parseTargetMonth(text);
  const monthRecords = filterByMonth(records, monthKey);
  const monthLabel = formatMonthLabel(monthKey);
  const monthTotal = sumDelta(monthRecords);
  const monthAdded = sumDelta(monthRecords.filter((record) => record.pointsDelta > 0));
  const monthDeducted = Math.abs(sumDelta(monthRecords.filter((record) => record.pointsDelta < 0)));

  if (/兑换|奖品|礼品|商城|换什么|能换什么|能兑换/.test(text)) {
    return answerGiftQuestion(context);
  }

  if (/余额|现有积分|还剩|当前积分|多少分$/.test(text) && !/这个月|本月|一共|总共|加|扣/.test(text)) {
    return `${employee.name}，你当前可用积分为 ${employee.pointsBalance} 分。`;
  }

  if (/主要.*扣|扣.*哪里|扣.*什么地方|减分.*哪里|扣分.*原因|为什么扣/.test(text)) {
    const tops = summarizeByRemark(monthRecords, "negative");
    return `${monthLabel}你的扣分主要集中在：\n${formatTopList(tops)}\n合计扣减 ${monthDeducted} 分。`;
  }

  if (/主要.*加|加.*哪里|加.*什么地方|加分.*来源|奖励.*哪里/.test(text)) {
    const tops = summarizeByRemark(monthRecords, "positive");
    return `${monthLabel}你的加分主要来自：\n${formatTopList(tops)}\n合计增加 ${monthAdded} 分。`;
  }

  if (/扣|减分|扣除|被罚/.test(text) && !/加/.test(text)) {
    const tops = summarizeByRemark(monthRecords, "negative");
    return `${monthLabel}你共扣减 ${monthDeducted} 分。\n主要扣分项：\n${formatTopList(tops)}`;
  }

  if (/加|奖励|加分|获得/.test(text) && !/扣/.test(text)) {
    const tops = summarizeByRemark(monthRecords, "positive");
    return `${monthLabel}你共获得 ${monthAdded} 分。\n主要加分项：\n${formatTopList(tops)}`;
  }

  if (/一共|总共|汇总|概况|总结|变动|净增|净变化/.test(text)) {
    const addedTops = summarizeByRemark(monthRecords, "positive");
    const deductedTops = summarizeByRemark(monthRecords, "negative");
    return [
      `${monthLabel}积分变动概况（${employee.name}）：`,
      `· 净变化：${monthTotal >= 0 ? "+" : ""}${monthTotal} 分`,
      `· 加分合计：${monthAdded} 分`,
      `· 扣分合计：${monthDeducted} 分`,
      `· 当前余额：${employee.pointsBalance} 分`,
      addedTops.length ? `· 主要加分：${addedTops[0].remark}（${addedTops[0].total}分）` : "",
      deductedTops.length ? `· 主要扣分：${deductedTops[0].remark}（${deductedTops[0].total}分）` : ""
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (/明细|流水|记录/.test(text)) {
    if (!monthRecords.length) return `${monthLabel}暂无积分流水。`;
    const preview = monthRecords
      .slice(0, 5)
      .map((record) => {
        const delta = record.pointsDelta > 0 ? `+${record.pointsDelta}` : String(record.pointsDelta);
        return `· ${record.remark}（${delta}）`;
      })
      .join("\n");
    return `${monthLabel}最近 ${Math.min(monthRecords.length, 5)} 条流水：\n${preview}${monthRecords.length > 5 ? "\n可在「明细」页查看完整记录。" : ""}`;
  }

  return [
    `关于「${text}」，根据你的积分数据：`,
    `${monthLabel}净变化 ${monthTotal >= 0 ? "+" : ""}${monthTotal} 分（加 ${monthAdded} / 扣 ${monthDeducted}）。`,
    `当前余额 ${employee.pointsBalance} 分。`,
    "你也可以试试问：「这个月一共加了多少分？」「主要扣在什么地方？」「我现在能兑换什么奖品？」"
  ].join("\n");
}

async function askEmployeeQuestion(store, employeeId, question) {
  const text = String(question || "").trim();
  const context = await buildEmployeeContext(store, employeeId);
  const employee = { id: context.employee.id, name: context.employee.name };
  const hasDeepSeek = Boolean(getDeepSeekConfig().apiKey);

  if (!text) {
    return {
      answer: answerEmployeeQuestion(context, text),
      employee,
      source: hasDeepSeek ? "deepseek" : "rules"
    };
  }

  if (hasDeepSeek) {
    try {
      const systemPrompt = `${buildSystemPrompt()}\n\n${buildContextPrompt(context)}`;
      const answer = await callDeepSeekChat(systemPrompt, `员工问题：${text}`);
      return { answer, employee, source: "deepseek" };
    } catch (error) {
      console.error("[employee-ai] DeepSeek 调用失败，回退规则引擎:", error.message);
      return {
        answer: answerEmployeeQuestion(context, question),
        employee,
        source: "rules"
      };
    }
  }

  return {
    answer: answerEmployeeQuestion(context, question),
    employee,
    source: "rules"
  };
}

module.exports = {
  buildEmployeeContext,
  buildContextPrompt,
  buildSystemPrompt,
  answerEmployeeQuestion,
  answerGiftQuestion,
  askEmployeeQuestion,
  callDeepSeekChat,
  getDeepSeekConfig
};
