/**
 * Permanent download entrypoint for quote uploads.
 * Email links point here forever; each click redirects to a fresh short-lived R2 URL.
 *
 * GET /api/download?key=quotes/YYYY/MM/uuid-filename.ext
 */

const { isR2Configured, isValidQuoteKey, createDownloadUrl } = require("./lib/r2");

function getKeyFromReq(req) {
  if (req.query && (req.query.key || req.query.k)) {
    return String(req.query.key || req.query.k).trim();
  }
  try {
    const host = req.headers && (req.headers.host || "localhost");
    const url = new URL(req.url || "/", `http://${host}`);
    return String(url.searchParams.get("key") || url.searchParams.get("k") || "").trim();
  } catch {
    return "";
  }
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    res.status(405).json({ status: "error", message: "Method not allowed." });
    return;
  }

  if (!isR2Configured()) {
    res.status(500).json({ status: "error", message: "File storage is not configured." });
    return;
  }

  const key = getKeyFromReq(req);

  if (!key || !isValidQuoteKey(key)) {
    res.status(400).json({ status: "error", message: "Invalid or missing file key." });
    return;
  }

  try {
    /* Short hop only — the /api/download link itself never expires. */
    const signed = await createDownloadUrl(key, { expiresIn: 5 * 60 });
    res.setHeader("Location", signed.url);
    res.status(302).end();
  } catch (err) {
    console.error("[download]", err && err.message ? err.message : err);
    res.status(404).json({ status: "error", message: "File not found or unavailable." });
  }
};
