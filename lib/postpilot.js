const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_MB || 20) * 1024 * 1024;

function parseContentDisposition(header) {
  const result = {};
  for (const part of String(header || "").split(";")) {
    const [rawKey, ...rawValue] = part.trim().split("=");
    if (!rawValue.length) continue;
    const key = rawKey.trim().toLowerCase();
    let value = rawValue.join("=").trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    result[key] = value;
  }
  return result;
}

async function readRequestBody(req) {
  const chunks = [];
  let total = 0;

  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX_UPLOAD_BYTES) {
      throw new Error(`Upload terlalu besar. Limit ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)}MB.`);
    }
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

function parseMultipart(req, body) {
  const contentType = req.headers["content-type"] || "";
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!boundaryMatch) throw new Error("Invalid multipart form.");

  const boundary = Buffer.from(`--${boundaryMatch[1] || boundaryMatch[2]}`);
  const values = {};
  const files = {};
  let start = body.indexOf(boundary);

  while (start !== -1) {
    start += boundary.length;
    if (body.slice(start, start + 2).toString() === "--") break;
    if (body.slice(start, start + 2).toString() === "\r\n") start += 2;

    const headerEnd = body.indexOf(Buffer.from("\r\n\r\n"), start);
    if (headerEnd === -1) break;
    const headersRaw = body.slice(start, headerEnd).toString("utf8");
    const dataStart = headerEnd + 4;
    let next = body.indexOf(boundary, dataStart);
    if (next === -1) break;
    let dataEnd = next;
    if (body.slice(dataEnd - 2, dataEnd).toString() === "\r\n") dataEnd -= 2;

    const headers = {};
    for (const line of headersRaw.split("\r\n")) {
      const idx = line.indexOf(":");
      if (idx !== -1) headers[line.slice(0, idx).toLowerCase()] = line.slice(idx + 1).trim();
    }

    const disposition = parseContentDisposition(headers["content-disposition"]);
    if (disposition.name) {
      const data = body.slice(dataStart, dataEnd);
      if (disposition.filename) {
        files[disposition.name] = {
          filename: disposition.filename,
          contentType: headers["content-type"] || "application/octet-stream",
          data,
        };
      } else {
        values[disposition.name] = data.toString("utf8");
      }
    }

    start = next;
  }

  return { values, files };
}

async function readJsonBody(req) {
  const body = await readRequestBody(req);
  if (!body.length) return {};
  return JSON.parse(body.toString("utf8"));
}

function inferMediaType(fileName, contentType) {
  const lowerName = String(fileName || "").toLowerCase();
  if (String(contentType || "").startsWith("image/") || /\.(jpg|jpeg|png|webp|gif)$/.test(lowerName)) return "image";
  if (String(contentType || "").startsWith("video/") || /\.(mp4|mov|m4v|webm)$/.test(lowerName)) return "video";
  return "unsupported";
}

function validateUrl(raw) {
  const value = String(raw || "").trim();
  const parsed = new URL(value);
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Salespage link mesti URL http/https.");
  return parsed.toString();
}

function cleanText(value) {
  return String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#039;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function pickMatch(html, regex) {
  const match = String(html || "").match(regex);
  return cleanText(match?.[1] || "");
}

