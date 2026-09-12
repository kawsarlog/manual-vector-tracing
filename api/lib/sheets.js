/**
 * Append quote rows to Google Sheets via service account (Sheets API v4).
 * Credentials: api/_sheets-secrets.js (TEMP hardcoded — move to env later).
 *
 * Layout (row 1 = headers, new submits append below):
 *   A Timestamp | B Name | C Email | D Phone | E Message
 *   F–J File 1–5 | K Page
 */

const crypto = require("crypto");
const {
  SPREADSHEET_ID,
  SHEETS_RANGE,
  CLIENT_EMAIL,
  PRIVATE_KEY,
} = require("../_sheets-secrets");

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";

const HEADERS = [
  "Timestamp",
  "Name",
  "Email",
  "Phone",
  "Message",
  "File 1",
  "File 2",
  "File 3",
  "File 4",
  "File 5",
  "Page",
];

const FILE_COLS = 5;

function b64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function loadCredentials() {
  const email = String(CLIENT_EMAIL || "").trim();
  const key = String(PRIVATE_KEY || "").replace(/\\n/g, "\n").trim();
  if (email && key) return { email, key };
  return null;
}

function parseSheetTitle(range) {
  const raw = String(range || "Sheet1!A:K").trim();
  const bang = raw.indexOf("!");
  if (bang === -1) return raw || "Sheet1";
  return raw.slice(0, bang).trim() || "Sheet1";
}

function headersMatch(row) {
  if (!Array.isArray(row) || !row.length) return false;
  return String(row[0] || "").trim() === HEADERS[0];
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

async function sheetsFetch(token, url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  return res;
}

async function getSheetId(token, spreadsheetId, sheetTitle) {
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}` +
    `?fields=sheets.properties`;
  const res = await sheetsFetch(token, url);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Sheets meta ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  const sheets = Array.isArray(data.sheets) ? data.sheets : [];
  const match = sheets.find(
    (s) => s.properties && String(s.properties.title) === sheetTitle
  );
  if (!match || match.properties == null || match.properties.sheetId == null) {
    throw new Error(`Sheet tab not found: ${sheetTitle}`);
  }
  return match.properties.sheetId;
}

/**
 * Ensure row 1 is the header row. Never overwrites an existing header row.
 * If row 1 has non-header data, inserts a blank row above then writes headers.
 */
async function ensureHeaders(token, spreadsheetId, sheetTitle) {
  const headerRange = `${sheetTitle}!A1:K1`;
  const getUrl =
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}` +
    `/values/${encodeURIComponent(headerRange)}`;

  const getRes = await sheetsFetch(token, getUrl);
  if (!getRes.ok) {
    const text = await getRes.text().catch(() => "");
    throw new Error(`Sheets read headers ${getRes.status}: ${text.slice(0, 200)}`);
  }

  const existing = await getRes.json();
  const row1 = (existing.values && existing.values[0]) || [];
  if (headersMatch(row1)) return { wrote: false };

  const hasContent = row1.some((c) => String(c || "").trim());
  if (hasContent) {
    const sheetId = await getSheetId(token, spreadsheetId, sheetTitle);
    const batchUrl =
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}:batchUpdate`;
    const batchRes = await sheetsFetch(token, batchUrl, {
      method: "POST",
      body: JSON.stringify({
        requests: [
          {
            insertDimension: {
              range: {
                sheetId,
                dimension: "ROWS",
                startIndex: 0,
                endIndex: 1,
              },
              inheritFromBefore: false,
            },
          },
        ],
      }),
    });
    if (!batchRes.ok) {
      const text = await batchRes.text().catch(() => "");
      throw new Error(`Sheets insert header row ${batchRes.status}: ${text.slice(0, 200)}`);
    }
  }

  const putUrl =
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}` +
    `/values/${encodeURIComponent(headerRange)}?valueInputOption=USER_ENTERED`;
  const putRes = await sheetsFetch(token, putUrl, {
    method: "PUT",
    body: JSON.stringify({ values: [HEADERS] }),
  });
  if (!putRes.ok) {
    const text = await putRes.text().catch(() => "");
    throw new Error(`Sheets write headers ${putRes.status}: ${text.slice(0, 200)}`);
  }

  return { wrote: true };
}

function buildRow(fields) {
  const files = Array.isArray(fields.files) ? fields.files : [];
  const fileUrls = [];
  for (let i = 0; i < FILE_COLS; i++) {
    const f = files[i];
    fileUrls.push(f && (f.url || f.name) ? String(f.url || f.name) : "");
  }
  const phone = String(fields.phone || fields.whatsapp || "").trim();
  const pageSource = String(fields.pageSource || fields.source || "").trim();

  return [
    fields.timestamp || new Date().toISOString(),
    fields.name || "",
    fields.email || "",
    phone,
    fields.message || "",
    ...fileUrls,
    pageSource,
  ];
}

/**
 * Append one quote row. Never throws to callers — logs and returns { ok, skipped?, error? }.
 * Does nothing (ok + skipped) when spreadsheet ID or credentials are missing.
 */
async function appendQuoteRow(fields) {
  const spreadsheetId = String(SPREADSHEET_ID || "").trim();
  if (!spreadsheetId) {
    return { ok: true, skipped: true, reason: "SPREADSHEET_ID not set" };
  }

  const creds = loadCredentials();
  if (!creds) {
    return { ok: true, skipped: true, reason: "Google service account credentials not set" };
  }

  const range = String(SHEETS_RANGE || "Sheet1!A:K").trim();
  const sheetTitle = parseSheetTitle(range);
  const appendRange = `${sheetTitle}!A:K`;
  const row = buildRow(fields);

  try {
    const token = await getAccessToken(creds);
    await ensureHeaders(token, spreadsheetId, sheetTitle);

    const url =
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}` +
      `/values/${encodeURIComponent(appendRange)}:append` +
      `?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

    const res = await sheetsFetch(token, url, {
      method: "POST",
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
  ensureHeaders,
  loadCredentials,
  HEADERS,
};
