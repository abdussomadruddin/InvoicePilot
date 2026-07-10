const { requireAuth } = require("../lib/auth");
const {
  deletePostPilotHookGalleryImage,
  downloadPostPilotHookGalleryImage,
  listPostPilotHookImages,
  uploadPostPilotHookGalleryImage,
} = require("../lib/supabase-db");
const { parseMultipart, readRequestBody } = require("../lib/postpilot");

module.exports = async function handler(req, res) {
  try {
    requireAuth(req);
    if (req.method === "GET") {
      const id = new URL(req.url || "/", "http://localhost").searchParams.get("id");
      if (id) {
        const { image, buffer, contentType } = await downloadPostPilotHookGalleryImage(id);
        res.statusCode = 200;
        res.setHeader("content-type", contentType);
        res.setHeader("content-length", String(buffer.length));
        res.setHeader("cache-control", "private, max-age=60");
        res.setHeader("content-disposition", `inline; filename="${image.name.replace(/"/g, "")}"`);
        res.end(buffer);
        return;
      }
      const images = await listPostPilotHookImages();
      res.statusCode = 200;
      res.setHeader("content-type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ ok: true, images }));
      return;
    }

    if (req.method === "POST") {
      const body = await readRequestBody(req);
      const { files } = parseMultipart(req, body);
      const image = await uploadPostPilotHookGalleryImage(files.hookImage);
      res.statusCode = 200;
      res.setHeader("content-type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ ok: true, image }));
      return;
    }

    if (req.method === "DELETE") {
      const id = new URL(req.url || "/", "http://localhost").searchParams.get("id");
      const image = await deletePostPilotHookGalleryImage(id);
      res.statusCode = 200;
      res.setHeader("content-type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ ok: true, image }));
      return;
    }

    res.statusCode = 405;
    res.end(JSON.stringify({ ok: false, error: "Method not allowed." }));
  } catch (error) {
    res.statusCode = error.statusCode || 400;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: false, error: error?.message || String(error) }));
  }
};
