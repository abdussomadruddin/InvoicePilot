const {
  buildPersonalPostPreview,
  defaultCommentCta,
  PERSONAL_POST_ANGLE_COUNT,
} = require("./personal-postpilot");
const {
  getPostPilotDraft,
  reservePostPilotHookImages,
  upsertPostPilotDraft,
} = require("./supabase-db");

const MODES = ["soft", "hard", "proof", "engagement", "objection"];

function randomItem(list) {
  return list[Math.floor(Math.random() * list.length)] || list[0];
}

function shuffled(values) {
  return [...values].sort(() => Math.random() - 0.5);
}

function pickVariation(mode, recent = []) {
  const used = new Set(recent.map((value) => String(value)));
  for (let attempt = 0; attempt < PERSONAL_POST_ANGLE_COUNT * 2; attempt += 1) {
    const variation = Math.floor(Math.random() * PERSONAL_POST_ANGLE_COUNT);
    if (!used.has(`${mode}:${variation}`)) return variation;
  }
  return Math.floor(Math.random() * PERSONAL_POST_ANGLE_COUNT);
}

async function buildPersonalPostBatch({ count = 1, productId = "", productName = "", affiliateLink = "", personalBackground = "", angleNote = "" } = {}) {
  const safeCount = Number(count) === 5 ? 5 : 1;
  const draft = await getPostPilotDraft();
  const images = await reservePostPilotHookImages(safeCount, productId || draft.activeProductId);
  const nextModes = MODES.filter((mode) => mode !== draft.postMode);
  const modes = safeCount === 5
    ? shuffled(MODES)
    : [randomItem(nextModes.length ? nextModes : MODES)];
  let recent = Array.isArray(draft.recentVariations) ? draft.recentVariations.slice(-120) : [];
  const posts = [];

  for (let index = 0; index < safeCount; index += 1) {
    const mode = modes[index];
    const variation = pickVariation(mode, recent);
    const generated = await buildPersonalPostPreview({
      productName: productName || draft.productName,
      affiliateLink: affiliateLink || draft.affiliateLink,
      personalBackground,
      angleNote,
      postMode: mode,
      variation,
    });
    const key = `${mode}:${variation}`;
    recent = [...recent.filter((value) => String(value) !== key), key].slice(-120);
    posts.push({
      id: `postpilot-batch-${Date.now()}-${index}`,
      postText: generated.preview.post_text,
      commentCta: defaultCommentCta(affiliateLink || draft.affiliateLink),
      postMode: mode,
      variation,
      style: generated.preview.style,
      image: {
        id: images[index].id,
        name: images[index].name,
        type: images[index].type || "image/jpeg",
        url: images[index].url,
      },
    });
  }

  await upsertPostPilotDraft({
    productName: productName || draft.productName,
    affiliateLink: affiliateLink || draft.affiliateLink,
    activeProductId: productId || draft.activeProductId,
    postMode: modes[modes.length - 1],
    recentVariations: recent,
  });

  return { count: safeCount, posts };
}

module.exports = {
  buildPersonalPostBatch,
};
