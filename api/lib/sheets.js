/**
 * Append quote rows to Google Sheets via service account (Sheets API v4).
 *
 * Env (set in Vercel / .env — never commit secrets):
 *   GOOGLE_SHEETS_SPREADSHEET_ID   (required to enable)
 *   GOOGLE_SERVICE_ACCOUNT_JSON    (full credentials JSON string) OR
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY
 *   GOOGLE_SHEETS_RANGE            (optional, default Sheet1!A:H)
 */

const crypto = require("crypto");

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";

function b64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function loadCredentials() {
  const rawJson = (process.env.GOOGLE_SERVICE_ACCOUNT_JSON || "").trim();
  if (rawJson) {
    try {
      const parsed = JSON.parse(rawJson);
      const email = String(parsed.client_email || "").trim();
      const key = String(parsed.private_key || "").replace(/\\n/g, "\n").trim();
      if (email && key) return { email, key };
    } catch {
      console.error("[sheets] GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON");
    }
  }

  const email = (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "").trim();
  const key = (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n").trim();
  if (email && key) return { email, key };
  return null;
}

async function getAccessToken(creds) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(
    JSON.stringify({
      iss: creds.email,
      scope: SHEETS_SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    })
  );
  const unsigned = `${header}.${claim}`;
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const signature = signer
    .sign(creds.key)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  const jwt = `${unsigned}.${signature}`;

  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: jwt,
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Google token error ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  if (!data.access_token) {
    throw new Error("Google token response missing access_token");
  }
  return data.access_token;
}

/**
 * Append one quote row. Never throws to callers — logs and returns { ok, skipped?, error? }.
 * Does nothing (ok + skipped) when spreadsheet ID or credentials are missing.
 */
async function appendQuoteRow(fields) {
  const spreadsheetId = (process.env.GOOGLE_SHEETS_SPREADSHEET_ID || "").trim();
  if (!spreadsheetId) {
    return { ok: true, skipped: true, reason: "GOOGLE_SHEETS_SPREADSHEET_ID not set" };
  }

  const creds = loadCredentials();
  if (!creds) {
    return { ok: true, skipped: true, reason: "Google service account credentials not set" };
  }

  const range = (process.env.GOOGLE_SHEETS_RANGE || "Sheet1!A:H").trim();
  const files = Array.isArray(fields.files) ? fields.files : [];
  const fileLinks = files
    .map((f) => f.url || f.name || "")
    .filter(Boolean)
    .join(" | ");
  const phone = String(fields.phone || fields.whatsapp || "").trim();
  const pageSource = String(fields.pageSource || fields.source || "").trim();

  const row = [
    fields.timestamp || new Date().toISOString(),
    fields.name || "",
    fields.email || "",
    phone,
    fields.message || "",
    fileLinks,
    pageSource,
    "manualvectortracing.com",
  ];

  try {
    const token = await getAccessToken(creds);
    const url =
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}` +
      `/values/${encodeURIComponent(range)}:append` +
      `?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ values: [row] }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`[sheets] append failed ${res.status}: ${text.slice(0, 300)}`);
      return { ok: false, error: `Sheets HTTP ${res.status}` };
    }

    return { ok: true };
  } catch (err) {
    console.error("[sheets] append error:", err && err.message ? err.message : err);
    return { ok: false, error: String(err && err.message ? err.message : err) };
  }
}

module.exports = {
  appendQuoteRow,
  loadCredentials,
};
