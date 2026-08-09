/**
 * Manual Vector Tracing — quote/contact email via Brevo Transactional API.
 * Same provider & pattern as RS Graphic Design (POST https://api.brevo.com/v3/smtp/email).
 *
 * Vercel Environment Variables:
 *   BREVO_API_KEY     (required) — Brevo dashboard → SMTP & API → API keys
 *   RFQ_TO_EMAIL      (optional) — inbox that receives quotes (default: hello@manualvectortracing.com)
 *   RFQ_TO_NAME       (optional) — default: Sales Team
 *   RFQ_FROM_EMAIL    (optional) — verified Brevo sender (default: noreply@manualvectortracing.com)
 *   RFQ_FROM_NAME     (optional) — default: Manual Vector Tracing
 */

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

function buildHtml(payload) {
  const messageHtml = escapeHtml(payload.message || "").replace(/\n/g, "<br>");
  const stamped = escapeHtml(payload.timestamp || new Date().toISOString());

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
                  ${row("Name", payload.name)}
                  ${row("Email", payload.email)}
                  ${row("Phone", payload.phone)}
                  ${row("Intended use", payload.use)}
                  ${row("Deadline", payload.deadline)}
                  ${row("Selected file", payload.fileName)}
                  ${row("Timestamp", stamped)}
                </table>
                <div style="margin-top:16px;padding:14px;border:1px solid #e5e7eb;background:#f9fafb;">
                  <div style="color:#159447;font-size:12px;letter-spacing:1px;text-transform:uppercase;font-weight:700;margin-bottom:8px;">Message / details</div>
                  <div style="color:#111827;font-size:14px;line-height:1.65;">${messageHtml || "—"}</div>
                </div>
                <p style="margin:18px 0 0;font-size:12px;color:#6b7280;line-height:1.5;">
                  This message was sent from the Manual Vector Tracing contact/quote form.
                  Reply directly to the submitter (${escapeHtml(payload.email)}).
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

  const sender = (process.env.RFQ_FROM_EMAIL || "noreply@manualvectortracing.com").trim();
  const recipient = (process.env.RFQ_TO_EMAIL || "hello@manualvectortracing.com").trim();
  const senderName = (process.env.RFQ_FROM_NAME || "Manual Vector Tracing").trim();
  const recipientName = (process.env.RFQ_TO_NAME || "Sales Team").trim();
  const subject = `[Manual Vector Tracing] New quote request from ${payload.name}`;

  const body = {
    sender: { name: senderName, email: sender },
    to: [{ email: recipient, name: recipientName }],
    subject,
    replyTo: { email: payload.email, name: payload.name },
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
    return { ok: true, message: "" };
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
  const fields = {
    name: String(data.name || "").trim(),
    email: String(data.email || "").trim(),
    phone: String(data.phone || "").trim(),
    use: String(data.use || "").trim(),
    deadline: String(data.deadline || "").trim(),
    message: String(data.message || data.details || "").trim(),
    fileName: String(data.fileName || "").trim(),
    timestamp: String(data.timestamp || new Date().toISOString()).trim(),
  };

  if (!fields.name || !fields.email) {
    res.status(400).json({ status: "error", message: "Name and email are required." });
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

  res.status(200).json({ status: "success" });
};
