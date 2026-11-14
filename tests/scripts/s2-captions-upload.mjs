// Priorities 1-3 + F + reload + layout measurement.
//  - import tests/fixtures/sample.vtt through the real file input
//  - click "Export .srt" and inspect the downloaded file
//  - upload tests/fixtures/qa-upload.mp4 through the real Upload button
//  - project JSON save -> load round-trip
//  - reload restores localStorage
//  - measure control geometry for layout defects
import { existsSync, readdirSync, readFileSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";

export default async ({ nav, viewport, ev, shot, setFiles, sleep, until, events, downloads }) => {
  const out = {};
  if (existsSync(downloads)) {
    rmSync(downloads, { recursive: true, force: true });
  }
  mkdirSync(downloads, { recursive: true });

  await viewport(1440, 900);
  await nav("http://localhost:5173/", { settle: 2000 });
  await ev(`localStorage.clear(); return true;`);
  await nav("http://localhost:5173/", { settle: 3000 });
  const HELPERS = `
    window.__qa = {
      clickText(sel, txt) {
        const el = [...document.querySelectorAll(sel)].find((e) => e.textContent.trim() === txt);
        if (!el) throw new Error("no " + sel + " text=" + txt);
        el.click();
        return txt;
      },
      clickContains(sel, txt) {
        const el = [...document.querySelectorAll(sel)].find((e) => e.textContent.includes(txt));
        if (!el) throw new Error("no " + sel + " contains=" + txt);
        el.click();
        return el.textContent.trim();
      },
      setRow(label, value) {
        const row = [...document.querySelectorAll('.row')].find(
          (r) => r.querySelector('.row-label') && r.querySelector('.row-label').textContent.trim() === label);
        if (!row) throw new Error("no row: " + label);
        const input = row.querySelector('input');
        const d = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
        d.set.call(input, String(value));
        input.dispatchEvent(new Event('input', { bubbles: true }));
        return input.value;
      },
      rect(sel) {
        const e = document.querySelector(sel);
        if (!e) return null;
        const r = e.getBoundingClientRect();
        return {x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1),
                right: +r.right.toFixed(1), bottom: +r.bottom.toFixed(1)};
      },
      project() {
        const raw = localStorage.getItem('rd-video-editor-project-v1');
        return raw ? JSON.parse(raw) : null;
      },
    };
  `;
  await ev(HELPERS);

  // ================= P1: .vtt import through the UI =================
  await ev(`return window.__qa.clickText('.tab', 'Captions');`);
  await sleep(300);
  await setFiles('input[accept=".srt,.vtt"]', "tests/fixtures/sample.vtt");
  out.vttCues = await ev(`
    return [...document.querySelectorAll('.cue')].map((c) => ({
      text: c.querySelector('input[type=text]').value,
      start: c.querySelectorAll('input[type=number]')[0].value,
      end: c.querySelectorAll('input[type=number]')[1].value,
    }));
  `);
  out.vttPanelError = await ev(`const e=document.querySelector('.panel .error'); return e?e.textContent:null;`);
  out.vttCaptionCountHeader = await ev(
    `return document.querySelector('.panel-head h2').textContent;`,
  );
  out.shotVtt = await shot("20-vtt-imported.png");

  // messy vtt: NOTE/STYLE/REGION blocks + settings after timestamp + hh:mm:ss
  await setFiles('input[accept=".srt,.vtt"]', "tests/fixtures/messy.vtt");
  out.messyVttCues = await ev(`
    return [...document.querySelectorAll('.cue')].map((c) => ({
      text: c.querySelector('input[type=text]').value,
      start: c.querySelectorAll('input[type=number]')[0].value,
      end: c.querySelectorAll('input[type=number]')[1].value,
    }));
  `);
  out.messyVttError = await ev(`const e=document.querySelector('.panel .error'); return e?e.textContent:null;`);

  // re-import the good one so the export test has known content
  await setFiles('input[accept=".srt,.vtt"]', "tests/fixtures/sample.vtt");
  await until(`document.querySelectorAll('.cue').length === 3`, 20000).catch(() => {});

  // ================= P2: click "Export .srt" ========================
  out.exportBtnDisabled = await ev(`
    const b = [...document.querySelectorAll('.panel-head button')].find(x => x.textContent.trim() === 'Export .srt');
    return b ? b.disabled : 'MISSING';
  `);
  await ev(`
    const b = [...document.querySelectorAll('.panel-head button')].find(x => x.textContent.trim() === 'Export .srt');
    b.click(); return true;
  `);
  await sleep(2000);
  out.downloadFiles = readdirSync(downloads);
  out.srtContent = {};
  for (const f of out.downloadFiles) {
    out.srtContent[f] = readFileSync(join(downloads, f), "utf8");
  }

  // ================= P3: upload via the UI button ===================
  await ev(`return window.__qa.clickText('.tab', 'Media');`);
  await until(`document.querySelectorAll('.media-item').length > 0`, 25000);
  out.mediaBeforeUpload = await ev(
    `return [...document.querySelectorAll('.fname')].map(e => e.textContent);`,
  );
  await setFiles('input[accept="video/*,audio/*"]', "tests/fixtures/qa-upload.mp4");
  await sleep(2500);
  out.mediaAfterUpload = await ev(
    `return [...document.querySelectorAll('.fname')].map(e => e.textContent);`,
  );
  out.uploadPanelError = await ev(
    `const e = document.querySelector('[aria-label="Media library"] .error'); return e ? e.textContent : null;`,
  );
  out.uploadOnServer = existsSync("public/qa-upload.mp4");
  out.shotUpload = await shot("21-after-upload.png");

  // add the uploaded clip to the timeline (proves it is renderable)
  out.addedUploaded = await ev(
    `return window.__qa.clickContains('.media-item', 'qa-upload.mp4');`,
  );
  await sleep(800);
  out.afterAddUploadedHeader = await ev(`return document.querySelector('.topbar .muted').textContent;`);

  // ================= layout measurements ============================
  out.layout = await ev(`
    const panel = document.querySelector('.left');
    const res = { leftPanel: window.__qa.rect('.left'), tabBody: window.__qa.rect('.tab-body') };
    res.rows = [...document.querySelectorAll('.row')].slice(0, 6).map((r) => {
      const lab = r.querySelector('.row-label');
      const inp = r.querySelector('input');
      return {
        label: lab ? lab.textContent.trim() : null,
        rowRight: +r.getBoundingClientRect().right.toFixed(1),
        inputRight: inp ? +inp.getBoundingClientRect().right.toFixed(1) : null,
        inputW: inp ? +inp.getBoundingClientRect().width.toFixed(1) : null,
        scrollW: r.scrollWidth, clientW: r.clientWidth,
      };
    });
    res.docScroll = {
      bodyScrollW: document.body.scrollWidth,
      bodyClientW: document.body.clientWidth,
      tabBodyScrollW: document.querySelector('.tab-body').scrollWidth,
      tabBodyClientW: document.querySelector('.tab-body').clientWidth,
    };
    return res;
  `);

  // ================= F: project JSON round-trip =====================
  out.projectBeforeExport = await ev(`return window.__qa.project();`);
  await ev(`return window.__qa.clickText('.tab', 'Output');`);
  await sleep(400);
  await ev(`
    const b = [...document.querySelectorAll('.btns button')].find(x => x.textContent.trim() === 'Save .json');
    b.click(); return true;
  `);
  await sleep(2000);
  out.jsonDownloads = readdirSync(downloads).filter((f) => f.endsWith(".json"));

  // wipe state, then load the saved json back
  try {
    await ev(`
      localStorage.clear();
      setTimeout(() => { location.href = '/'; }, 100);
      return 'navigating';
    `);
  } catch (e) {
    out.wipeNavNote = String(e.message).slice(0, 120);
  }
  await sleep(4000);
  await ev(HELPERS);
  out.afterWipeHeader = await ev(`return document.querySelector('.topbar .muted').textContent;`);
  out.afterWipeCues = await ev(`return document.querySelectorAll('.cue').length;`);
  const jsonFile = out.jsonDownloads[0];
  if (jsonFile) {
    await ev(`return window.__qa.clickText('.tab', 'Output');`);
    await sleep(300);
    await setFiles('input[accept=".json,application/json"]', join(downloads, jsonFile));
    await sleep(1500);
    out.importMsg = await ev(
      `const p = document.querySelector('[aria-label="Project file"] .muted + p, [aria-label="Project file"] .ok, [aria-label="Project file"] .error'); return p ? p.textContent : null;`,
    );
    out.projectAfterImport = await ev(`return window.__qa.project();`);
    out.roundTripEqual = await ev(`
      const a = ${JSON.stringify(JSON.stringify(out.projectBeforeExport))};
      const norm = (s) => { const p = JSON.parse(s); ['videoClips','audioClips','textOverlays','captions'].forEach(k => (p[k]||[]).forEach(i => delete i.id)); return JSON.stringify(p); };
      const b = JSON.stringify(window.__qa.project());
      return { sameIgnoringIds: norm(a) === norm(b), before: norm(a), after: norm(b) };
    `);
  }

  // ================= reload restores localStorage ===================
  await ev(`return window.__qa.clickText('.tab', 'Captions');`);
  await sleep(400);
  out.cuesBeforeReload = await ev(`return document.querySelectorAll('.cue').length;`);
  try {
    await ev(`setTimeout(() => location.reload(), 50); return 'reloading';`);
  } catch (e) {
    out.reloadNavNote = String(e.message).slice(0, 120);
  }
  await sleep(5000);
  await ev(HELPERS);
  out.afterReloadHeader = await ev(`return document.querySelector('.topbar .muted').textContent;`);
  out.afterReloadActiveTab = await ev(
    `const a = document.querySelector('.tab.active'); return a ? a.textContent : null;`,
  );
  out.afterReloadStoredRaw = await ev(
    `return localStorage.getItem('rd-video-editor-project-v1');`,
  );
  await ev(`return window.__qa.clickText('.tab', 'Captions');`);
  await sleep(400);
  out.afterReloadCues = await ev(`return document.querySelectorAll('.cue').length;`);
  out.afterReloadCueTexts = await ev(
    `return [...document.querySelectorAll('.cue input[type=text]')].map(i => i.value);`,
  );
  out.afterReloadVideoSegs = await ev(`return document.querySelectorAll('.seg.video').length;`);

  console.log(JSON.stringify(out, null, 2));
  console.log("\nEVENTS (errors only):");
  for (const e of events) {
    if (/error|failed|404|500/.test(e.kind + " " + e.text)) {
      console.log(" ", e.kind, "|", e.text.slice(0, 250));
    }
  }
};
