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

function generateCaption({ salespageLink, note, mediaType }) {
  const hook = mediaType === "video"
    ? "Kalau video ni terasa macam situasi bisnes sendiri, itu tanda funnel perlu disemak."
    : "Kalau poster ni buat kau terfikir pasal iklan sendiri, itu tanda funnel perlu disemak.";

  const noteLine = note ? `\n\nNota penting: ${String(note).trim()}` : "";

  return `${hook}

Ramai owner bisnes sangka masalah utama ialah iklan tidak cukup laju. Tapi selalunya duit ads bocor sebab flow selepas orang nampak iklan tidak jelas.

Leads masuk, orang tanya harga, follow up dibuat, tapi sales masih perlahan. Di situlah strategi funnel, content, WhatsApp follow up dan setup ads kena nampak sebagai satu sistem.

Ads Funnel Mastery bantu kau faham cara susun TikTok Ads dan funnel supaya bajet ads tidak sekadar jalan tanpa arah.${noteLine}

Nak tengok salespage:
${salespageLink}`;
}

function generateFirstComment(salespageLink) {
  return `Nak belajar susun TikTok Ads + funnel dengan lebih jelas? Boleh tengok sini: ${salespageLink}`;
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
    const body = await readRequestBody(req);
    const { values, files } = parseMultipart(req, body);
    const creative = files.creative;
    if (!creative || !creative.data.length) throw new Error("Creative file wajib diupload.");

    const salespageLink = validateUrl(values.salespage_link);
    const mediaType = inferMediaType(creative.filename, creative.contentType);
    const caption = String(values.custom_caption || "").trim()
      || generateCaption({ salespageLink, note: values.caption_note, mediaType });
    const firstComment = String(values.first_comment || "").trim() || generateFirstComment(salespageLink);

    const result = await publishToFacebook({
      file: creative,
      caption,
      firstComment,
    });

    res.statusCode = 200;
    res.end(JSON.stringify({ ok: true, ...result }));
  } catch (error) {
    res.statusCode = 400;
    res.end(JSON.stringify({ ok: false, error: error?.message || String(error) }));
  }
};
