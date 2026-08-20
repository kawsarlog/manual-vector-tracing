/**
 * Manual Vector Tracing — quote/contact email via Brevo Transactional API.
 * Artwork files upload to Cloudflare R2; this handler emails download links.
 *
 * Vercel Environment Variables:
 *   BREVO_API_KEY           (required)
 *   RFQ_FROM_EMAIL          (optional)
 *   RFQ_FROM_NAME           (optional)
 *   R2_ACCOUNT_ID           (required for file links)
 *   R2_ACCESS_KEY_ID        (required for file links)
 *   R2_SECRET_ACCESS_KEY    (required for file links)
 *   R2_BUCKET_NAME          (optional, default manual-vector-tracing)
 *   SITE_URL                (optional, default https://manualvectortracing.com)
 *
 * Quote TO is hardcoded to info@manualvectortracing.com (RFQ_TO_EMAIL is ignored).
 */

const {
  isValidQuoteKey,
  buildPermanentDownloadUrl,
  MAX_FILES,
} = require("./lib/r2");

const BREVO_URL = "https://api.brevo.com/v3/smtp/email";

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function row(label, value) {
  const display = value && String(value).trim() ? escapeHtml(String(value).trim()) : "—";
  return `<tr><td style="padding:10px 0;border-bottom:1px solid #1f2937;"><span style="color:#9ca3af;font-size:12px;letter-spacing:0.04em;text-transform:uppercase;">${escapeHtml(label)}</span><br><strong style="color:#111827;font-size:15px;">${display}</strong></td></tr>`;
}

function formatBytes(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n < 0) return "";
  if (n < 1024) return `${Math.round(n)} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

/**
 * Normalize file metadata from the quote form (R2 object keys + optional urls).
 */
function normalizeFiles(data) {
  const out = [];
  const seen = new Set();

  const pushEntry = (entry) => {
    if (!entry || out.length >= MAX_FILES) return;
    let name = "";
    let size = null;
    let type = "";
    let key = "";
    let url = "";
    let note = "";
    if (typeof entry === "string") {
      name = entry.trim();
    } else if (typeof entry === "object") {
      name = String(entry.name || entry.fileName || "").trim();
      const rawSize = entry.size ?? entry.bytes;
      size = Number.isFinite(Number(rawSize)) ? Number(rawSize) : null;
      type = String(entry.type || "").trim();
      note = String(entry.note || "").trim();
      key = String(entry.key || "").trim();
      url = String(entry.url || entry.downloadUrl || "").trim();
    }
    if (!name) return;
    const dedupe = `${name.toLowerCase()}|${key || url}`;
    if (seen.has(dedupe)) return;
    seen.add(dedupe);

    if (key && !isValidQuoteKey(key)) {
      key = "";
      if (!note) note = "invalid upload key";
    }

    const item = { name, size, type };
    if (key) item.key = key;
    if (url) item.url = url;
    if (note) item.note = note;
    out.push(item);
  };

  if (Array.isArray(data.files) && data.files.length) {
    data.files.forEach(pushEntry);
  } else if (Array.isArray(data.fileNames) && data.fileNames.length) {
    data.fileNames.forEach(pushEntry);
  } else if (data.fileName) {
    String(data.fileName)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach(pushEntry);
  }

  return out.slice(0, MAX_FILES);
}

async function attachDownloadUrls(files) {
  if (!Array.isArray(files) || !files.length) return files;

  const out = [];
  for (const f of files) {
    const next = { ...f };
    if (f.key && isValidQuoteKey(f.key)) {
      /* Permanent site link — never expires; /api/download issues a fresh R2 hop on click. */
      next.url = buildPermanentDownloadUrl(f.key);
      if (!next.url && !next.note) next.note = "download link unavailable";
    }
    out.push(next);
  }
  return out;
}

function filesRowHtml(files) {
  if (!files.length) {
    return row("Selected files", "");
  }
  const list = files
    .map((f) => {
      const sizeLabel = formatBytes(f.size);
      const bits = [];
      if (f.url) {
        bits.push(
          `<a href="${escapeHtml(f.url)}" style="color:#159447;text-decoration:underline;">${escapeHtml(f.name)}</a>`
        );
      } else {
        bits.push(escapeHtml(f.name));
      }
      if (sizeLabel) bits.push(`(${escapeHtml(sizeLabel)})`);
      if (f.url) {
        bits.push("— download");
      } else if (f.note) {
        bits.push(`— ${escapeHtml(f.note)}`);
      }
      return `<li style="margin:0 0 4px;">${bits.join(" ")}</li>`;
    })
    .join("");
  return `<tr><td style="padding:10px 0;border-bottom:1px solid #1f2937;"><span style="color:#9ca3af;font-size:12px;letter-spacing:0.04em;text-transform:uppercase;">Selected files (${files.length})</span><br><ul style="margin:8px 0 0;padding-left:1.15rem;color:#111827;font-size:15px;font-weight:600;line-height:1.45;">${list}</ul></td></tr>`;
}

function buildHtml(payload) {
  const message = String(payload.message || "").trim();
  const messageHtml = escapeHtml(message).replace(/\n/g, "<br>");
  const stamped = escapeHtml(payload.timestamp || new Date().toISOString());
  const files = Array.isArray(payload.files) ? payload.files : [];
  const name = String(payload.name || "").trim();
  const linked = files.filter((f) => f.url).length;
  const messageBlock = message
    ? `<div style="margin-top:16px;padding:14px;border:1px solid #e5e7eb;background:#f9fafb;">
                  <div style="color:#159447;font-size:12px;letter-spacing:1px;text-transform:uppercase;font-weight:700;margin-bottom:8px;">Message / details</div>
                  <div style="color:#111827;font-size:14px;line-height:1.65;">${messageHtml}</div>
                </div>`
    : "";

  const linkNote =
    linked > 0
      ? `Artwork download links do not expire. Files are stored in Cloudflare R2 (not attached to this email).`
      : `Artwork files with download links appear here when the submitter uploaded files.`;

  return `
