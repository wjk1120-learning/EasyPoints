const test = require("node:test");
const assert = require("node:assert/strict");
const { Readable } = require("node:stream");

process.env.FORCE_MEMORY_STORE = "1";
delete process.env.DEEPSEEK_API_KEY;

const { createApp } = require("../src/app");
const { createStore } = require("../src/data/store");
const points = require("../src/services/points");
const employeeAi = require("../src/services/employee-ai");

function createRequest({ method = "GET", url = "/", headers = {}, body = "" } = {}) {
  const req = Readable.from(body ? [Buffer.from(body)] : []);
  req.method = method;
  req.url = url;
  req.headers = headers;
  return req;
}

function createResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: "",
    writeHead(statusCode, headers) {
      this.statusCode = statusCode;
      this.headers = headers;
    },
    end(chunk = "") {
      this.body += chunk;
    }
  };
}

async function call(app, options) {
  const req = createRequest(options);
  const res = createResponse();
  await app.handler(req, res);
  return {
    statusCode: res.statusCode,
    json: res.body ? JSON.parse(res.body) : null
  };
}

test("员工 AI 助手能回答本月加分与扣分概况", async () => {
  const store = createStore();
  await points.adjustment(store, 1, { employeeId: 1, pointsDelta: 20, remark: "好人好事" });
  await points.adjustment(store, 1, { employeeId: 1, pointsDelta: -5, remark: "忘记考勤" });

  const context = await employeeAi.buildEmployeeContext(store, 1);
  const answer = employeeAi.answerEmployeeQuestion(context, "这个月一共加了多少分？主要扣在什么地方？");
  assert.match(answer, /加分|获得|增加/);
  assert.match(answer, /扣|忘记考勤/);
});

test("员工端 AI 问答接口仅返回当前登录员工数据", async () => {
  const store = createStore();
  const app = createApp(store);
  await points.adjustment(store, 1, { employeeId: 1, pointsDelta: 15, remark: "项目奖励" });

  const response = await call(app, {
    method: "POST",
    url: "/miniapp/ai/ask",
    headers: { "content-type": "application/json", "x-employee-id": "1" },
    body: JSON.stringify({ question: "当前积分余额是多少？" })
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json.data.employee.id, 1);
  assert.match(response.json.data.answer, /积分/);
  assert.equal(response.json.data.source, "rules");
});

test("员工 AI 助手能回答可兑换礼品问题", async () => {
  const store = createStore();
  const context = await employeeAi.buildEmployeeContext(store, 1);
  const answer = employeeAi.answerEmployeeQuestion(context, "我现在的积分可以兑换什么奖品？");
  assert.match(answer, /兑换|礼品|积分不足|商城/);
  assert.doesNotMatch(answer, /你也可以试试问/);
});
