const crypto = require("node:crypto");

function parseExpiresIn(value) {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const text = String(value).trim();
  const match = text.match(/^(\d+)([smhd])$/i);
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers = { s: 1, m: 60, h: 3600, d: 86400 };
  return amount * multipliers[unit];
}

function sign(payload, secret, options = {}) {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now };
  const ttl = parseExpiresIn(options.expiresIn);
  if (ttl != null) body.exp = now + ttl;
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString("base64url");
  const encodedPayload = Buffer.from(JSON.stringify(body)).toString("base64url");
  const data = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto.createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${signature}`;
}

function verify(token, secret) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) throw new Error("invalid token");
  const data = `${parts[0]}.${parts[1]}`;
  const expected = crypto.createHmac("sha256", secret).update(data).digest("base64url");
  const actualBuf = Buffer.from(parts[2]);
  const expectedBuf = Buffer.from(expected);
  if (actualBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(actualBuf, expectedBuf)) {
    throw new Error("invalid signature");
  }
  const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  if (payload.exp != null && Math.floor(Date.now() / 1000) >= Number(payload.exp)) {
    throw new Error("token expired");
  }
  return payload;
}

module.exports = { sign, verify };
