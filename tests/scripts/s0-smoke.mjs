// Smoke: does the editor page load, render UI, and screenshot?
export default async ({ nav, viewport, ev, shot, events }) => {
  await viewport(1440, 900);
  await nav("http://localhost:5173/", { settle: 4000 });
  const info = await ev(`
    const q = (s) => document.querySelector(s);
    return {
      title: document.title,
      hasApp: !!q('.app'),
      tabs: [...document.querySelectorAll('.tab')].map(b => b.textContent),
      mediaCount: document.querySelectorAll('.media-item').length,
      mediaNames: [...document.querySelectorAll('.fname')].map(e => e.textContent),
      hasPlayer: !!q('.player'),
      topbar: q('.topbar') ? q('.topbar').innerText.replace(/\\n/g,' | ') : null,
      bodySize: [document.body.getBoundingClientRect().width, document.body.getBoundingClientRect().height],
      rootChildren: q('#root') ? q('#root').children.length : 0,
    };
  `);
  console.log(JSON.stringify(info, null, 2));
  console.log("shot:", await shot("00-initial-load.png"));
  console.log("EVENTS:", JSON.stringify(events, null, 2));
};
