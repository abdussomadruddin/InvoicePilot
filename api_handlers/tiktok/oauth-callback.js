const { finishTikTokAuthorization } = require("../../lib/tiktok-ads");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.end("Method not allowed.");
    return;
  }
  const params = new URL(req.url || "/", "https://buddypilot.vercel.app").searchParams;
  try {
    await finishTikTokAuthorization(params);
    res.statusCode = 200;
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.end('<!doctype html><meta name="viewport" content="width=device-width"><title>TikTok Connected</title><p>TikTok Ads connected. Kembali ke BuddyPilot...</p><script>setTimeout(function(){location.replace("/?tab=clientpilot&tiktok=connected")},600)</script>');
  } catch (error) {
    const message = encodeURIComponent(error?.message || String(error));
    res.statusCode = 200;
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.end(`<!doctype html><meta name="viewport" content="width=device-width"><title>TikTok Error</title><p>TikTok authorization gagal. Kembali ke BuddyPilot...</p><script>setTimeout(function(){location.replace("/?tab=clientpilot&tiktok=error&message=${message}")},900)</script>`);
  }
};
