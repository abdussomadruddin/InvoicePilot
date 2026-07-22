const { downloadJobImage } = require("../../lib/postpilot-remote");
const { extensionDevice, handleError, json } = require("../postpilot-remote/_shared");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return json(res, 405, { ok: false, error: "Method not allowed." });
  try {
    const device = await extensionDevice(req);
    const url = new URL(req.url || "/", "http://localhost");
    const result = await downloadJobImage(device, { jobId: url.searchParams.get("job_id"), index: url.searchParams.get("index") });
    res.statusCode = 302;
    res.setHeader("location", result.url);
    res.setHeader("cache-control", "private, no-store");
    res.end();
  } catch (error) {
    handleError(res, error);
  }
};
