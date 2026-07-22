const test = require("node:test");
const assert = require("node:assert/strict");
const { ALERT_DEDUPE_MS, shouldNotify } = require("../lib/operations-events");

test("critical operations alerts dedupe for 24 hours", () => {
  const now = Date.parse("2026-07-22T04:00:00.000Z");
  assert.equal(shouldNotify({ severity: "warning" }, now), false);
  assert.equal(shouldNotify({ severity: "critical", last_notified_at: "" }, now), true);
  assert.equal(shouldNotify({ severity: "critical", last_notified_at: new Date(now - ALERT_DEDUPE_MS + 1).toISOString() }, now), false);
  assert.equal(shouldNotify({ severity: "critical", last_notified_at: new Date(now - ALERT_DEDUPE_MS).toISOString() }, now), true);
});
