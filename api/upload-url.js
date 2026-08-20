/**
 * Issue a short-lived R2 presigned PUT URL for quote artwork uploads.
 *
 * POST JSON: { fileName, contentType, size }
 * → { status, uploadUrl, key }
 *
 * Vercel env: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME
 */

const { isR2Configured, createUploadUrl } = require("./lib/r2");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ status: "error", message: "Method not allowed." });
    return;
  }

  if (!isR2Configured()) {
    res.status(500).json({
      status: "error",
      message: "File upload storage is not configured.",
    });
    return;
  }

  const data = typeof req.body === "object" && req.body ? req.body : {};
  const fileName = String(data.fileName || data.name || "").trim();
  const contentType = String(data.contentType || data.type || "").trim();
  const size = Number(data.size);

  if (!fileName) {
    res.status(400).json({ status: "error", message: "fileName is required." });
    return;
  }

  try {
    const result = await createUploadUrl({ fileName, contentType, size });
    if (!result.ok) {
      res.status(400).json({ status: "error", message: result.message });
      return;
    }
    res.status(200).json({
      status: "success",
      uploadUrl: result.uploadUrl,
      key: result.key,
      expiresIn: result.expiresIn,
    });
  } catch (err) {
    console.error("[upload-url]", err && err.message ? err.message : err);
    res.status(500).json({ status: "error", message: "Could not create upload URL." });
  }
};
