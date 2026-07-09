window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  const data = event.data;
  if (!data || data.source !== "postpilot-webapp" || data.type !== "POSTPILOT_SAVE_DRAFT") return;

  const runtime = globalThis.chrome?.runtime;
  if (!runtime?.sendMessage) {
    window.postMessage({
      source: "postpilot-extension",
      type: "POSTPILOT_DRAFT_STATUS",
      ok: false,
      error: "Post Pilot extension runtime belum ready. Reload extension dan refresh BuddyPilot.",
    }, window.location.origin);
    return;
  }

  const sendStatus = (ok, error = "", message = "") => {
    window.postMessage({
      source: "postpilot-extension",
      type: "POSTPILOT_DRAFT_STATUS",
      ok,
      error,
      message,
    }, window.location.origin);
  };

  try {
    runtime.sendMessage({
      type: "SAVE_DRAFT_AND_OPEN_FACEBOOK",
      draft: data.draft,
    }, (response) => {
      const runtimeError = runtime.lastError?.message || "";
      sendStatus(!runtimeError && Boolean(response?.ok), runtimeError || response?.error || "", response?.message || "");
    });
  } catch (error) {
    sendStatus(false, error?.message || String(error));
  }
});
