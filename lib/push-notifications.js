const webPush = require("web-push");
const { tikTokConnectionStatus } = require("./tiktok-ads");
const {
  deletePushSubscription,
  listPushSubscriptions,
  markPushSubscriptionNotified,
} = require("./supabase-db");

const EXPIRY_WARNING_DAYS = 7;
const DAY_MS = 86400000;

function remainingAuthorizationDays(expiresAt, now = Date.now()) {
  const expiresMs = new Date(expiresAt || "").getTime();
  if (!Number.isFinite(expiresMs)) return null;
  return Math.max(0, Math.ceil((expiresMs - now) / DAY_MS));
}

function authorizationNeedsWarning(connection, now = Date.now()) {
  const days = remainingAuthorizationDays(connection?.expiresAt, now);
  return Boolean(connection?.connected && days !== null && days <= EXPIRY_WARNING_DAYS);
}

function pushPayload(connection, now = Date.now()) {
  const days = remainingAuthorizationDays(connection.expiresAt, now);
  return {
    title: "TikTok Ads hampir tamat",
    body: days === 0
      ? "Authorization TikTok Ads tamat hari ini. Reauthorize sekarang."
      : `Authorization TikTok Ads tamat dalam ${days} hari. Reauthorize supaya report tidak terhenti.`,
    icon: "/icons/app-icon-192x192.png",
    badge: "/icons/app-icon-96x96.png",
    tag: `tiktok-auth-${connection.expiresAt}`,
    url: "/?tab=invoicepilot&panel=settings-panel&tiktok=reauthorize#tiktokAdsSettings",
  };
}

function configureWebPush() {
  const publicKey = String(process.env.VAPID_PUBLIC_KEY || "").trim();
  const privateKey = String(process.env.VAPID_PRIVATE_KEY || "").trim();
  if (!publicKey || !privateKey) throw new Error("VAPID_PUBLIC_KEY dan VAPID_PRIVATE_KEY belum diset.");
  webPush.setVapidDetails(String(process.env.VAPID_SUBJECT || "mailto:admin@buddypilot.app"), publicKey, privateKey);
}

async function sendPushPayload(payload) {
  configureWebPush();
  const subscriptions = await listPushSubscriptions();
  const body = JSON.stringify(payload);
  let sent = 0;
  let removed = 0;
  for (const row of subscriptions) {
    try {
      await webPush.sendNotification({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }, body);
      sent += 1;
    } catch (error) {
      if (error?.statusCode === 404 || error?.statusCode === 410) {
        await deletePushSubscription(row.endpoint);
        removed += 1;
        continue;
      }
      throw error;
    }
  }
  return { sent, removed };
}

async function sendOperationsCriticalAlert(incident = {}) {
  const action = incident.action || {};
  const search = new URLSearchParams();
  if (action.tab) search.set("tab", action.tab);
  if (action.panel) search.set("panel", action.panel);
  const url = action.href || (search.size ? `/?${search.toString()}` : "/?tab=dashboard");
  return sendPushPayload({
    title: incident.title || "BuddyPilot perlukan perhatian",
    body: String(incident.detail || "Buka Operations Center untuk semak masalah.").slice(0, 220),
    icon: "/icons/app-icon-192x192.png",
    badge: "/icons/app-icon-96x96.png",
    tag: `operations-${incident.fingerprint || incident.id || "critical"}`,
    url,
  });
}

async function sendTikTokAuthorizationAlerts() {
  const connection = await tikTokConnectionStatus();
  if (!authorizationNeedsWarning(connection)) return { checked: true, sent: 0, skipped: 0, removed: 0 };
  configureWebPush();
  const subscriptions = await listPushSubscriptions();
  const payload = JSON.stringify(pushPayload(connection));
  let sent = 0;
  let skipped = 0;
  let removed = 0;

  for (const row of subscriptions) {
    if (row.last_notified_expires_at && new Date(row.last_notified_expires_at).getTime() === new Date(connection.expiresAt).getTime()) {
      skipped += 1;
      continue;
    }
    try {
      await webPush.sendNotification({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }, payload);
      await markPushSubscriptionNotified(row.endpoint, connection.expiresAt);
      sent += 1;
    } catch (error) {
      if (error?.statusCode === 404 || error?.statusCode === 410) {
        await deletePushSubscription(row.endpoint);
        removed += 1;
        continue;
      }
      throw error;
    }
  }
  return { checked: true, sent, skipped, removed };
}

module.exports = {
  EXPIRY_WARNING_DAYS,
  authorizationNeedsWarning,
  pushPayload,
  remainingAuthorizationDays,
  sendOperationsCriticalAlert,
  sendPushPayload,
  sendTikTokAuthorizationAlerts,
};
