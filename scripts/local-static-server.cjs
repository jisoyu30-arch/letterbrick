const http = require("http");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const port = Number(process.env.PORT || 8000);

const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".webmanifest": "application/manifest+json",
};

loadLocalEnv();

const server = http.createServer((req, res) => {
  const requestPath = decodeURIComponent((req.url || "/").split("?")[0]);
  if (requestPath.startsWith("/api/")) {
    handleApiRequest(requestPath, req, res);
    return;
  }

  const cleanPath = requestPath === "/" ? "/public/dev-showcase.html" : requestPath;
  const filePath = path.normalize(path.join(root, cleanPath));

  if (!filePath.startsWith(root)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, buffer) => {
    if (error) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }

    res.writeHead(200, {
      "Content-Type": mime[path.extname(filePath).toLowerCase()] || "application/octet-stream",
    });
    res.end(buffer);
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`LetterBrick local server: http://127.0.0.1:${port}`);
});

function loadLocalEnv() {
  const lockedKeys = new Set(Object.keys(process.env));
  [".env", ".env.production", ".env.local"].forEach((name) => {
    const filePath = path.join(root, name);
    if (!fs.existsSync(filePath)) return;
    const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      const eq = trimmed.indexOf("=");
      if (eq === -1) return;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (!key || lockedKeys.has(key)) return;
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    });
  });
}

async function handleApiRequest(requestPath, req, res) {
  const apiName = requestPath.replace(/^\/api\//, "").replace(/\/$/, "");
  if (!/^[a-z0-9_-]+$/i.test(apiName)) {
    sendJson(res, 404, { error: "API not found" });
    return;
  }

  const apiFile = path.join(root, "api", `${apiName}.js`);
  if (!apiFile.startsWith(path.join(root, "api")) || !fs.existsSync(apiFile)) {
    sendJson(res, 404, { error: "API not found" });
    return;
  }

  try {
    req.body = await readRequestBody(req);
    const handler = loadVercelHandler(apiFile);
    await handler(req, createVercelResponse(res));
  } catch (error) {
    console.error(`Local API error (${apiName}):`, error);
    if (!res.headersSent) sendJson(res, 500, { error: error.message || "Local API error", fallback: true });
  }
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("error", reject);
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) {
        resolve({});
        return;
      }
      const type = req.headers["content-type"] || "";
      if (type.includes("application/json")) {
        try {
          resolve(JSON.parse(raw));
        } catch (error) {
          reject(new Error(`Invalid JSON body: ${error.message}`));
        }
        return;
      }
      resolve(raw);
    });
  });
}

function loadVercelHandler(apiFile) {
  const source = fs.readFileSync(apiFile, "utf8").replace(/^export\s+default\s+/m, "");
  const sandbox = {
    console,
    fetch,
    process,
    setTimeout,
    clearTimeout,
    Buffer,
    URL,
    URLSearchParams,
  };
  const script = new vm.Script(`${source}\n;handler;`, { filename: apiFile });
  const handler = script.runInNewContext(sandbox, { timeout: 5000 });
  if (typeof handler !== "function") throw new Error(`No handler function exported by ${path.basename(apiFile)}`);
  return handler;
}

function createVercelResponse(res) {
  return {
    setHeader(name, value) {
      res.setHeader(name, value);
    },
    status(code) {
      res.statusCode = code;
      return this;
    },
    json(data) {
      if (!res.headersSent) res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify(data));
    },
    end(data) {
      res.end(data);
    },
  };
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}