<html>
  <body style="margin:0;padding:0;background:#f3f4f6;font-family:Segoe UI,Arial,sans-serif;color:#111827;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:24px 12px;background:#f3f4f6;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #e5e7eb;">
            <tr>
              <td style="padding:20px 24px;background:#159447;border-bottom:4px solid #111827;">
                <div style="font-size:12px;letter-spacing:1.6px;text-transform:uppercase;color:#d1fae5;font-weight:700;">Manual Vector Tracing</div>
                <h2 style="margin:8px 0 0;font-size:22px;line-height:1.3;color:#ffffff;">New quote request</h2>
                <p style="margin:8px 0 0;font-size:13px;color:#ecfdf5;">Source: manualvectortracing.com — not RS Graphic Design</p>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 24px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                  ${row("Source website", "https://manualvectortracing.com")}
                  ${name ? row("Name", name) : ""}
                  ${row("Email", payload.email)}
                  ${filesRowHtml(files)}
                  ${row("Timestamp", stamped)}
                </table>
                ${messageBlock}
                <p style="margin:18px 0 0;font-size:12px;color:#6b7280;line-height:1.5;">
                  This message was sent from the Manual Vector Tracing contact/quote form.
                  Reply directly to the submitter (${escapeHtml(payload.email)}).
                  ${linkNote}
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`.trim();
}

async function sendViaBrevo(payload) {
  const apiKey = (process.env.BREVO_API_KEY || "").trim();
  if (!apiKey) {
    return { ok: false, message: "Brevo API key is not configured." };
  }

  const sender = (process.env.RFQ_FROM_EMAIL || "updates.from.kawsar@gmail.com").trim();
  const senderName = (process.env.RFQ_FROM_NAME || "Manual Vector Tracing").trim();
  const recipient = "info@manualvectortracing.com";
  const recipientName = "Manual Vector Tracing";
  const subjectName = payload.name || payload.email || "website visitor";
  const subject = `[Manual Vector Tracing] New quote request from ${subjectName}`;
  const linked = (payload.files || []).filter((f) => f.url).length;

  const body = {
    sender: { name: senderName, email: sender },
    to: [{ email: recipient, name: recipientName }],
    subject,
    replyTo: { email: payload.email, name: payload.name || payload.email },
    htmlContent: buildHtml(payload),
  };

  let response;
  try {
    response = await fetch(BREVO_URL, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, message: "Could not connect to Brevo API." };
  }

  if (response.ok) {
    return { ok: true, message: "", linked };
  }

  let detail = "";
  try {
    const data = await response.json();
    if (data && typeof data === "object") {
      detail = String(data.message || "").trim();
    }
  } catch {
    detail = "";
  }

  if (detail) {
    return { ok: false, message: `Brevo error ${response.status}: ${detail}` };
  }
  return { ok: false, message: `Brevo HTTP error ${response.status}.` };
}

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

  const data = typeof req.body === "object" && req.body ? req.body : {};
  let files = normalizeFiles(data);
  files = await attachDownloadUrls(files);
  const linkedCount = files.filter((f) => f.url).length;
  if (files.length) {
    console.log(
      `[contact] files=${files.length} linked=${linkedCount} names=${files.map((f) => f.name).join(", ")}`
    );
  }

  const fields = {
    name: String(data.name || "").trim(),
    email: String(data.email || "").trim(),
    message: String(data.message || data.details || "").trim(),
    files,
    fileNames: files.map((f) => f.name),
    fileName: files.map((f) => f.name).join(", "),
    timestamp: String(data.timestamp || new Date().toISOString()).trim(),
  };

  if (!fields.email) {
    res.status(400).json({ status: "error", message: "Email is required." });
    return;
  }

  if (!isValidEmail(fields.email)) {
    res.status(400).json({ status: "error", message: "Please enter a valid email address." });
    return;
  }

  const result = await sendViaBrevo(fields);
  if (!result.ok) {
    res.status(500).json({ status: "error", message: result.message || "Failed to send email." });
    return;
  }

  res.status(200).json({ status: "success", linked: result.linked || 0 });
};
