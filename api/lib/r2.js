/**
 * Cloudflare R2 (S3-compatible) helpers for quote uploads.
 *
 * Env (Vercel + local .env):
 *   R2_ACCOUNT_ID
 *   R2_ACCESS_KEY_ID
 *   R2_SECRET_ACCESS_KEY
 *   R2_BUCKET_NAME   (default: manual-vector-tracing)
 *   SITE_URL         (optional — permanent download links in email; default https://manualvectortracing.com)
 */

const { S3Client, PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const crypto = require("crypto");

/** Max number of files per quote. */
const MAX_FILES = 5;
/** Max size per file and total across all files. */
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_TOTAL_BYTES = 25 * 1024 * 1024;
/** Short-lived R2 redirect only (used by /api/download). Permanent email links never expire. */
const REDIRECT_EXPIRES_DEFAULT = 5 * 60;

const ALLOWED_EXT = new Set([
  "jpg",
  "jpeg",
  "jfif",
  "png",
  "gif",
  "webp",
  "bmp",
  "tif",
  "tiff",
  "svg",
  "pdf",
  "ai",
  "eps",
  "psd",
  "heic",
  "heif",
  "avif",
  "ico",
]);

let cachedClient = null;

function getConfig() {
  const accountId = (process.env.R2_ACCOUNT_ID || "").trim();
  const accessKeyId = (process.env.R2_ACCESS_KEY_ID || "").trim();
  const secretAccessKey = (process.env.R2_SECRET_ACCESS_KEY || "").trim();
  const bucket = (process.env.R2_BUCKET_NAME || "manual-vector-tracing").trim();
  const siteUrl = (process.env.SITE_URL || "https://manualvectortracing.com").trim().replace(/\/$/, "");

  return { accountId, accessKeyId, secretAccessKey, bucket, siteUrl };
}

function isR2Configured() {
  const { accountId, accessKeyId, secretAccessKey, bucket } = getConfig();
  return Boolean(accountId && accessKeyId && secretAccessKey && bucket);
}

function getR2Client() {
  if (cachedClient) return cachedClient;
  const { accountId, accessKeyId, secretAccessKey } = getConfig();
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("R2 is not configured.");
  }
  cachedClient = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
  return cachedClient;
}

function fileExt(name) {
  const s = String(name || "").toLowerCase();
  const dot = s.lastIndexOf(".");
  return dot === -1 ? "" : s.slice(dot + 1);
}

function isAllowedUpload({ name, type, size }) {
  const ext = fileExt(name);
  const mime = String(type || "").toLowerCase();
  const bytes = Number(size);
  if (!Number.isFinite(bytes) || bytes <= 0 || bytes > MAX_FILE_BYTES) {
    return { ok: false, message: "Each file must be between 1 byte and 25 MB." };
  }
  if (ext && ALLOWED_EXT.has(ext)) return { ok: true };
  if (mime.startsWith("image/")) return { ok: true };
  if (mime === "application/pdf" || mime === "application/postscript") return { ok: true };
  return { ok: false, message: "File type not allowed." };
}

function sanitizeFileName(name) {
  const base = String(name || "file")
    .replace(/[/\\?%*:|"<>]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return base || "file";
}

function buildObjectKey(fileName) {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const id = crypto.randomUUID();
  const safe = sanitizeFileName(fileName);
  return `quotes/${y}/${m}/${id}-${safe}`;
}

/** Only keys created by this app (prevents arbitrary R2 object linking). */
function isValidQuoteKey(key) {
  return /^quotes\/\d{4}\/\d{2}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-.+/i.test(
    String(key || "")
  );
}

/** Permanent link for emails — never expires while the object exists in R2. */
function buildPermanentDownloadUrl(key) {
  if (!isValidQuoteKey(key)) return "";
  const { siteUrl } = getConfig();
  return `${siteUrl}/api/download?key=${encodeURIComponent(key)}`;
}

async function createUploadUrl({ fileName, contentType, size }) {
  const check = isAllowedUpload({ name: fileName, type: contentType, size });
  if (!check.ok) {
    return { ok: false, message: check.message };
  }

  const { bucket } = getConfig();
  const key = buildObjectKey(fileName);
  const type = String(contentType || "application/octet-stream").slice(0, 120);
  const client = getR2Client();
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: type,
  });
  const uploadUrl = await getSignedUrl(client, command, { expiresIn: 15 * 60 });
  return { ok: true, uploadUrl, key, bucket, expiresIn: 15 * 60 };
}

/**
 * Short-lived R2 GET URL (for /api/download redirect hop only).
 * @param {string} key
 * @param {{ expiresIn?: number }} [opts]
 */
async function createDownloadUrl(key, opts = {}) {
  if (!isValidQuoteKey(key)) {
    throw new Error("Invalid object key.");
  }
  const { bucket } = getConfig();
  const expiresIn =
    Number.isFinite(Number(opts.expiresIn)) && Number(opts.expiresIn) > 0
      ? Math.floor(Number(opts.expiresIn))
      : REDIRECT_EXPIRES_DEFAULT;

  const fileName = String(key).split("/").pop() || "download";
  const safeName = fileName.replace(/"/g, "");
  const client = getR2Client();
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
    ResponseContentDisposition: `attachment; filename="${safeName}"`,
  });
  const url = await getSignedUrl(client, command, { expiresIn });
  return { url, expiresIn };
}

module.exports = {
  MAX_FILES,
  MAX_FILE_BYTES,
  MAX_TOTAL_BYTES,
  isR2Configured,
  isAllowedUpload,
  isValidQuoteKey,
  buildPermanentDownloadUrl,
  createUploadUrl,
  createDownloadUrl,
  getConfig,
};
