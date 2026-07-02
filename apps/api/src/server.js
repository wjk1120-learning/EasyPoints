const http = require("node:http");
const { createApp } = require("./app");
const wecom = require("./services/wecom");

const port = Number(process.env.API_PORT || 3000);
const app = createApp();

http.createServer(app.handler).listen(port, () => {
  console.log(`EasyPoints API listening on http://localhost:${port}`);
});

if (process.env.ENABLE_OUTBOX_WORKER === "1") {
  const intervalMs = Number(process.env.OUTBOX_INTERVAL_MS || 5000);
  setInterval(() => {
    wecom.dispatchPendingMessages(app.store).catch((error) => {
      console.error("[outbox_worker] dispatch failed", error?.message || error);
    });
  }, Number.isFinite(intervalMs) && intervalMs > 0 ? intervalMs : 5000);
}
