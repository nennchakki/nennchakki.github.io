// headless Chrome を DevTools Protocol で動かし、端末の幅を指定してスクリーンショットを撮り、
// 横方向のはみ出し（数式の横スクロール枠を除く）と画像の読み込み失敗を調べる。
//   node tools/browser-check.mjs [--shots] [--base http://127.0.0.1:8765] [パス…]
// パスを省くと dist/ の全 HTML を調べる。

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const args = process.argv.slice(2);
const shots = args.includes('--shots');
const bi = args.indexOf('--base');
const BASE = bi >= 0 ? args[bi + 1] : 'http://127.0.0.1:8765';
let paths = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--base');
if (!paths.length) {
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : e.name === 'index.html' ? [path.join(d, e.name)] : []));
  paths = walk(path.join(ROOT, 'dist')).map((f) => '/' + path.relative(path.join(ROOT, 'dist'), path.dirname(f)).split(path.sep).join('/') + '/').map((p) => p.replace('//', '/'));
}
const DEVICES = [
  { name: 'pc', width: 1440, height: 1000, mobile: false, scale: 1 },
  { name: 'sp', width: 390, height: 844, mobile: true, scale: 2 },
];

const port = 9300 + Math.floor(Math.random() * 500);
const prof = path.join(ROOT, '.tmp', 'chrome-cdp');
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars', `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, 'about:blank'], { stdio: 'ignore' });

async function getWs() {
  for (let i = 0; i < 50; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/list`);
      const list = await r.json();
      const p = list.find((x) => x.type === 'page');
      if (p) return p.webSocketDebuggerUrl;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('Chrome に接続できない');
}

const ws = new WebSocket(await getWs());
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let id = 0;
const pending = new Map();
const listeners = [];
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    const { res, rej } = pending.get(m.id);
    pending.delete(m.id);
    m.error ? rej(new Error(m.error.message)) : res(m.result);
  } else if (m.method) listeners.forEach((f) => f(m));
});
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
const waitEvent = (name) => new Promise((r) => { const f = (m) => { if (m.method === name) { listeners.splice(listeners.indexOf(f), 1); r(m); } }; listeners.push(f); });

await send('Page.enable');
await send('Runtime.enable');
await send('Network.enable');
const failed = [];
listeners.push((m) => {
  if (m.method === 'Network.loadingFailed' && !m.params.canceled) failed.push(m.params);
  if (m.method === 'Network.responseReceived' && m.params.response.status >= 400) failed.push({ url: m.params.response.url, status: m.params.response.status });
});

const problems = [];
const outDir = path.join(ROOT, 'docs', 'screenshots');
if (shots) fs.mkdirSync(outDir, { recursive: true });
for (const dev of DEVICES) {
  await send('Emulation.setDeviceMetricsOverride', { width: dev.width, height: dev.height, deviceScaleFactor: dev.scale, mobile: dev.mobile });
  for (const p of paths) {
    failed.length = 0;
    const loaded = waitEvent('Page.loadEventFired');
    await send('Page.navigate', { url: BASE + p });
    await loaded;
    await send('Runtime.evaluate', { expression: 'document.fonts.ready.then(()=>1)', awaitPromise: true });
    const r = await send('Runtime.evaluate', {
      returnByValue: true,
      expression: `(() => {
        const vw = document.documentElement.clientWidth;
        const over = [];
        for (const el of document.querySelectorAll('body *')) {
          if (el.closest('.math-display, .table-wrap, svg, .hero, .home-halo, .visually-hidden, .katex-mathml')) continue;
          const b = el.getBoundingClientRect();
          if (b.width && (b.right > vw + 1 || b.left < -1)) over.push(el.tagName.toLowerCase() + '.' + el.className + ' ' + Math.round(b.left) + '..' + Math.round(b.right));
        }
        const scrollList = [...document.querySelectorAll('.math-display')].filter((e) => e.scrollWidth > e.clientWidth + 4);
        const scrollers = scrollList.length;
        const scrollDetail = scrollList.slice(0, 3).map((e) => {
          const r = e.getBoundingClientRect();
          let worst = null;
          for (const c of e.querySelectorAll('*')) { const b = c.getBoundingClientRect(); if (!worst || b.right > worst[1]) worst = [c.className, b.right]; }
          return [e.scrollWidth, e.clientWidth, Math.round(r.right), worst && worst[0], worst && Math.round(worst[1]), e.textContent.slice(0, 30)];
        });
        const brokenImg = [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && !i.closest('.img-failed')).map((i) => i.src);
        return { vw, docW: document.documentElement.scrollWidth, over: over.slice(0, 5), overCount: over.length, scrollers, scrollDetail, brokenImg, title: document.title };
      })()`,
    });
    const v = r.result.value;
    const line = `${dev.name} ${p} 幅 ${v.vw} 文書幅 ${v.docW} はみ出し ${v.overCount} 横スクロールする数式 ${v.scrollers}`;
    if (v.docW > v.vw || v.overCount || v.brokenImg.length || failed.length) {
      problems.push({ device: dev.name, path: p, ...v, failed: failed.slice() });
      console.log('NG ' + line, v.over, v.brokenImg, failed.map((f) => f.url ?? f.errorText));
    } else console.log('ok ' + line, process.env.DETAIL ? JSON.stringify(v.scrollDetail) : '');
    if (shots) {
      const name = (p === '/' ? 'home' : p.replace(/^\/|\/$/g, '').replace(/\//g, '_')) + `-${dev.name}`;
      const s = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      fs.writeFileSync(path.join(outDir, name + '.png'), Buffer.from(s.data, 'base64'));
    }
  }
}
ws.close();
chrome.kill();
fs.mkdirSync(path.join(ROOT, '.tmp'), { recursive: true });
fs.writeFileSync(path.join(ROOT, '.tmp', 'browser-check.json'), JSON.stringify(problems, null, 2));
console.log(problems.length ? `問題 ${problems.length} 件` : '問題なし');
process.exit(problems.length ? 1 : 0);
