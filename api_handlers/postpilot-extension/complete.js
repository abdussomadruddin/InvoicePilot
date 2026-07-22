const { readJsonBody } = require("../../lib/postpilot");
const { finishJob } = require("../../lib/postpilot-remote");
const { reportOperationalSuccess } = require("../../lib/operations-events");
const { extensionDevice, handleError, json } = require("../postpilot-remote/_shared");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { ok: false, error: "Method not allowed." });
  try {
    const device = await extensionDevice(req);
    const body = await readJsonBody(req);
    const job = await finishJob(device, { jobId: body.job_id, status: body.status || "completed", progress: body.progress });
    await reportOperationalSuccess({
      fingerprint: `postpilot-job:${job.id}`,
      serviceName: "mac_extension",
      detail: "Chrome Mac online dan job terakhir selesai.",
      metadata: { jobId: job.id },
    });
    json(res, 200, { ok: true, job });
  } catch (error) {
    handleError(res, error);
  }
};
