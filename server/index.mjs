// One process, one port (5173): node:http + Vite in middlewareMode + /api/*.
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { createReadStream, existsSync } from "node:fs";
import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer as createViteServer } from "vite";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC_DIR = path.join(ROOT, "public");
const OUT_DIR = path.join(ROOT, "out");
const TMP_DIR = path.join(os.tmpdir(), "remotion-editor-props");
const PORT = Number(process.env.PORT || 5173);

const VIDEO_EXT = new Set([".mp4", ".mov", ".webm", ".m4v", ".mkv", ".avi"]);
const AUDIO_EXT = new Set([".mp3", ".wav", ".aac", ".m4a", ".ogg", ".opus", ".flac"]);
const MIME = {
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".m4v": "video/x-m4v",
  ".mkv": "video/x-matroska",
  ".avi": "video/x-msvideo",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".aac": "audio/aac",
  ".m4a": "audio/mp4",
  ".ogg": "audio/ogg",
  ".opus": "audio/ogg",
  ".flac": "audio/flac",
};

// --- path safety -----------------------------------------------------------
// A request must never be able to escape public/ or out/.
const safeName = (raw, allowed) => {
  if (typeof raw !== "string") return null;
  const base = path.basename(raw.replace(/\\/g, "/"));
  if (!base || base === "." || base === "..") return null;
  if (!/^[A-Za-z0-9._\- ]+$/.test(base)) return null;
  const ext = path.extname(base).toLowerCase();
  return allowed.has(ext) ? base : null;
};

// ffprobe wrapper - never throws, returns nulls when unavailable.
const ffprobe = (full) =>
  new Promise((resolve) => {
    let out = "";
    let child;
    try {
      child = spawn(
        "ffprobe",
        [
          "-v", "error",
          "-show_entries", "stream=codec_type,width,height",
          "-show_entries", "format=duration",
          "-of", "json",
          full,
        ],
        { cwd: ROOT },
      );
    } catch {
      resolve(null);
      return;
    }
    child.stdout.on("data", (d) => {
      out += d.toString();
    });
    child.on("error", () => resolve(null));
    child.on("close", (code) => {
      if (code !== 0) {
        resolve(null);
        return;
      }
      try {
        const json = JSON.parse(out);
        const streams = json.streams || [];
        const v = streams.find((s) => s.codec_type === "video");
        const duration = Number(json?.format?.duration);
        resolve({
          durationSec: Number.isFinite(duration) ? duration : null,
          width: v?.width ?? null,
          height: v?.height ?? null,
          hasAudio: streams.some((s) => s.codec_type === "audio"),
        });
      } catch {
        resolve(null);
      }
    });
  });

const listMedia = async () => {
  const entries = await readdir(PUBLIC_DIR, { withFileTypes: true });
  const files = entries.filter((e) => e.isFile()).map((e) => e.name);
  const result = [];
  for (const name of files) {
    const ext = path.extname(name).toLowerCase();
    const kind = VIDEO_EXT.has(ext) ? "video" : AUDIO_EXT.has(ext) ? "audio" : null;
    if (!kind) continue;
    const info = await ffprobe(path.join(PUBLIC_DIR, name));
    result.push({ filename: name, kind, ...(info || {}) });
  }
  return result;
};

// --- render jobs -----------------------------------------------------------
/** @type {Map<string, object>} */
const jobs = new Map();

const startRender = async (project, outputName) => {
  const id = randomUUID();
  const job = {
    id,
    status: "queued",
    progress: 0,
    outputName,
    error: null,
    startedAt: Date.now(),
  };
  jobs.set(id, job);

  await mkdir(TMP_DIR, { recursive: true });
  await mkdir(OUT_DIR, { recursive: true });
  const propsFile = path.join(TMP_DIR, `${id}.json`);
  await writeFile(propsFile, JSON.stringify(project), "utf8");
  const outputRel = path.join("out", outputName);

  const args = [
    "remotion",
    "render",
    "src/index.ts",
    "Editor",
    outputRel,
    `--props=${propsFile}`,
    "--overwrite",
  ];
  job.status = "rendering";
  const child = spawn("npx", args, { cwd: ROOT });
  let tail = "";
  const remember = (chunk) => {
    tail = (tail + chunk.toString()).slice(-20000);
    const matches = [...tail.matchAll(/(\d+)\s*\/\s*(\d+)/g)];
    const last = matches[matches.length - 1];
    if (last) {
      const done = Number(last[1]);
      const total = Number(last[2]);
      if (total > 0) {
        job.progress = Math.min(0.999, done / total);
      }
    }
  };
  child.stdout.on("data", remember);
  child.stderr.on("data", remember);
  child.on("error", (err) => {
    job.status = "error";
    job.error = String(err?.message || err);
  });
  child.on("close", (code) => {
    const full = path.join(OUT_DIR, outputName);
    if (code === 0 && existsSync(full)) {
      job.status = "done";
      job.progress = 1;
      job.downloadUrl = `/api/out/${encodeURIComponent(outputName)}`;
    } else {
      job.status = "error";
      job.error =
        tail.trim() || `remotion render exited with code ${String(code)}`;
    }
  });
  return job;
};

