const { readJsonBody } = require("../../lib/postpilot");
const { pairDevice } = require("../../lib/postpilot-remote");
const { handleError, json } = require("../postpilot-remote/_shared");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { ok: false, error: "Method not allowed." });
  try {
    const body = await readJsonBody(req);
    json(res, 200, { ok: true, ...(await pairDevice({ code: body.code, name: body.name })) });
  } catch (error) {
    handleError(res, error);
  }
};
