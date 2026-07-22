const test = require("node:test");
const assert = require("node:assert/strict");
const {
  authorizationNeedsWarning,
  pushPayload,
  remainingAuthorizationDays,
} = require("../lib/push-notifications");

test("TikTok authorization warns at seven days or less", () => {
  const now = Date.parse("2026-07-22T00:00:00.000Z");
  assert.equal(remainingAuthorizationDays("2026-07-29T00:00:00.000Z", now), 7);
  assert.equal(authorizationNeedsWarning({ connected: true, expiresAt: "2026-07-29T00:00:00.000Z" }, now), true);
  assert.equal(authorizationNeedsWarning({ connected: true, expiresAt: "2026-07-29T00:00:00.001Z" }, now), false);
  assert.equal(authorizationNeedsWarning({ connected: false, expiresAt: "2026-07-23T00:00:00.000Z" }, now), false);
});

test("TikTok push opens the settings panel", () => {
  const payload = pushPayload({ expiresAt: "2026-07-25T00:00:00.000Z" }, Date.parse("2026-07-22T00:00:00.000Z"));
  assert.match(payload.body, /3 hari/);
  assert.equal(payload.url, "/?tab=invoicepilot&panel=settings-panel&tiktok=reauthorize#tiktokAdsSettings");
});
