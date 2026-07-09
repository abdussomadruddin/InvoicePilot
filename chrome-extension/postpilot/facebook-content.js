const PANEL_ID = "postpilot-assist-panel";
const RUN_LOCK_KEY = "postpilotRunLock";
const STARTED_AUTOMATION_KEY = "postpilotStartedAutomationId";
const COMPLETED_AUTOMATION_KEY = "postpilotCompletedAutomationId";
const LOCK_TTL_MS = 7 * 60_000;
const STEP_RETRY_MS = 5 * 60_000;
const SHORT_STEP_RETRY_MS = 90_000;
const STEP_RETRY_INTERVAL_MS = 5_000;

let inPageRun = false;

function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function now() {
  return Date.now();
}

function visible(element) {
  if (!element) return false;
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
}

function attrOf(element, name) {
  return typeof element?.getAttribute === "function" ? element.getAttribute(name) || "" : "";
}

function hasAttr(element, name) {
  return typeof element?.hasAttribute === "function" && element.hasAttribute(name);
}

function textOf(element) {
  return String(element?.innerText || element?.textContent || attrOf(element, "aria-label") || "").trim();
}

function normalized(value) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, "")
    .trim();
}

function countNeedle(haystack, needle) {
  const safeNeedle = normalized(needle);
  if (!safeNeedle) return 0;
  return normalized(haystack).split(safeNeedle).length - 1;
}

function disabled(element) {
  return Boolean(element?.disabled)
    || attrOf(element, "aria-disabled") === "true"
    || hasAttr(element, "disabled");
}

async function waitUntil(check, { timeout = 8_000, interval = 180, label = "Step" } = {}) {
  const started = now();
  while (now() - started <= timeout) {
    const result = await check();
    if (result) return result;
    await sleep(interval);
  }
  throw new Error(`${label} belum siap.`);
}

function dataUrlToFile(dataUrl, name, type) {
  const [header, data] = String(dataUrl || "").split(",");
  const mime = type || header.match(/data:([^;]+)/)?.[1] || "image/jpeg";
  const binary = atob(data || "");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], name || "post-hook.jpg", { type: mime });
}

function activeDialog() {
  const dialogs = [...document.querySelectorAll('[role="dialog"], [aria-modal="true"]')].filter(visible);
  return dialogs.find((dialog) => /create post|buat siaran|what's on your mind|apa yang anda fikir|post/i.test(textOf(dialog)))
    || dialogs[dialogs.length - 1]
    || null;
}

function activeComposerScope() {
  return activeDialog() || document;
}

function findClickableIn(scope, patterns) {
  const regexes = patterns.map((pattern) => new RegExp(pattern, "i"));
  const nodes = [...scope.querySelectorAll("button, a, div[role='button'], span[role='button']")]
    .filter((node) => visible(node) && !disabled(node) && !node.closest(`#${PANEL_ID}`));
  return nodes.find((node) => regexes.some((regex) => regex.test(textOf(node))));
}

function findClickable(patterns) {
  return findClickableIn(document, patterns);
}

function findFileInput(scope = activeComposerScope()) {
  return [...scope.querySelectorAll("input[type='file']"), ...document.querySelectorAll("input[type='file']")]
    .find((node) => !node.disabled && (!node.accept || /image|\*/i.test(node.accept)));
}

function findPhotoVideoButton(scope = document) {
  return findClickableIn(scope, [
    "^photo/video$",
    "^gambar/video$",
    "^foto/video$",
    "photo/video",
    "gambar/video",
    "foto/video",
    "add photo",
    "tambah foto",
    "tambah gambar",
  ]);
}

function findTextboxIn(scope, purpose = "post") {
  const candidates = [
    ...scope.querySelectorAll('[contenteditable="true"][role="textbox"]'),
    ...scope.querySelectorAll('[contenteditable="true"]'),
    ...scope.querySelectorAll("textarea"),
  ].filter((node) => visible(node) && !node.closest(`#${PANEL_ID}`));

  return candidates.find((node) => {
    const label = String(attrOf(node, "aria-label") || "").toLowerCase();
    const placeholder = String(attrOf(node, "aria-placeholder") || attrOf(node, "placeholder") || "").toLowerCase();
    const text = textOf(node).toLowerCase();
    const combined = `${label} ${placeholder}`;
    if (combined.includes("search")) return false;
    if (purpose === "comment") {
      return combined.includes("comment")
        || combined.includes("reply")
        || combined.includes("komen")
        || combined.includes("balas")
        || text.length < 120;
    }
    if (combined.includes("comment") || combined.includes("reply") || combined.includes("komen") || combined.includes("balas")) return false;
    return combined.includes("what")
      || combined.includes("mind")
      || combined.includes("post")
      || combined.includes("apa")
      || text.length < 120;
  }) || candidates[0] || null;
}

function selectContents(target) {
  const range = document.createRange();
  range.selectNodeContents(target);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
}

async function clearTextBox(target, label) {
  target.click();
  target.focus();
  if (target.tagName === "TEXTAREA" || target.tagName === "INPUT") {
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(target), "value")?.set;
    if (setter) setter.call(target, "");
    else target.value = "";
    target.dispatchEvent(new Event("input", { bubbles: true }));
    target.dispatchEvent(new Event("change", { bubbles: true }));
  } else {
    document.execCommand("selectAll", false);
    document.execCommand("delete", false);
    selectContents(target);
    document.execCommand("delete", false);
    target.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "deleteContentBackward" }));
  }
  await waitUntil(() => normalized(textOf(target)).length === 0, {
    timeout: 2_500,
    interval: 120,
    label: `${label} kosong`,
  });
}

