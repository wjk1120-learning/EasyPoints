const jwt = require("jsonwebtoken");
const { toNumberId } = require("./data/store");

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,PUT,OPTIONS",
    "access-control-allow-headers": "content-type,authorization,x-admin-id,x-employee-id"
  });
  res.end(JSON.stringify(data));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function getJwtPayload(req) {
  const auth = req.headers["authorization"];
  if (!auth) return null;
  const match = String(auth).match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  try {
    return jwt.verify(match[1], process.env.JWT_SECRET || "change-me");
  } catch {
    return null;
  }
}

function getAdminId(req) {
  const payload = getJwtPayload(req);
  if (payload?.typ === "admin") return toNumberId(payload.sub) ?? null;
  if (process.env.NODE_ENV === "production") return null;

  const header = req.headers["x-admin-id"];
  if (header === "admin-root") return 1;
  if (header === "admin-rd") return 2;
  return toNumberId(header) ?? 1;
}

function getEmployeeId(req) {
  const payload = getJwtPayload(req);
  if (payload?.typ === "employee") return toNumberId(payload.sub) ?? null;
  if (process.env.NODE_ENV === "production") return null;

  const header = req.headers["x-employee-id"];
  if (header === "emp-001") return 1;
  if (header === "emp-002") return 2;
  return toNumberId(header) ?? 1;
}

module.exports = { sendJson, readBody, getJwtPayload, getAdminId, getEmployeeId };