async function fetchSalespageContext(salespageLink) {
  try {
    const response = await fetch(salespageLink, {
      headers: {
        "user-agent": "PostPilot/1.0 (+https://post-pilot-taupe.vercel.app)",
        accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const html = await response.text();
    const title = pickMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
    const description = pickMatch(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i)
      || pickMatch(html, /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["'][^>]*>/i);
    const ogTitle = pickMatch(html, /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["'][^>]*>/i);
    const headings = [...html.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)]
      .map((match) => cleanText(match[1]))
      .filter(Boolean)
      .slice(0, 8);
    const bodySnippet = cleanText(html).slice(0, 700);

    return {
      ok: true,
      productName: ogTitle || title || "produk ini",
      title,
      description,
      headings,
      bodySnippet,
    };
  } catch (error) {
    return {
      ok: false,
      productName: "produk ini",
      error: error?.message || String(error),
    };
  }
}

function summarizeContext(context) {
  const parts = [
    context.description,
    ...(context.headings || []),
    context.bodySnippet,
  ].filter(Boolean);
  return parts.join(" ").slice(0, 900);
}

function variationStyle(variation) {
  const styles = [
    {
      label: "story",
      hookPrefix: "Kadang-kadang kita nampak satu creative dan terus rasa, \"ini macam situasi aku.\"",
      bodyLead: "Bila saya tengok salespage ini, mesej utamanya jelas:",
    },
    {
      label: "problem",
      hookPrefix: "Masalah yang ditunjuk dalam creative ini bukan kecil kalau ia sedang berlaku dalam hidup atau bisnes kau.",
      bodyLead: "Salespage ini membawa satu mesej penting:",
    },
    {
      label: "curiosity",
      hookPrefix: "Sebelum scroll laju, tengok dulu kenapa creative ini dikaitkan dengan solusi di salespage.",
      bodyLead: "Daripada salespage, antara perkara yang menonjol ialah:",
    },
    {
      label: "direct",
      hookPrefix: "Kalau kau memang sedang cari solusi yang praktikal, ini salespage yang patut dibaca.",
      bodyLead: "Berdasarkan salespage, produk ini fokus kepada:",
    },
  ];
  return styles[Math.abs(Number(variation || 0)) % styles.length];
}

function generateCopy({ salespageLink, creativeAngle, mediaType, salespageContext, variation = 0 }) {
  const productName = salespageContext.productName || "produk ini";
  const productContext = summarizeContext(salespageContext);
  const angle = String(creativeAngle || "").trim();
  const style = variationStyle(variation);
  const mediaLine = mediaType === "video"
    ? "Video ini jadi pintu masuk untuk faham isu dan solusi yang ditawarkan."
    : "Poster ini jadi pintu masuk untuk faham isu dan solusi yang ditawarkan.";
  const angleLine = angle ? `\n\nAngle creative: ${angle}` : "";

  const caption = `${style.hookPrefix}

${mediaLine}

${style.bodyLead} ${productContext || `ia menerangkan tentang ${productName} dan masalah yang produk ini cuba selesaikan.`}

Kalau mesej dalam creative ini sama dengan situasi kau sekarang, jangan buat keputusan hanya dari poster atau video. Baca salespage dulu, tengok tawaran, faham siapa ia sesuai bantu, kemudian baru decide.

${productName} mungkin relevan kalau kau sedang cari solusi yang lebih jelas dan tersusun.${angleLine}

Salespage:
${salespageLink}`;

  const commentCta = variation % 2 === 0
    ? `Detail penuh ${productName} ada di salespage ini: ${salespageLink}`
    : `Kalau nak faham tawaran ${productName}, baca salespage sini dulu: ${salespageLink}`;

  return {
    caption,
    comment_cta: commentCta,
    variation,
    style: style.label,
  };
}

function fileToPreviewMedia(file) {
  const mediaType = inferMediaType(file.filename, file.contentType);
  if (mediaType === "unsupported") {
    throw new Error("Format tidak disokong. Guna image atau video mp4/mov/webm.");
  }

  return {
    filename: file.filename || "creative",
    contentType: file.contentType || "application/octet-stream",
    mediaType,
  };
}

async function buildPreview({ file, salespageLink, creativeAngle, customCaption, firstComment, variation = 0 }) {
  const safeSalespageLink = validateUrl(salespageLink);
  const media = fileToPreviewMedia(file);
  const salespageContext = await fetchSalespageContext(safeSalespageLink);
  const generated = generateCopy({
    salespageLink: safeSalespageLink,
    creativeAngle,
    mediaType: media.mediaType,
    salespageContext,
    variation,
  });

  const preview = {
    created_at: new Date().toISOString(),
    salespage_link: safeSalespageLink,
    creative_angle: String(creativeAngle || ""),
    media,
    salespage_context: {
      ok: salespageContext.ok,
      productName: salespageContext.productName,
      title: salespageContext.title,
      description: salespageContext.description,
      headings: salespageContext.headings,
      bodySnippet: salespageContext.bodySnippet,
      error: salespageContext.error,
    },
    caption: String(customCaption || "").trim() || generated.caption,
    comment_cta: String(firstComment || "").trim() || generated.comment_cta,
    variation,
    style: generated.style,
  };

  return { preview };
}

function regeneratePreview({ salespageLink, creativeAngle, mediaType, salespageContext, variation = 0 }) {
  const nextVariation = Number(variation || 0) + 1;
  const generated = generateCopy({
    salespageLink,
    creativeAngle,
    mediaType,
    salespageContext,
    variation: nextVariation,
  });

  return {
    created_at: new Date().toISOString(),
    caption: generated.caption,
    comment_cta: generated.comment_cta,
    variation: nextVariation,
    style: generated.style,
  };
}

function requireFacebookEnv() {
  const pageId = process.env.FACEBOOK_PAGE_ID;
  const pageAccessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;

  if (!pageId || !pageAccessToken) {
    throw new Error("Vercel env belum lengkap. Set FACEBOOK_PAGE_ID dan FACEBOOK_PAGE_ACCESS_TOKEN.");
  }

  return { pageId, pageAccessToken };
}

async function graphJson(url, formData) {
  const response = await fetch(url, {
    method: "POST",
    body: formData,
  });
  const json = await response.json();
  if (!response.ok || json.error) {
    throw new Error(json.error?.message || `Facebook Graph error: HTTP ${response.status}`);
  }
  return json;
}

async function fetchPermalink(postId, pageAccessToken) {
  if (!postId) return "";
  const url = new URL(`https://graph.facebook.com/v21.0/${postId}`);
  url.searchParams.set("fields", "id,permalink_url");
  url.searchParams.set("access_token", pageAccessToken);
  const response = await fetch(url);
  const json = await response.json();
  return json.permalink_url || "";
}

async function publishToFacebook({ file, caption, firstComment }) {
  const { pageId, pageAccessToken } = requireFacebookEnv();
  const mediaType = inferMediaType(file.filename, file.contentType);
  if (mediaType === "unsupported") {
    throw new Error("Format tidak disokong. Guna image atau video mp4/mov/webm.");
  }

  const form = new FormData();
  form.append("access_token", pageAccessToken);
  form.append("published", "true");
  form.append("source", new Blob([file.data], { type: file.contentType }), file.filename || "creative");

  let mediaResponse;
  if (mediaType === "video") {
    form.append("description", caption);
    mediaResponse = await graphJson(`https://graph.facebook.com/v21.0/${pageId}/videos`, form);
  } else {
    form.append("caption", caption);
    mediaResponse = await graphJson(`https://graph.facebook.com/v21.0/${pageId}/photos`, form);
  }

  const postId = mediaResponse.post_id || mediaResponse.id || "";
  let commentResponse = null;
  if (firstComment && postId) {
    const commentForm = new FormData();
    commentForm.append("access_token", pageAccessToken);
    commentForm.append("message", firstComment);
    commentResponse = await graphJson(`https://graph.facebook.com/v21.0/${postId}/comments`, commentForm);
  }

  return {
    media_type: mediaType,
    post_id: postId,
    permalink_url: await fetchPermalink(postId, pageAccessToken),
    comment_id: commentResponse?.id || "",
    media_response: mediaResponse,
    comment_response: commentResponse,
  };
}

module.exports = {
  buildPreview,
  parseMultipart,
  publishToFacebook,
  readJsonBody,
  readRequestBody,
  regeneratePreview,
};
