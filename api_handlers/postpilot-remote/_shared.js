const { authenticateDevice } = require("../../lib/postpilot-remote");

function json(res, statusCode, body) {
  res.statusCode = statusCode;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(body));
}

function bearerToken(req) {
  const match = String(req.headers.authorization || "").match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || "";
}

async function extensionDevice(req) {
  return authenticateDevice(bearerToken(req));
}

function handleError(res, error) {
  json(res, error.statusCode || 400, { ok: false, error: error?.message || String(error) });
}

module.exports = { extensionDevice, handleError, json };
