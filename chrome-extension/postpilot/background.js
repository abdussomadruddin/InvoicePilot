const FACEBOOK_HOME_URL = "https://www.facebook.com/";
const FACEBOOK_URL_PATTERN = /^https:\/\/(www\.)?facebook\.com\//;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0] || null;
}

async function sendToActiveFacebookTab(type) {
  const tab = await getActiveTab();
  if (!tab?.id) throw new Error("No active tab found.");
  if (!FACEBOOK_URL_PATTERN.test(tab.url || "")) {
    throw new Error("Open a Facebook tab first.");
  }
  return chrome.tabs.sendMessage(tab.id, { type });
}

async function waitForFacebookTabReady(tabId) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const tab = await chrome.tabs.get(tabId).catch(() => null);
    if (tab?.status === "complete" && FACEBOOK_URL_PATTERN.test(tab.url || "")) return tab;
    await delay(500);
  }
  throw new Error("Facebook tab belum ready.");
}

async function sendToFacebookTabWithRetry(tabId, type) {
  let lastError = "";
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await chrome.tabs.sendMessage(tabId, { type });
      if (response?.ok) return response;
      lastError = response?.error || "Facebook content script belum ready.";
    } catch (error) {
      lastError = error?.message || String(error);
    }
    await delay(600);
  }
  throw new Error(lastError || "Post Pilot content script tidak respond.");
}

async function openFacebookAndRunAutomation() {
  await chrome.storage.local.set({ postpilotAutomationStatus: "Opening Facebook..." });
  const tab = await chrome.tabs.create({ url: FACEBOOK_HOME_URL, active: true });
  if (!tab?.id) throw new Error("Gagal buka tab Facebook.");
  await chrome.storage.local.set({ postpilotAutomationStatus: "Waiting for Facebook tab..." });
  await waitForFacebookTabReady(tab.id);
  await chrome.storage.local.set({ postpilotAutomationStatus: "Starting auto flow in Facebook..." });
  const response = await sendToFacebookTabWithRetry(tab.id, "POSTPILOT_AUTO_POST");
  await chrome.storage.local.set({ postpilotAutomationStatus: "Auto flow started in Facebook." });
  return response;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (message?.type === "SAVE_DRAFT_AND_OPEN_FACEBOOK") {
      const draft = {
        ...message.draft,
        automationId: message.draft?.automationId || `postpilot-auto-${Date.now()}`,
        autoPublish: true,
      };
      if (!draft?.postText || !draft?.commentCta) throw new Error("Draft is missing post or CTA text.");
      await chrome.storage.local.set({
        currentDraft: draft,
        postpilotStartedAutomationId: "",
        postpilotCompletedAutomationId: "",
        postpilotRunLock: null,
        postpilotLastError: "",
        postpilotAutomationStatus: "Draft saved. Preparing Facebook...",
      });
      openFacebookAndRunAutomation().catch(async (error) => {
        await chrome.storage.local.set({
          postpilotLastError: error?.message || String(error),
        });
      });
      sendResponse({ ok: true });
      return;
    }

    if (message?.type === "GET_CURRENT_DRAFT") {
      const { currentDraft, postpilotLastError, postpilotAutomationStatus } = await chrome.storage.local.get([
        "currentDraft",
        "postpilotLastError",
        "postpilotAutomationStatus",
      ]);
      sendResponse({
        ok: true,
        draft: currentDraft || null,
        lastError: postpilotLastError || "",
        automationStatus: postpilotAutomationStatus || "",
      });
      return;
    }

    if (message?.type === "OPEN_FACEBOOK") {
      await chrome.tabs.create({ url: FACEBOOK_HOME_URL });
      sendResponse({ ok: true });
      return;
    }

    if (message?.type === "FILL_ACTIVE_POST" || message?.type === "FILL_ACTIVE_COMMENT" || message?.type === "AUTO_POST_ACTIVE") {
      const result = await sendToActiveFacebookTab(message.type === "FILL_ACTIVE_COMMENT"
        ? "POSTPILOT_FILL_COMMENT"
        : message.type === "AUTO_POST_ACTIVE"
          ? "POSTPILOT_AUTO_POST"
          : "POSTPILOT_FILL_POST");
      sendResponse(result || { ok: true });
      return;
    }

    sendResponse({ ok: false, error: "Unknown message." });
  })().catch((error) => {
    sendResponse({ ok: false, error: error?.message || String(error) });
  });

  return true;
});