async function fillOnce(target, text, label) {
  const content = String(text || "").trim();
  if (!content) throw new Error(`${label} kosong.`);

  await clearTextBox(target, label);
  target.click();
  target.focus();

  if (target.tagName === "TEXTAREA" || target.tagName === "INPUT") {
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(target), "value")?.set;
    if (setter) setter.call(target, content);
    else target.value = content;
    target.dispatchEvent(new Event("input", { bubbles: true }));
    target.dispatchEvent(new Event("change", { bubbles: true }));
  } else {
    document.execCommand("insertText", false, content);
    target.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: content }));
    target.dispatchEvent(new Event("change", { bubbles: true }));
  }

  await waitUntil(() => countNeedle(textOf(target), content) === 1, {
    timeout: 3_500,
    interval: 120,
    label,
  });
  if (countNeedle(textOf(target), content) !== 1) {
    throw new Error(`${label} tidak clean. Auto-post dibatalkan supaya tidak duplicate.`);
  }
}

function visibleLargeImageCount(scope) {
  return [...scope.querySelectorAll("img")].filter((node) => {
    if (!visible(node)) return false;
    const rect = node.getBoundingClientRect();
    return rect.width >= 140 && rect.height >= 90;
  }).length;
}

function visibleBlobImageCount(scope) {
  return [...scope.querySelectorAll("img")].filter((node) => {
    if (!visible(node)) return false;
    const src = String(node.currentSrc || node.src || "");
    return /^blob:|^data:image\//i.test(src);
  }).length;
}

