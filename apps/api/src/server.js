const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { createApp } = require("./app");
const wecom = require("./services/wecom");

function loadEnvFile() {
  const envPath = path.resolve(__dirname, "../../../.env");
  if (!fs.existsSync(envPath)) return;
  const text = fs.readFileSync(envPath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile();

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
