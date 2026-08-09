/**
 * Local static + contact API server for mail testing.
 * Serves the site and mounts POST /api/contact using api/contact.js + .env.
 *
 *   node dev-server.js
 *   → http://127.0.0.1:8766/contact.html
 */
const http = require("http");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname);
const PORT = Number(process.env.PORT) || 8766;
const HOST = "127.0.0.1";

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
};

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env) || process.env[key] === "") {
      process.env[key] = value;
    }
  }
}

loadEnvFile(path.join(root, ".env.local"));
loadEnvFile(path.join(root, ".env"));

const contactHandler = require(path.join(root, "api", "contact.js"));

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function wrapRes(res) {
  let statusCode = 200;
  const headers = {};
  return {
    setHeader(name, value) {
      headers[name] = value;
      res.setHeader(name, value);
    },
    status(code) {
      statusCode = code;
      return {
        json(payload) {
          const body = JSON.stringify(payload);
          res.writeHead(statusCode, {
            ...headers,
            "Content-Type": "application/json; charset=utf-8",
            "Content-Length": Buffer.byteLength(body),
          });
          res.end(body);
        },
        end(payload) {
          if (payload == null) {
            res.writeHead(statusCode, headers);
            return res.end();
          }
          const body = typeof payload === "string" ? payload : String(payload);
          res.writeHead(statusCode, {
            ...headers,
            "Content-Type": headers["Content-Type"] || "text/plain; charset=utf-8",
          });
          res.end(body);
        },
      };
    },
  };
}

async function handleContact(req, res) {
  const wrapped = wrapRes(res);
  try {
    if (req.method === "POST" || req.method === "PUT" || req.method === "PATCH") {
      const raw = await readBody(req);
      const text = raw.toString("utf8");
      let body = {};
      if (text) {
        try {
          body = JSON.parse(text);
        } catch {
          wrapped.status(400).json({ status: "error", message: "Invalid JSON body." });
          return;
        }
      }
      req.body = body;
    } else {
      req.body = {};
    }
    await contactHandler(req, wrapped);
  } catch (err) {
    console.error("[dev-server] /api/contact error:", err);
    if (!res.headersSent) {
      wrapped.status(500).json({ status: "error", message: "Local API handler failed." });
    }
  }
}

function serveStatic(req, res) {
  let urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  if (urlPath === "/") urlPath = "/index.html";
  const file = path.normalize(path.join(root, urlPath.replace(/^\//, "")));
  if (!file.startsWith(root)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end("Not found");
    }
    res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream" });
    res.end(data);
  });
}

http
  .createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
    if (urlPath === "/api/contact") {
      handleContact(req, res);
      return;
    }
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405);
      return res.end("Method not allowed");
    }
    serveStatic(req, res);
  })
  .listen(PORT, HOST, () => {
    const from = process.env.RFQ_FROM_EMAIL || "updates.from.kawsar@gmail.com";
    const keyOk = Boolean((process.env.BREVO_API_KEY || "").trim());
    console.log(`ready http://${HOST}:${PORT}`);
    console.log(`contact http://${HOST}:${PORT}/contact.html`);
    console.log(`thanks  http://${HOST}:${PORT}/thanks.html`);
    console.log(`Brevo key: ${keyOk ? "loaded" : "MISSING"}`);
    console.log(`RFQ_TO: hello@rsgraphicdesign.com (hardcoded)`);
    console.log(`RFQ_FROM_EMAIL: ${from}`);
  });
