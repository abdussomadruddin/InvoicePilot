const { sendTikTokAuthorizationAlerts } = require("../../lib/push-notifications");
const { checkOneService } = require("../../lib/operations-center");

module.exports = async function handler(req, res) {
  res.setHeader("content-type", "application/json; charset=utf-8");
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.end(JSON.stringify({ ok: false, error: "Method not allowed." }));
    return;
  }
  const expected = String(process.env.CRON_SECRET || "");
  if (!expected || String(req.headers.authorization || "") !== `Bearer ${expected}`) {
    res.statusCode = 401;
    res.end(JSON.stringify({ ok: false, error: "Unauthorized." }));
    return;
  }
  try {
    const result = await sendTikTokAuthorizationAlerts();
    const health = await checkOneService("tiktok");
    res.end(JSON.stringify({ ok: true, ...result, health }));
  } catch (error) {
    res.statusCode = 500;
    res.end(JSON.stringify({ ok: false, error: error?.message || String(error) }));
  }
};
