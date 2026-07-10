const { requireAuth } = require("../lib/auth");
const {
  buildPersonalPostPreview,
  defaultCommentCta,
  PERSONAL_POST_ANGLE_COUNT,
} = require("../lib/personal-postpilot");
const {
  getPostPilotDraft,
  reservePostPilotHookImages,
  upsertPostPilotDraft,
  downloadPostPilotHookGalleryImage,
} = require("../lib/supabase-db");
const { readJsonBody } = require("../lib/postpilot");

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

async function dataUrlForImage(imageId) {
  const { image, buffer, contentType } = await downloadPostPilotHookGalleryImage(imageId);
  return {
    id: image.id,
    name: image.name,
    type: contentType || image.type || "image/jpeg",
    dataUrl: `data:${contentType || image.type || "image/jpeg"};base64,${buffer.toString("base64")}`,
  };
}

module.exports = async function handler(req, res) {
  res.setHeader("content-type", "application/json; charset=utf-8");
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end(JSON.stringify({ ok: false, error: "Method not allowed." }));
    return;
  }

  try {
    requireAuth(req);
    const body = await readJsonBody(req);
    const count = Number(body.count) === 5 ? 5 : 1;
    const draft = await getPostPilotDraft();
    const images = await reservePostPilotHookImages(count);
    const nextModes = MODES.filter((mode) => mode !== draft.postMode);
    const modes = count === 5
      ? shuffled(MODES)
      : [randomItem(nextModes.length ? nextModes : MODES)];
    let recent = Array.isArray(draft.recentVariations) ? draft.recentVariations.slice(-120) : [];
    const posts = [];

    for (let index = 0; index < count; index += 1) {
      const mode = modes[index];
      const variation = pickVariation(mode, recent);
      const generated = await buildPersonalPostPreview({
        productName: body.product_name || draft.productName,
        affiliateLink: body.affiliate_link || draft.affiliateLink,
        personalBackground: body.personal_background || "",
        angleNote: body.angle_note || "",
        postMode: mode,
        variation,
      });
      const key = `${mode}:${variation}`;
      recent = [...recent.filter((value) => String(value) !== key), key].slice(-120);
      posts.push({
        id: `postpilot-batch-${Date.now()}-${index}`,
        postText: generated.preview.post_text,
        commentCta: defaultCommentCta(body.affiliate_link || draft.affiliateLink),
        postMode: mode,
        variation,
        style: generated.preview.style,
        image: await dataUrlForImage(images[index].id),
      });
    }

    await upsertPostPilotDraft({
      productName: body.product_name || draft.productName,
      affiliateLink: body.affiliate_link || draft.affiliateLink,
      postMode: modes[modes.length - 1],
      recentVariations: recent,
    });

    res.statusCode = 200;
    res.end(JSON.stringify({ ok: true, count, posts }));
  } catch (error) {
    res.statusCode = error.statusCode || 400;
    res.end(JSON.stringify({ ok: false, error: error?.message || String(error) }));
  }
};
