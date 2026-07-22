const { readJsonBody } = require("../../lib/postpilot");
const { updateJobProgress } = require("../../lib/postpilot-remote");
const { extensionDevice, handleError, json } = require("../postpilot-remote/_shared");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { ok: false, error: "Method not allowed." });
  try {
    const device = await extensionDevice(req);
    const body = await readJsonBody(req);
    const result = await updateJobProgress(device, { jobId: body.job_id, progress: body.progress });
    json(res, 200, { ok: true, cancelRequested: result.cancelRequested, terminalStatus: result.terminalStatus || "" });
  } catch (error) {
    handleError(res, error);
  }
};
