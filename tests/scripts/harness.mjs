// Minimal Chrome DevTools Protocol harness for QA of the browser video editor.
// No external deps: Node 24 has global fetch + WebSocket.
//
// Usage:  node tests/scripts/harness.mjs tests/scripts/<scenario>.mjs
// The scenario module default-exports an async function given the API below.
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import path from "node:path";

const PORT = Number(process.env.QA_CDP_PORT || 9333);
const DOWNLOADS = resolve("tests/tmp/downloads");
const SHOTS = resolve("tests/tmp/shots");
const CHROME = process.env.QA_CHROME || "/usr/bin/google-chrome";

const get = async (p) => (await fetch(`http://127.0.0.1:${PORT}${p}`)).json();

export const chromeUp = async () => {
  try {
    await get("/json/version");
    return true;
  } catch {
    return false;
  }
};

export const launchChrome = () => {
  const userDataDir = mkdtempSync(join(tmpdir(), "qa-chrome-"));
  mkdirSync(DOWNLOADS, { recursive: true });
  mkdirSync(SHOTS, { recursive: true });
  const args = [
    "--headless=new",
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${userDataDir}`,
    "--window-size=1440,900",
    // Real playback without a trusted gesture, audio NOT muted.
    "--autoplay-policy=no-user-gesture-required",
    "--hide-scrollbars",
    "about:blank",
  ];
  const child = spawn(CHROME, args, { stdio: "ignore", detached: true });
  child.unref();
  return child.pid;
};

class Conn {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.handlers = [];
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id !== undefined) {
        const p = this.pending.get(m.id);
        this.pending.delete(m.id);
        if (p) {
          if (m.error) {
            p.reject(new Error(`CDP ${m.error.code}: ${m.error.message}`));
          } else {
            p.resolve(m.result);
          }
        }
      } else if (m.method) {
        for (const h of this.handlers) {
          h(m);
        }
      }
    };
  }

  cmd(method, params = {}, sessionId) {
    const id = ++this.id;
    const msg = { id, method, params };
    if (sessionId) {
      msg.sessionId = sessionId;
    }
    this.ws.send(JSON.stringify(msg));
    return new Promise((res, rej) => {
      this.pending.set(id, { resolve: res, reject: rej });
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          rej(new Error(`CDP timeout after 180s: ${method}`));
        }
      }, 180000);
    });
  }
}

const connect = async () => {
  const v = await get("/json/version");
  const ws = new WebSocket(v.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.onopen = res;
    ws.onerror = rej;
  });
  return new Conn(ws);
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Build the API object handed to a scenario. */
export const withPage = async (fn) => {
  mkdirSync(DOWNLOADS, { recursive: true });
  mkdirSync(SHOTS, { recursive: true });
  const conn = await connect();
  const { targetId } = await conn.cmd("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await conn.cmd("Target.attachToTarget", {
    targetId,
    flatten: true,
  });
  const c = (m, p) => conn.cmd(m, p, sessionId);

  // ---- capture console / exceptions / network failures ----
  const events = [];
  const reqUrl = new Map();
  conn.handlers.push((m) => {
    if (m.sessionId !== sessionId) {
      return;
    }
    if (m.method === "Runtime.consoleAPICalled") {
      const text = (m.params.args || [])
        .map((a) => a.value ?? a.description ?? a.type)
        .join(" ");
      events.push({ kind: `console.${m.params.type}`, text });
    } else if (m.method === "Runtime.exceptionThrown") {
      const d = m.params.exceptionDetails;
      events.push({
        kind: "pageerror",
        text: d?.exception?.description || d?.text || "uncaught",
      });
    } else if (m.method === "Log.entryAdded") {
      const e = m.params.entry;
      events.push({ kind: `log.${e.level}`, text: `${e.source}: ${e.text}` });
    } else if (m.method === "Network.requestWillBeSent") {
      reqUrl.set(m.params.requestId, m.params.request.url);
    } else if (m.method === "Network.responseReceived") {
      const r = m.params.response;
      if (r.status >= 400) {
        events.push({ kind: "network", text: `${r.status} ${r.url}` });
      }
    } else if (m.method === "Network.loadingFailed") {
      const u = reqUrl.get(m.params.requestId) || "?";
      // Aborted media/stream fetches are normal browser behaviour on seek.
      events.push({
        kind: m.params.canceled ? "network.cancelled" : "network.failed",
        text: `${m.params.type} ${u} :: ${m.params.errorText}`,
      });
    }
  });

  await c("Runtime.enable");
  await c("Page.enable");
  await c("DOM.enable");
  await c("Log.enable");
  await c("Network.enable");
  // Capture blob/anchor downloads to disk instead of opening a viewer.
  await conn.cmd("Browser.setDownloadBehavior", {
    behavior: "allow",
    downloadPath: DOWNLOADS,
    eventsEnabled: true,
  });

  const api = {
    events,
    downloads: DOWNLOADS,
    shots: SHOTS,
    sleep,

    async nav(url, { settle = 2500 } = {}) {
      await c("Page.navigate", { url });
      await sleep(settle);
    },

    async viewport(width = 1440, height = 900) {
      await c("Emulation.setDeviceMetricsOverride", {
        width,
        height,
        deviceScaleFactor: 1,
        mobile: false,
      });
    },

    /** Evaluate an expression (may be async) in the page. */
    async ev(expression) {
      const r = await c("Runtime.evaluate", {
        expression: `(async () => { ${expression} })()`,
        awaitPromise: true,
        returnByValue: true,
      });
      if (r.exceptionDetails) {
        throw new Error(
          `eval threw: ${r.exceptionDetails.exception?.description || r.exceptionDetails.text}`,
        );
      }
      return r.result.value;
    },

    /** Screenshot; returns the written file path. */
    async shot(name, { full = false } = {}) {
      const res = await c("Page.captureScreenshot", {
        format: "png",
        captureBeyondViewport: full,
      });
      const file = join(SHOTS, name);
      writeFileSync(file, Buffer.from(res.data, "base64"));
      const bytes = readFileSync(file).length;
      return `${file} (${bytes} bytes)`;
    },

    /** Point the first input[type=file] matching `css` at local file(s). */
    async setFiles(css, ...files) {
      const doc = await c("DOM.getDocument", { depth: -1 });
      const node = await c("DOM.querySelector", {
        nodeId: doc.root.nodeId,
        selector: css,
      });
      if (!node.nodeId) {
        throw new Error(`no element for ${css}`);
      }
      await c("DOM.setFileInputFiles", {
        nodeId: node.nodeId,
        files: files.map((f) => path.resolve(f)),
      });
      await sleep(1200);
    },

    /** Wait until predicate expression returns truthy. */
    async until(expr, timeoutMs = 30000, every = 500) {
      const t0 = Date.now();
      for (;;) {
        const v = await api.ev(`return (${expr}) ? true : false;`);
        if (v) {
          return true;
        }
        if (Date.now() - t0 > timeoutMs) {
          throw new Error(`timeout waiting for: ${expr}`);
        }
        await sleep(every);
      }
    },
  };

  try {
    await fn(api);
  } finally {
    await conn.cmd("Target.closeTarget", { targetId }).catch(() => {});
    conn.ws.close();
  }
};

if (process.argv[2] === "--launch") {
  if (await chromeUp()) {
    console.log("already up on port", PORT);
  } else {
    console.log("launched pid", launchChrome());
    for (let i = 0; i < 60; i++) {
      await sleep(250);
      if (await chromeUp()) {
        console.log("chrome ready on port", PORT);
        process.exit(0);
      }
    }
    console.error("chrome did not come up");
    process.exit(4);
  }
} else {
  const scenario = process.argv[2];
  if (!scenario) {
    console.error("usage: harness.mjs <scenario.mjs> | --launch");
    process.exit(2);
  }
  if (!(await chromeUp())) {
    console.error("chrome not up; first run: node tests/scripts/harness.mjs --launch");
    process.exit(3);
  }
  const mod = await import(resolve(scenario));
  const t0 = Date.now();
  await withPage(mod.default);
  console.log(`[harness] done in ${Date.now() - t0}ms`);
}
