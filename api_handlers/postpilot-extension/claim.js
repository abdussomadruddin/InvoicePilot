const { claimJob, heartbeatDevice, jobToPublic } = require("../../lib/postpilot-remote");
const { extensionDevice, handleError, json } = require("../postpilot-remote/_shared");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { ok: false, error: "Method not allowed." });
  try {
    const device = await extensionDevice(req);
    const job = await claimJob(device);
    if (!job) await heartbeatDevice(device);
    json(res, 200, { ok: true, job: job ? { ...jobToPublic(job), payload: job.payload } : null });
  } catch (error) {
    handleError(res, error);
  }
};