// --- http ------------------------------------------------------------------
const readBody = (req, limitBytes) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > limitBytes) {
        reject(new Error("Payload too large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });

const json = (res, status, payload) => {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(body),
  });
  res.end(body);
};

const handleApi = async (req, res) => {
  const url = new URL(req.url || "/", `http://localhost:${PORT}`);
  const parts = url.pathname.split("/").filter(Boolean); // e.g. ["api","render",":id"]

  if (req.method === "GET" && url.pathname === "/api/media") {
    json(res, 200, { media: await listMedia() });
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/upload") {
    const name = safeName(url.searchParams.get("name") || "upload", new Set([...VIDEO_EXT, ...AUDIO_EXT]));
    if (!name) {
      json(res, 400, { error: "Invalid or unsupported upload filename" });
      return true;
    }
    const buf = await readBody(req, 1024 * 1024 * 1024);
    if (buf.length === 0) {
      json(res, 400, { error: "Empty upload" });
      return true;
    }
    await writeFile(path.join(PUBLIC_DIR, name), buf);
    const info = await ffprobe(path.join(PUBLIC_DIR, name));
    json(res, 200, { filename: name, kind: VIDEO_EXT.has(path.extname(name).toLowerCase()) ? "video" : "audio", ...info });
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/render") {
    let project;
    try {
      project = JSON.parse((await readBody(req, 8 * 1024 * 1024)).toString("utf8") || "{}");
    } catch (e) {
      json(res, 400, { error: `Invalid project JSON: ${String(e?.message || e)}` });
      return true;
    }
    const rawName = String(project?.__outputName || `${project?.__outputStamp || "edit"}.mp4`);
    delete project.__outputName;
    delete project.__outputStamp;
    const outputName = safeName(rawName, new Set([".mp4", ".webm"]));
    if (!outputName) {
      json(res, 400, { error: "Invalid output filename" });
      return true;
    }
    const job = await startRender(project, outputName);
    json(res, 200, { jobId: job.id, outputName });
    return true;
  }

  if (req.method === "GET" && parts[0] === "api" && parts[1] === "render" && parts[2]) {
    const job = jobs.get(parts[2]);
    if (!job) {
      json(res, 404, { error: "Unknown job" });
      return true;
    }
    json(res, 200, {
      id: job.id,
      status: job.status,
      progress: job.progress,
      outputName: job.outputName,
      error: job.error,
      downloadUrl: job.downloadUrl || null,
    });
    return true;
  }

  if (req.method === "GET" && parts[0] === "api" && parts[1] === "out" && parts[2]) {
    const name = safeName(decodeURIComponent(parts[2]), new Set([".mp4", ".webm"]));
    const full = name ? path.join(OUT_DIR, name) : null;
    if (!full || !existsSync(full)) {
      json(res, 404, { error: "File not found" });
      return true;
    }
    const { size } = await stat(full);
    res.writeHead(200, {
      "content-type": MIME[path.extname(name).toLowerCase()] || "application/octet-stream",
      "content-length": size,
      "content-disposition": `attachment; filename="${name}"`,
      "accept-ranges": "bytes",
    });
    createReadStream(full).pipe(res);
    return true;
  }

  return false;
};

const vite = await createViteServer({
  root: ROOT,
  configFile: path.join(ROOT, "vite.config.mts"),
  server: { middlewareMode: true, hmr: false },
  appType: "spa",
  logLevel: "info",
});

const server = createServer((req, res) => {
  handleApi(req, res)
    .then((handled) => {
      if (!handled) {
        vite.middlewares(req, res, () => {
          res.writeHead(404, { "content-type": "text/plain" });
          res.end("Not found");
        });
      }
    })
    .catch((err) => {
      json(res, 500, { error: String(err?.message || err) });
    });
});

server.listen(PORT, () => {
  console.log(`[editor] http://localhost:${PORT}`);
  console.log(`[editor] serving public/ from ${PUBLIC_DIR}`);
});