function visibleBackgroundImageCount(scope) {
  return [...scope.querySelectorAll("div, span")].filter((node) => {
    if (!visible(node) || node.closest(`#${PANEL_ID}`)) return false;
    const rect = node.getBoundingClientRect();
    const background = window.getComputedStyle(node).backgroundImage || "";
    return rect.width >= 140 && rect.height >= 90 && background !== "none" && /url\(/i.test(background);
  }).length;
}

function visibleMediaCount(scope) {
  return visibleLargeImageCount(scope) + visibleBlobImageCount(scope) + visibleBackgroundImageCount(scope);
}

function findAttachmentControl(scope) {
  return [...scope.querySelectorAll("button, div[role='button'], span[role='button'], a")]
    .filter((node) => visible(node) && !node.closest(`#${PANEL_ID}`))
    .find((node) => /remove.*(photo|image|attachment)|edit.*(photo|image)|buang.*(gambar|lampiran)|edit.*gambar|remove all/i
      .test(`${textOf(node)} ${attrOf(node, "aria-label") || ""}`));
}

function uploadTextSeen(scope) {
  return /uploading|processing|preparing|memuat naik|sedang diproses|menyediakan/i.test(textOf(scope));
}

function composerHasAttachment(scope, initialImageCount) {
  const text = textOf(scope).toLowerCase();
  if (text.includes("remove post attachment") || text.includes("remove all")) return true;
  if (text.includes("edit") && (text.includes("photo") || text.includes("image") || text.includes("gambar"))) return true;
  if (findAttachmentControl(scope)) return true;
  if (uploadTextSeen(scope)) return true;
  return visibleMediaCount(scope) > initialImageCount;
}

function attachmentReadyStatus(scope, initialImageCount, input, uploadedAt) {
  if (composerHasAttachment(scope, initialImageCount)) return "preview";
  if (input?.files?.length && now() - uploadedAt >= 6_000) return "file-input";
  return "";
}

function dispatchFileToFacebook(input, file) {
  const transfer = new DataTransfer();
  transfer.items.add(file);

  try {
    input.files = transfer.files;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  } catch (error) {
    // Keep going with drop/paste events. Some Facebook inputs are wrapped by custom upload UI.
  }

  const targets = [
    input,
    input.parentElement,
    activeComposerScope(),
    findTextboxIn(activeComposerScope(), "post"),
    document.body,
  ].filter(Boolean);

  for (const target of targets) {
    try {
      for (const eventName of ["dragenter", "dragover", "drop"]) {
        target.dispatchEvent(new DragEvent(eventName, {
          bubbles: true,
          cancelable: true,
          dataTransfer: transfer,
        }));
      }
    } catch (error) {
      // File input/change is still the main route; drag/drop is best-effort.
    }
    try {
      target.dispatchEvent(new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
        clipboardData: transfer,
      }));
    } catch (error) {
      // Some Chrome builds reject synthetic clipboard payloads. File input remains the primary path.
    }
  }

  return transfer;
}

function findActionInComposer(scope, labels) {
  const regexes = labels.map((label) => new RegExp(label, "i"));
  const root = scope || document;
  const nodes = [...root.querySelectorAll("button, div[role='button'], span[role='button']")]
    .filter((node) => visible(node) && !disabled(node) && !node.closest(`#${PANEL_ID}`));
  return nodes.find((node) => regexes.some((regex) => regex.test(textOf(node))));
}

function findActionButton(scope, labels) {
  return findActionInComposer(scope, labels)
    || (scope !== document ? findActionInComposer(document, labels) : null);
}

