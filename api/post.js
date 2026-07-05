const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_MB || 20) * 1024 * 1024;
const { requireAuth } = require("../lib/auth");

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

function generateCaption({ salespageLink, creativeAngle, mediaType, salespageContext }) {
  const productName = salespageContext.productName || "produk ini";
  const productContext = summarizeContext(salespageContext);
  const angle = String(creativeAngle || "").trim();
  const hook = mediaType === "video"
    ? `Kalau video ni kena dengan situasi kau, mungkin ini masa untuk tengok ${productName} dengan lebih serius.`
    : `Kalau poster ni buat kau berhenti scroll, mungkin ini tanda ${productName} memang relevan untuk kau.`;

  const angleLine = angle
    ? `\n\nAngle creative kali ini: ${angle}`
    : "";

  return `${hook}

Ini bukan sekadar promosi kosong. Saya tengok semula salespage dan mesej utamanya: ${productContext || `ia menerangkan tentang ${productName} dan masalah yang produk ini cuba selesaikan.`}

Benda penting di sini ialah match antara masalah yang orang sedang rasa dengan solusi yang ditawarkan. Kalau kau sedang cari jalan untuk selesaikan masalah itu, salespage ini memang patut dibaca dulu sebelum buat keputusan.

${productName} boleh jadi langkah seterusnya kalau mesej dalam creative ini sama dengan situasi kau sekarang.${angleLine}

Tengok detail dekat salespage:
${salespageLink}`;
}

function generateFirstComment(salespageLink, salespageContext) {
  const productName = salespageContext.productName || "produk ini";
  return `Nak tengok detail ${productName}? Boleh buka salespage sini: ${salespageLink}`;
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

module.exports = async function handler(req, res) {
  res.setHeader("content-type", "application/json; charset=utf-8");

  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end(JSON.stringify({ ok: false, error: "Method not allowed." }));
    return;
  }

  try {
    requireAuth(req);
    const body = await readRequestBody(req);
    const { values, files } = parseMultipart(req, body);
    const creative = files.creative;
    if (!creative || !creative.data.length) throw new Error("Creative file wajib diupload.");

    const salespageLink = validateUrl(values.salespage_link);
    const mediaType = inferMediaType(creative.filename, creative.contentType);
    const salespageContext = await fetchSalespageContext(salespageLink);
    const caption = String(values.custom_caption || "").trim()
      || generateCaption({
        salespageLink,
        creativeAngle: values.caption_note,
        mediaType,
        salespageContext,
      });
    const firstComment = String(values.first_comment || "").trim()
      || generateFirstComment(salespageLink, salespageContext);

    const result = await publishToFacebook({
      file: creative,
      caption,
      firstComment,
    });

    res.statusCode = 200;
    res.end(JSON.stringify({
      ok: true,
      salespage_context: {
        ok: salespageContext.ok,
        product_name: salespageContext.productName,
        error: salespageContext.error,
      },
      ...result,
    }));
  } catch (error) {
    res.statusCode = error.statusCode || 400;
    res.end(JSON.stringify({ ok: false, error: error?.message || String(error) }));
  }
};
