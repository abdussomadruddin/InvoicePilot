const { runDailyAdsReports } = require("../../lib/telegram-reports");

module.exports = async function handler(req, res) {
  res.setHeader("content-type", "application/json; charset=utf-8");
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.end(JSON.stringify({ ok: false, error: "Method not allowed." }));
    return;
  }
  const expected = String(process.env.CRON_SECRET || "");
  const provided = String(req.headers.authorization || "");
  if (!expected || provided !== `Bearer ${expected}`) {
    res.statusCode = 401;
    res.end(JSON.stringify({ ok: false, error: "Unauthorized." }));
    return;
  }
  try {
    const result = await runDailyAdsReports();
    res.statusCode = 200;
    res.end(JSON.stringify({ ok: true, ...result }));
  } catch (error) {
    res.statusCode = 500;
    res.end(JSON.stringify({ ok: false, error: error?.message || String(error) }));
  }
};