function postTextProbe(text) {
  return String(text || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .find((line) => !/^klik\s+sini\s*:/i.test(line) && !/^https?:\/\//i.test(line))
    || String(text || "").trim().slice(0, 50);
}

function findNewestPostByCaption(postText) {
  const probe = normalized(postTextProbe(postText));
  if (!probe) return null;
  const articles = [...document.querySelectorAll('[role="article"], div[data-pagelet*="FeedUnit"], div[data-ft]')]
    .filter(visible);
  return articles.find((article) => normalized(textOf(article)).includes(probe)) || null;
}

function findCommentButtonForPost(postNode) {
  return findClickableIn(postNode, ["^comment$", "^komen$", "^reply$", "^balas$"]);
}

function findSubmitCommentButton(scope) {
  const regexes = ["^comment$", "^post$", "^reply$", "^send$", "^komen$", "^siar$", "^balas$"]
    .map((pattern) => new RegExp(pattern, "i"));
  const nodes = [...scope.querySelectorAll("button, div[role='button'], span[role='button']")]
    .filter((node) => visible(node) && !disabled(node) && !node.closest(`#${PANEL_ID}`));
  return nodes.reverse().find((node) => regexes.some((regex) => regex.test(textOf(node))));
}

function commentSubmitScope(commentBox) {
  let node = commentBox;
  for (let depth = 0; node && depth < 7; depth += 1) {
    const submit = findSubmitCommentButton(node);
    if (submit) return node;
    node = node.parentElement;
  }
  return commentBox.closest('[role="article"]') || document;
}

async function getDraft() {
  const { currentDraft } = await chrome.storage.local.get("currentDraft");
  if (!currentDraft?.postText) throw new Error("Tiada draft Post Pilot. Hantar draft dari webapp dahulu.");
  return currentDraft;
}

async function acquireRunLock(label, automationId, manual = false) {
  if (inPageRun) throw new Error("Post Pilot sedang jalan. Tunggu step sekarang siap dulu.");

  const state = await chrome.storage.local.get([RUN_LOCK_KEY, COMPLETED_AUTOMATION_KEY, STARTED_AUTOMATION_KEY]);
  const lock = state[RUN_LOCK_KEY];
  if (lock?.startedAt && now() - Number(lock.startedAt) < LOCK_TTL_MS) {
    throw new Error(`Post Pilot sedang jalan (${lock.label || "automation"}). Tunggu siap dulu.`);
  }
  if (!manual && automationId && state[COMPLETED_AUTOMATION_KEY] === automationId) {
    throw new Error("Automation ini sudah selesai. Hantar draft baru untuk run lagi.");
  }
  if (!manual && automationId && state[STARTED_AUTOMATION_KEY] === automationId) {
    throw new Error("Automation ini sudah pernah start. Hantar draft baru untuk elak duplicate.");
  }

  inPageRun = true;
  await chrome.storage.local.set({
    [RUN_LOCK_KEY]: { label, automationId, startedAt: now() },
    ...(automationId ? { [STARTED_AUTOMATION_KEY]: automationId } : {}),
  });
}

async function releaseRunLock() {
  inPageRun = false;
  await chrome.storage.local.remove(RUN_LOCK_KEY).catch(() => {});
}

function showPanel(status, draft) {
  chrome.storage?.local?.set?.({ postpilotAutomationStatus: status || "Draft ready." }).catch(() => {});
  const existing = document.getElementById(PANEL_ID);
  if (existing) existing.remove();

  const panel = document.createElement("div");
  panel.id = PANEL_ID;
  panel.style.cssText = [
    "position:fixed",
    "right:16px",
    "bottom:16px",
    "z-index:2147483647",
    "width:min(360px,calc(100vw - 32px))",
    "padding:14px",
    "border-radius:16px",
    "background:#ffffff",
    "color:#111827",
    "box-shadow:0 16px 45px rgba(0,0,0,.22)",
    "font:14px/1.4 Arial,Helvetica,sans-serif",
    "border:1px solid #e5e7eb",
  ].join(";");

  const title = document.createElement("strong");
  title.textContent = "Post Pilot Assist";
  title.style.display = "block";

  const body = document.createElement("p");
  body.textContent = status || "Draft ready.";
  body.style.whiteSpace = "pre-wrap";
  body.style.margin = "8px 0 10px";
  body.style.color = "#374151";

  const actions = document.createElement("div");
  actions.style.cssText = "display:flex;flex-wrap:wrap;gap:8px";
  actions.append(
    button("Auto Full Flow", async () => {
      try {
        const nextDraft = { ...(draft || await getDraft()), autoPublish: true };
        await chrome.storage.local.set({ currentDraft: nextDraft, [STARTED_AUTOMATION_KEY]: "", [COMPLETED_AUTOMATION_KEY]: "" });
        await runFullAutomation({ manual: true });
      } catch (error) {
        showPanel(error.message, draft);
      }
    }),
    button("Copy CTA", async () => {
      await navigator.clipboard.writeText(draft?.commentCta || "");
      showPanel("CTA komen sudah dicopy.", draft);
    }),
    button("Close", () => panel.remove())
  );

  for (const action of actions.querySelectorAll("button")) {
    action.style.cssText = "border:0;border-radius:999px;background:#111827;color:#fff;padding:8px 10px;font-weight:700;cursor:pointer";
  }

  panel.append(title, body, actions);
  document.documentElement.appendChild(panel);
}

function button(label, handler) {
  const node = document.createElement("button");
  node.type = "button";
  node.textContent = label;
  node.addEventListener("click", handler);
  return node;
}

function progress(steps, current) {
  return [...steps, current].join("\n");
}

async function waitStep(check, { timeout = SHORT_STEP_RETRY_MS, interval = STEP_RETRY_INTERVAL_MS, label = "Step", draft = null } = {}) {
  const started = now();
  let attempt = 0;
  while (now() - started <= timeout) {
    attempt += 1;
    const result = await check();
    if (result) return result;
    const remainingSeconds = Math.max(0, Math.ceil((timeout - (now() - started)) / 1000));
    showPanel(`${label} belum ready. Cuba lagi dalam 5s...\nAttempt ${attempt}. Baki ${remainingSeconds}s.`, draft);
    await sleep(interval);
  }
  throw new Error(`${label} belum siap.`);
}

async function clickPhotoVideo(draft) {
  const inputBeforeClick = findFileInput(activeComposerScope());
  if (inputBeforeClick) return inputBeforeClick;

  let photoButton = await waitStep(() => findPhotoVideoButton(document), {
    timeout: 18_000,
    interval: STEP_RETRY_INTERVAL_MS,
    label: "1/8 Button Photo/video",
    draft,
  }).catch(() => null);

  if (!photoButton) {
    const composerPrompt = await waitStep(() => findClickable([
      "what's on your mind",
      "what is on your mind",
      "apa yang anda fikir",
      "create post",
      "buat siaran",
    ]), {
      timeout: 18_000,
      interval: STEP_RETRY_INTERVAL_MS,
      label: "1/8 Composer Facebook",
      draft,
    });
    composerPrompt.click();
    await sleep(700);

    photoButton = await waitStep(() => findPhotoVideoButton(activeComposerScope()) || findFileInput(activeComposerScope()), {
      timeout: 18_000,
      interval: STEP_RETRY_INTERVAL_MS,
      label: "1/8 Button Photo/video dalam composer",
      draft,
    });
  }

  if (typeof photoButton.click === "function") {
    photoButton.click();
    await sleep(800);
  }

  return waitStep(() => findFileInput(activeComposerScope()) || findFileInput(document), {
    timeout: 18_000,
    interval: STEP_RETRY_INTERVAL_MS,
    label: "1/8 Input gambar selepas Photo/video",
    draft,
  });
}

async function ensureComposerOpen() {
  const textbox = await waitUntil(() => {
    const scope = activeComposerScope();
    const found = findTextboxIn(scope, "post");
    if (found) return found;
    const prompt = findClickableIn(scope, ["what's on your mind", "what is on your mind", "apa yang anda fikir", "write something"]);
    if (prompt) prompt.click();
    return null;
  }, {
    timeout: 12_000,
    interval: 220,
    label: "Composer Facebook",
  });
  return { scope: activeComposerScope(), textbox };
}

async function attachHookImageFromDraft(draft) {
  if (!draft.image?.dataUrl) throw new Error("Gambar hook tiada dalam draft. Auto-post dibatalkan.");
  const file = dataUrlToFile(draft.image.dataUrl, draft.image.name, draft.image.type);
  const baselineMediaCount = visibleMediaCount(activeComposerScope());
  const started = now();
  let attempt = 0;
  let lastError = "";

  while (now() - started <= STEP_RETRY_MS) {
    attempt += 1;
    const remainingSeconds = Math.max(0, Math.ceil((STEP_RETRY_MS - (now() - started)) / 1000));
    try {
      const scope = activeComposerScope();
      if (composerHasAttachment(scope, baselineMediaCount)) return;
      showPanel(`2/8 Attach gambar hook...\nAttempt ${attempt}. Baki ${remainingSeconds}s.`, draft);

      let input = findFileInput(scope) || findFileInput(document);
      if (!input) {
        showPanel(`2/8 Input gambar belum ready.\nPatah balik ke step 1: tekan Photo/video semula.`, draft);
        await clickPhotoVideo(draft);
        input = await waitUntil(() => findFileInput(activeComposerScope()) || findFileInput(document), {
          timeout: 8_000,
          interval: 200,
          label: "Input gambar hook",
        });
      }

      const uploadedAt = now();
      dispatchFileToFacebook(input, file);

      const readyStatus = await waitUntil(() => attachmentReadyStatus(activeComposerScope(), baselineMediaCount, input, uploadedAt), {
        timeout: 24_000,
        interval: 300,
        label: "Upload gambar hook Facebook",
      });
      if (readyStatus === "file-input") {
        showPanel("2/8 Gambar hook sudah dihantar ke Facebook.\nPreview visual tidak dapat dibaca, teruskan tunggu button Next/Post ready.", draft);
        await sleep(1_000);
      }
      return;
    } catch (error) {
      lastError = error?.message || String(error);
      showPanel(`2/8 Gambar hook belum ready.\nAttempt ${attempt} gagal: ${lastError}\nPatah balik ke step 1, kemudian cuba lagi sampai 5 minit...`, draft);
      await clickPhotoVideo(draft).catch(() => {});
      await sleep(STEP_RETRY_INTERVAL_MS);
    }
  }

  throw new Error(`Preview gambar hook masih belum siap selepas 5 minit. Last error: ${lastError || "unknown"}`);
}

async function removeLinkPreviewIfPresent() {
  const scope = activeComposerScope();
  const removeButton = findClickableIn(scope, [
    "^remove link preview",
    "remove link preview from your post",
    "^remove preview",
    "buang pratonton pautan",
  ]);
  if (removeButton) {
    removeButton.click();
    await sleep(350);
  }
}

function findNextButton(scope) {
  return findActionButton(scope, [/^next$/i, /^continue$/i, /^done$/i, /^seterusnya$/i, /^teruskan$/i, /^selesai$/i].map((r) => r.source));
}

function findPostButton(scope) {
  return findActionButton(scope, [/^post$/i, /^publish$/i, /^siar$/i, /^siarkan$/i, /^kongsi$/i, /^kongsikan$/i].map((r) => r.source));
}

async function clickNextStep(draft) {
  const result = await waitStep(() => {
    const scope = activeComposerScope();
    const nextButton = findNextButton(scope);
    if (nextButton) return { button: nextButton, type: "next" };
    const postButton = findPostButton(scope);
    if (postButton) return { button: postButton, type: "post" };
    return null;
  }, {
    timeout: SHORT_STEP_RETRY_MS,
    interval: STEP_RETRY_INTERVAL_MS,
    label: "4/8 Button Next",
    draft,
  });

  if (result.type === "post") {
    return "skipped";
  }

  result.button.click();
  await sleep(750);
  return "clicked";
}

async function clickPostStep(draft) {
  const postButton = await waitStep(() => findPostButton(activeComposerScope()), {
    timeout: STEP_RETRY_MS,
    interval: STEP_RETRY_INTERVAL_MS,
    label: "5/8 Button Post",
    draft,
  });
  postButton.click();
}

async function waitForPostPublished(postText) {
  await waitUntil(() => !activeDialog(), {
    timeout: 15_000,
    interval: 300,
    label: "Composer tutup selepas post",
  }).catch(() => {});
  return waitUntil(() => findNewestPostByCaption(postText), {
    timeout: 25_000,
    interval: 600,
    label: "Post baru dalam feed",
  });
}

async function openCommentBoxForPost(postNode) {
  const commentButton = findCommentButtonForPost(postNode);
  if (!commentButton) throw new Error("Button komen tidak dijumpai pada post baru.");
  commentButton.click();
  return waitUntil(() => findTextboxIn(postNode, "comment") || findTextboxIn(document, "comment"), {
    timeout: 8_000,
    interval: 200,
    label: "Ruang komen",
  });
}

async function fillCommentOnce(commentBox, ctaText) {
  await fillOnce(commentBox, ctaText, "CTA komen");
}

async function submitCommentButtonOnce(commentBox) {
  const scope = commentSubmitScope(commentBox);
  const submit = await waitUntil(() => findSubmitCommentButton(scope) || findSubmitCommentButton(document), {
    timeout: 6_000,
    interval: 200,
    label: "Button post komen",
  });
  submit.click();
  await sleep(600);
}

async function runFullAutomation({ manual = false } = {}) {
  const draft = await getDraft();
  const automationId = draft.automationId || draft.id || `postpilot-${Date.now()}`;
  await acquireRunLock("full-auto-flow", automationId, manual);
  const steps = [];
  try {
    showPanel(progress(steps, "1/8 Facebook tab baru sudah dibuka. Cari Photo/video..."), draft);
    await waitUntil(() => document.readyState === "complete" || document.readyState === "interactive", {
      timeout: 8_000,
      interval: 200,
      label: "Facebook page",
    });
    await clickPhotoVideo(draft);
    steps.push("1/8 Facebook ready dan Photo/video ditekan.");

    showPanel(progress(steps, "2/8 Pilih/attach gambar hook dari draft tersimpan..."), draft);
    await attachHookImageFromDraft(draft);
    steps.push("2/8 Gambar hook sudah dihantar ke composer.");

    showPanel(progress(steps, "3/8 Isi personal post sekali sahaja..."), draft);
    const { textbox } = await ensureComposerOpen();
    await fillOnce(textbox, draft.postText, "Personal post");
    await removeLinkPreviewIfPresent();
    steps.push("3/8 Personal post clean, tiada duplicate.");

    showPanel(progress(steps, "4/8 Tekan Next..."), draft);
    const nextStatus = await clickNextStep(draft);
    steps.push(nextStatus === "skipped"
      ? "4/8 Next tidak diperlukan, terus ke Post."
      : "4/8 Next ditekan.");

    showPanel(progress(steps, "5/8 Tekan Post..."), draft);
    await clickPostStep(draft);
    steps.push("5/8 Post ditekan.");

    showPanel(progress(steps, "5/8 Tunggu post baru muncul..."), draft);
    const postNode = await waitForPostPublished(draft.postText);
    steps.push("5/8 Post live dijumpai.");

    showPanel(progress(steps, "6/8 Tekan bahagian komen..."), draft);
    const commentBox = await openCommentBoxForPost(postNode);
    steps.push("6/8 Ruang komen ready.");

    showPanel(progress(steps, "7/8 Isi CTA komen sekali sahaja..."), draft);
    await fillCommentOnce(commentBox, draft.commentCta);
    steps.push("7/8 CTA komen clean, tiada duplicate.");

    showPanel(progress(steps, "8/8 Post komen..."), draft);
    await submitCommentButtonOnce(commentBox);
    steps.push("8/8 CTA komen dipost.");

    await chrome.storage.local.set({ [COMPLETED_AUTOMATION_KEY]: automationId, autoPublishedDraftId: draft.id || automationId });
    steps.push("Full flow selesai.");
    showPanel(steps.join("\n"), draft);
    return { ok: true, message: steps.join("\n") };
  } finally {
    await releaseRunLock();
  }
}

async function fillPostOnly() {
  const draft = await getDraft();
  await acquireRunLock("fill-post", draft.automationId || draft.id || "", true);
  try {
    await clickPhotoVideo(draft);
    await attachHookImageFromDraft(draft);
    const { textbox } = await ensureComposerOpen();
    await fillOnce(textbox, draft.postText, "Personal post");
    await removeLinkPreviewIfPresent();
    showPanel("Post personal sudah diisi sekali sahaja. Semak composer.", draft);
    return { ok: true };
  } finally {
    await releaseRunLock();
  }
}

async function fillCommentOnly() {
  const draft = await getDraft();
  await acquireRunLock("fill-comment", draft.automationId || draft.id || "", true);
  try {
    const postNode = findNewestPostByCaption(draft.postText) || document;
    const commentBox = await openCommentBoxForPost(postNode);
    await fillOnce(commentBox, draft.commentCta, "CTA komen");
    showPanel("CTA komen sudah diisi sekali sahaja. Semak sebelum post komen.", draft);
    return { ok: true };
  } finally {
    await releaseRunLock();
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (message?.type === "POSTPILOT_FILL_POST") {
      sendResponse(await fillPostOnly());
      return;
    }
    if (message?.type === "POSTPILOT_AUTO_POST") {
      runFullAutomation({ manual: true }).catch((error) => {
        showPanel(error?.message || String(error), null);
      });
      sendResponse({ ok: true, message: "Full auto flow started." });
      return;
    }
    if (message?.type === "POSTPILOT_FILL_COMMENT") {
      sendResponse(await fillCommentOnly());
      return;
    }
    sendResponse({ ok: false, error: "Unknown message." });
  })().catch((error) => {
    showPanel(error?.message || String(error), null);
    sendResponse({ ok: false, error: error?.message || String(error) });
  });
  return true;
});

(async () => {
  try {
    const draft = await getDraft();
    showPanel(draft.autoPublish
      ? "Draft diterima. Auto flow standby, tunggu arahan dari Post Pilot extension."
      : "Draft diterima. Tekan Auto Full Flow bila ready.", draft);
  } catch (error) {
    if (!String(error?.message || error).includes("Tiada draft") && !String(error?.message || error).includes("sudah pernah start")) {
      showPanel(error?.message || String(error), null);
    }
  }
})();
