const { readJsonBody } = require("../../lib/postpilot");
const { finishJob } = require("../../lib/postpilot-remote");
const { reportOperationalFailure } = require("../../lib/operations-events");
const { extensionDevice, handleError, json } = require("../postpilot-remote/_shared");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { ok: false, error: "Method not allowed." });
  try {
    const device = await extensionDevice(req);
    const body = await readJsonBody(req);
    const job = await finishJob(device, { jobId: body.job_id, status: "failed", error: body.error, progress: body.progress });
    await reportOperationalFailure({
      fingerprint: `postpilot-job:${job.id}`,
      serviceName: "mac_extension",
      entityType: "automation_job",
      entityId: job.id,
      title: "Post Pilot automation gagal",
      detail: body.error || job.error || "Chrome Mac tidak dapat melengkapkan job.",
      action: { kind: "automation", label: "Retry", operation: "retry", jobId: job.id, tab: "personalpostpilot", subtab: "postpilot-auto-panel" },
      metadata: { progress: body.progress || {}, jobType: job.type || "" },
    });
    json(res, 200, { ok: true, job });
  } catch (error) {
    handleError(res, error);
  }
};
