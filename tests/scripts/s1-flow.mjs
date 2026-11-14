// Criterion D + priority items: full UI flow with real clicks and real PLAYBACK.
// Flow: add test.mp4 -> trim 2..8 -> add text -> import public/sample.srt
//       -> add sample-audio.m4a -> press Play -> verify frame advance + pixels + DOM.
export default async ({ nav, viewport, ev, shot, setFiles, sleep, until, events }) => {
  const out = {};
  await viewport(1440, 900);
  await nav("http://localhost:5173/", { settle: 2500 });
  await ev(`localStorage.clear(); return true;`);
  await nav("http://localhost:5173/", { settle: 3500 });
  await until("document.querySelectorAll('.media-item').length > 0", 25000);
  out.startState = await ev(`
    return {
      stored: localStorage.getItem('rd-video-editor-project-v1'),
      clips: document.querySelectorAll('.seg.video').length,
      header: document.querySelector('.topbar .muted').textContent,
    };
  `);
  console.log("startState", JSON.stringify(out.startState));

  // ---- shared in-page helpers -------------------------------------------
  await ev(`
    window.__qa = {
      clickText(sel, txt) {
        const el = [...document.querySelectorAll(sel)].find(
          (e) => e.textContent.trim() === txt
        );
        if (!el) throw new Error("no element " + sel + " text=" + txt);
        el.click();
        return txt;
      },
      clickContains(sel, txt) {
        const el = [...document.querySelectorAll(sel)].find(
          (e) => e.textContent.includes(txt)
        );
        if (!el) throw new Error("no element " + sel + " contains=" + txt);
        el.click();
        return el.textContent.trim();
      },
      setRow(label, value) {
        const row = [...document.querySelectorAll('.row')].find(
          (r) => r.querySelector('.row-label') &&
                  r.querySelector('.row-label').textContent.trim() === label
        );
        if (!row) throw new Error("no row labelled: " + label);
        const input = row.querySelector('input');
        const proto = window.HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto, 'value').set.call(input, String(value));
        input.dispatchEvent(new Event('input', { bubbles: true }));
        return input.value;
      },
      setByTitle(sel, title, value) {
        const input = document.querySelector(sel + '[title="' + title + '"]');
        if (!input) throw new Error("no input title=" + title);
        const proto = window.HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto, 'value').set.call(input, String(value));
        input.dispatchEvent(new Event('input', { bubbles: true }));
        return input.value;
      },
      setArea(label, value) {
        const row = [...document.querySelectorAll('.row')].find(
          (r) => r.querySelector('.row-label') &&
                  r.querySelector('.row-label').textContent.trim() === label
        );
        const ta = row.querySelector('textarea');
        const proto = window.HTMLTextAreaElement.prototype;
        Object.getOwnPropertyDescriptor(proto, 'value').set.call(ta, value);
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        return ta.value;
      },
      head() {
        return {
          header: document.querySelector('.topbar .muted').textContent,
          tlHead: document.querySelector('.tl-head').innerText.replace(/\\n/g, ' | '),
        };
      },
      project() {
        const raw = localStorage.getItem('rd-video-editor-project-v1');
        return raw ? JSON.parse(raw) : null;
      },
    };
    return true;
  `);

  try {
    // ---- 1. add test.mp4 --------------------------------------------------
    out.addedVideo = await ev(`return window.__qa.clickContains('.media-item', 'test.mp4');`);
  await sleep(700);
  out.afterAdd = await ev(`return window.__qa.head();`);

  // ---- 2. trim 2 -> 8 ---------------------------------------------------
  out.trimIn = await ev(`return window.__qa.setRow('Trim in (s)', 2);`);
  await sleep(400);
  out.trimOut = await ev(`return window.__qa.setRow('Trim out (s)', 8);`);
  await sleep(700);
  out.afterTrim = await ev(`return window.__qa.head();`);
  out.clipRangeLabel = await ev(
    `return document.querySelector('.clip .muted').textContent;`,
  );

  // ---- 3. text overlay --------------------------------------------------
  out.addTab = await ev(`return window.__qa.clickText('.tab', 'Text');`);
  await sleep(300);
  out.addedText = await ev(`return window.__qa.clickText('.panel-head button', 'Add text');`);
  await sleep(400);
  out.textValue = await ev(`return window.__qa.setArea('Text', 'QA TEXT OVERLAY');`);
  await sleep(200);
  out.textStart = await ev(`return window.__qa.setRow('Start (s)', 3);`);
  await sleep(200);
  out.textDur = await ev(`return window.__qa.setRow('Duration (s)', 5);`);
  await sleep(200);
  out.textY = await ev(`return window.__qa.setRow('Y (%)', 12);`);
  await sleep(600);

  // ---- 4. import public/sample.srt -------------------------------------
  out.addTab2 = await ev(`return window.__qa.clickText('.tab', 'Captions');`);
  await sleep(300);
  await setFiles('input[accept=".srt,.vtt"]', "public/sample.srt");
  out.cueCount = await ev(
    `return document.querySelectorAll('.cue').length;`,
  );
  out.cues = await ev(`
    return [...document.querySelectorAll('.cue')].map((c) => ({
      text: c.querySelector('input[type=text]').value,
      start: c.querySelectorAll('input[type=number]')[0].value,
      end: c.querySelectorAll('input[type=number]')[1].value,
    }));
  `);
  out.captionPanelError = await ev(
    `const e = document.querySelector('.panel .error'); return e ? e.textContent : null;`,
  );
  await sleep(600);
  out.afterCaptions = await ev(`return window.__qa.head();`);

  // ---- 5. add audio -----------------------------------------------------
  out.addTab3 = await ev(`return window.__qa.clickText('.tab', 'Media');`);
  await until(
    `document.querySelectorAll('.media-item').length > 0`,
    25000,
  );
  await sleep(200);
  out.addedAudio = await ev(
    `return window.__qa.clickContains('.media-item', 'sample-audio.m4a');`,
  );
  await sleep(700);
  out.afterAudio = await ev(`return window.__qa.head();`);
  out.audioStart = await ev(`return window.__qa.setRow('Start (s)', 1);`);
  await sleep(700);
  out.afterAudioStart = await ev(`return window.__qa.head();`);

  // ---- state snapshot before playback -----------------------------------
  out.storedBeforePlay = await ev(`return window.__qa.project();`);

  // ---- 6. PRESS PLAY (not seek) ----------------------------------------
  const mediaBefore = await ev(`
    const v = [...document.querySelectorAll('video')].map(e => ({t: e.currentTime, paused: e.paused, rs: e.readyState}));
    const a = [...document.querySelectorAll('audio')].map(e => ({t: e.currentTime, paused: e.paused, rs: e.readyState}));
    const c = [...document.querySelectorAll('canvas')].map(e => ({w: e.width, h: e.height}));
    return {v, a, c, frames: document.querySelectorAll('iframe').length};
  `);
  out.mediaBefore = mediaBefore;

  await ev(`return window.__qa.clickText('.topbar .btns button', 'Play/Pause');`);
  await sleep(1000);
  out.playAt1s = await ev(`return window.__qa.head();`);
  await sleep(2000);
  out.playAt3s = await ev(`return window.__qa.head();`);

  const mediaDuring = await ev(`
    const v = [...document.querySelectorAll('video')].map(e => ({t: e.currentTime, paused: e.paused, rs: e.readyState, muted: e.muted, vol: e.volume}));
    const a = [...document.querySelectorAll('audio')].map(e => ({t: e.currentTime, paused: e.paused, rs: e.readyState, vol: e.volume}));
    return {v, a};
  `);
  out.mediaDuring = mediaDuring;

  // canvas pixel sampling - is anything actually drawn?
  out.canvasProbe = await ev(`
    const cs = [...document.querySelectorAll('canvas')];
    return cs.map((c) => {
      try {
        const g = document.createElement('canvas');
        g.width = Math.min(c.width || 640, 640);
        g.height = Math.min(c.height || 360, 360);
        const ctx = g.getContext('2d');
        ctx.drawImage(c, 0, 0, g.width, g.height);
        const d = ctx.getImageData(0, 0, g.width, g.height).data;
        let nonBlack = 0, n = 0;
        for (let i = 0; i < d.length; i += 4) {
          n++;
          if (d[i] > 12 || d[i + 1] > 12 || d[i + 2] > 12) nonBlack++;
        }
        return {w: c.width, h: c.height, sampled: n, nonBlack, ratio: +(nonBlack / n).toFixed(3)};
      } catch (e) {
        return {err: String(e && e.message)};
      }
    });
  `);

  out.overlayDom = await ev(`
    const txt = [...document.querySelectorAll('div')].filter(d => d.textContent === 'QA TEXT OVERLAY').length;
    const cap = [...document.querySelectorAll('div')].filter(d => d.textContent === 'Welcome to the browser video editor').length;
    return {qaTextNodes: txt, cueOneNodes: cap};
  `);

  out.shotPlaying = await shot("10-playing-3s.png");

  // pause again
  await ev(`return window.__qa.clickText('.topbar .btns button', 'Play/Pause');`);
  await sleep(500);
  out.pausedHead = await ev(`return window.__qa.head();`);

  // ---- timeline click-to-seek ------------------------------------------
  const tlBox = await ev(`
    const b = document.querySelector('.tl-track').getBoundingClientRect();
    return {left: b.left, width: b.width};
  `);
  out.tlBox = tlBox;
  } catch (e) {
    out.__aborted = String(e && e.message);
    out.__abortDom = await ev(`
      return {
        tabs: [...document.querySelectorAll('.tab')].map(b => b.textContent + (b.className.includes('active') ? '*' : '')),
        mediaItems: [...document.querySelectorAll('.media-item')].map(e => e.textContent.trim()),
        rootHtmlLen: document.getElementById('root').innerHTML.length,
        bodyText: document.body.innerText.slice(0, 500),
      };
    `).catch((e2) => String(e2));
  }

  console.log(JSON.stringify(out, null, 2));
  console.log("\nEVENTS:");
  for (const e of events) {
    if (e.kind === "pageerror" || e.kind === "network" || e.kind.startsWith("log.error")) {
      console.log(" ", e.kind, "|", e.text.slice(0, 300));
    }
  }
  console.log(" (total events:", events.length, ")");
};
