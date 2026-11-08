// サイトを dist/ に組み立てる。
//   node tools/build.mjs
// 入力: content/（作品の設定とスナップショット）、static/（CSS・画像など）
// 原稿ディレクトリは読まない。読むのはリポジトリの中のスナップショットだけ。

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import QRCode from 'qrcode';
import { convertAnswers } from './tex/convert.mjs';
import { verifyStructural } from './tex/preamble.mjs';
import { IrRenderer } from './site/render-ir.mjs';
import { page, siteHeader } from './site/layout.mjs';
import { html, raw, esc } from './site/html.mjs';
import { haloOblique, haloMark } from './site/art/noa-halo.mjs';
import { eyesWide, eyeTall } from './site/art/hiro-eye.mjs';
import { PERMANENT } from '../content/permanent-urls.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const DIST = path.join(ROOT, 'dist');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const readJson = (p) => JSON.parse(read(p));
const hash = (s) => createHash('sha256').update(s).digest('hex').slice(0, 10);

const site = readJson('content/site.json');
const assetHashes = new Map();
const assets = (p) => (assetHashes.has(p) ? `${p}?v=${assetHashes.get(p)}` : p);

function write(rel, content) {
  const p = path.join(DIST, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
}

function copyDir(src, dst) {
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name);
    const d = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(s, d);
    else {
      fs.mkdirSync(path.dirname(d), { recursive: true });
      fs.copyFileSync(s, d);
    }
  }
}

// ---------------- 準備 ----------------
fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });
copyDir(path.join(ROOT, 'static'), DIST);
// KaTeX の CSS とフォント（同じ版を node_modules から取る）
const katexDist = path.join(ROOT, 'node_modules/katex/dist');
copyDir(path.join(katexDist, 'fonts'), path.join(DIST, 'assets/katex/fonts'));
fs.copyFileSync(path.join(katexDist, 'katex.min.css'), path.join(DIST, 'assets/katex/katex.min.css'));
fs.copyFileSync(path.join(katexDist, 'contrib/copy-tex.min.js'), path.join(DIST, 'assets/katex/copy-tex.min.js'));
write('assets/favicon.svg', haloMark({ size: 64, cls: 'favicon' }));
for (const rel of ['/assets/css/base.css', '/assets/css/themes/noa.css', '/assets/css/themes/hiro.css', '/assets/css/answers.css', '/assets/katex/katex.min.css', '/assets/katex/copy-tex.min.js', '/assets/js/answers.js']) {
  assetHashes.set(rel, hash(fs.readFileSync(path.join(DIST, rel))));
}
write('.nojekyll', '');

// ---------------- 作品 ----------------
const works = fs
  .readdirSync(path.join(ROOT, 'content'), { withFileTypes: true })
  .filter((e) => e.isDirectory() && fs.existsSync(path.join(ROOT, 'content', e.name, 'work.json')))
  .map((e) => readJson(`content/${e.name}/work.json`))
  .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

const report = { pages: [], answers: {} };

// ---------------- 総合トップ ----------------
function workEntry(w) {
  const published = w.sections.filter((s) => s.status === 'published');
  return html`<li class="work-entry" data-theme-preview="${w.theme}">
<a class="work-link" href="/works/${w.slug}/">
<span class="work-circle">${w.circle}</span>
<span class="work-title">${w.titleLines ? raw(w.titleLines.map(esc).join('<br>')) : w.title}</span>
</a>
<p class="work-summary">${w.summary}</p>
<ul class="work-sections" aria-label="公開中の資料">
${published.map((s) => html`<li><a href="${s.href}">${s.label}</a></li>`)}
</ul>
</li>`;
}

function buildHome() {
  const body = html`${raw(siteHeader({ current: 'home' }))}
<main id="main" class="home">
<div class="home-halo">${raw(haloOblique({ id: 'home-halo' }))}</div>
<section class="home-intro" aria-labelledby="home-h">
<h1 id="home-h">nennchakki</h1>
<p>同人誌と原稿の資料置き場です。解答編・正誤表・補足資料を、作品ごとにまとめています。</p>
</section>
<section class="ledger" aria-labelledby="works-h">
<h2 id="works-h">作品一覧</h2>
<ol class="work-list">
${works.map(workEntry)}
</ol>
</section>
<section class="ledger" aria-labelledby="log-h">
<h2 id="log-h">更新記録</h2>
${updateLog()}
</section>
</main>`;
  write('index.html', page({ site, title: null, path: '/', theme: 'noa', css: ['/assets/css/themes/noa.css'], body, assets }));
  report.pages.push('/');
}

function updateLog() {
  const items = [];
  for (const w of works) for (const h of w.history ?? []) items.push({ ...h, work: w });
  items.sort((a, b) => (a.date < b.date ? 1 : -1));
  if (!items.length) return html`<p class="empty">まだ記録はありません。</p>`;
  return html`<ol class="log">${items.map((h) => html`<li><time datetime="${h.date}">${h.date}</time><span>${h.work.title}</span><span>${h.text}</span></li>`)}</ol>`;
}

// ---------------- 作品ページ ----------------
function sectionBlock(w, s, answersInfo) {
  if (s.status !== 'published') {
    return html`<section class="w-sec pending" aria-labelledby="sec-${s.id}"><h2 id="sec-${s.id}">${s.label}</h2><p class="pending-note">準備中</p></section>`;
  }
  if (s.kind === 'answers') {
    return html`<section class="w-sec" aria-labelledby="sec-${s.id}">
<h2 id="sec-${s.id}">${s.label}</h2>
<p>別冊解答の全 ${answersInfo.chapters.length} 章、${answersInfo.total} 問の解き方を、章ごとのページで読めます。数式は選択してコピーできます。</p>
<p><a class="go" href="${s.href}">解答編の目次を開く</a></p>
</section>`;
  }
  throw new Error(`資料の種類 ${s.kind} の表示は未実装`);
}

// ファーストビュー。work.json の hero で差し替えられる。
//   { "type": "svg-hiro-eyes" }  … 図形で描いた目元（既定）
//   { "type": "image", "alt": "...", "pc": {src,width,height}, "sp": {src,width,height} }
//     … 用意した画像。PC と SP で別の切り抜きを使う。画像が読めないときは図形の目元に戻る。
function heroBlock(w) {
  const h = w.hero ?? { type: 'svg-hiro-eyes' };
  const svg = raw(eyesWide() + eyeTall());
  if (h.type === 'svg-hiro-eyes') {
    return html`<div class="hero hiro-hero" role="img" aria-label="${h.alt ?? '篠澤広の目元を図形で描いた装飾。淡い色のまつ毛と、橙赤の瞳。'}">${svg}</div>`;
  }
  if (h.type === 'image') {
    return html`<div class="hero hiro-hero has-image">
<div class="hero-fallback" aria-hidden="true">${svg}</div>
<picture>
<source media="(max-width: 48rem) and (max-aspect-ratio: 4/5)" srcset="${h.sp.src}" width="${h.sp.width}" height="${h.sp.height}">
<img src="${h.pc.src}" width="${h.pc.width}" height="${h.pc.height}" alt="${h.alt}" decoding="async" onerror="this.closest('.hero').classList.add('img-failed')">
</picture>
</div>`;
  }
  throw new Error(`hero の種類 ${h.type} は未対応`);
}

function buildWork(w, answersInfo) {
  const cover = w.cover
    ? html`<img class="cover" src="${w.cover.src}" alt="${w.cover.alt}" width="${w.cover.width}" height="${w.cover.height}" onerror="this.hidden=true">`
    : '';
  const body = html`${raw(siteHeader({ current: 'work' }))}
<main id="main" class="work">
${heroBlock(w)}
<div class="work-inner">
<section class="work-head">
<p class="work-circle">${w.circle}</p>
<h1>${w.titleLines ? raw(w.titleLines.map(esc).join('<br>')) : w.title}</h1>
${cover}
<p class="work-summary">${w.summary}</p>
<dl class="work-meta">
<dt>頒布</dt><dd>${w.event ?? '未定'}</dd>
<dt>公開日</dt><dd>${w.releaseDate ?? '未定'}</dd>
<dt>固定URL</dt><dd><a href="${w.permanentEntry}">${site.baseUrl}${w.permanentEntry}</a></dd>
</dl>
</section>
<div class="w-secs">
${w.sections.map((s) => sectionBlock(w, s, answersInfo))}
<section class="w-sec" aria-labelledby="sec-history">
<h2 id="sec-history">改訂履歴</h2>
${(w.history ?? []).length ? html`<ol class="log">${w.history.map((h) => html`<li><time datetime="${h.date}">${h.date}</time><span>${h.text}</span></li>`)}</ol>` : html`<p class="pending-note">まだ記録はありません。</p>`}
</section>
</div>
</div>
</main>`;
  write(`works/${w.slug}/index.html`, page({
    site, title: w.title, description: w.summary, path: `/works/${w.slug}/`, theme: w.theme,
    css: [`/assets/css/themes/${w.theme}.css`], body, assets,
    breadcrumbs: [{ label: '作品一覧', href: '/' }, { label: w.title }],
  }));
  report.pages.push(`/works/${w.slug}/`);
}

// ---------------- 解答編 ----------------
function inlineText(list) {
  return (list ?? []).map((x) => (x.t === 'text' ? x.v : x.t === 'math' ? x.tex : x.c ? inlineText(x.c) : x.t === 'br' ? ' ' : '')).join('');
}

function buildAnswers(w) {
  const dir = `content/${w.slug}/answers`;
  const src = read(`${dir}/source/answers.tex`);
  const manifest = readJson(`${dir}/manifest.json`);
  const srcHash = createHash('sha256').update(src).digest('hex');
  if (srcHash !== manifest.source.sha256) throw new Error(`${dir}/source/answers.tex が manifest と一致しない。スナップショットを作り直す`);
  const expected = readJson(`${dir}/structural.json`);
  const doc = convertAnswers(src);
  const problems = verifyStructural(doc.structural, expected);
  if (problems.length) throw new Error('解答編の構造マクロが、変換器が想定している定義と違う:\n  ' + problems.join('\n  '));

  const figureSvgs = {};
  for (const f of doc.figures) figureSvgs[f.key] = read(`${dir}/figures/${f.key}.svg`);
  const figureAlts = readJson(`${dir}/figures.json`);
  const r = new IrRenderer({ macroSets: doc.macroSets, figures: doc.figures, figureAlts, figureSvgs });

  const base = `/works/${w.slug}/answers/`;
  const chapters = doc.chapters;
  const info = { chapters: [], total: 0 };
  const headStuff = `<link rel="stylesheet" href="${assets('/assets/katex/katex.min.css')}">
<link rel="stylesheet" href="${assets('/assets/css/answers.css')}">
<script defer src="${assets('/assets/katex/copy-tex.min.js')}"></script>
<script defer src="${assets('/assets/js/answers.js')}"></script>`;

  chapters.forEach((c, i) => {
    const probs = c.blocks.filter((b) => b.type === 'problem');
    info.chapters.push({ slug: c.slug, number: c.number, title: inlineText(c.tocTitle).replace(/　課題解答$/, ''), problems: probs.length, part: c.part });
    info.total += probs.length;
    const prev = chapters[i - 1];
    const next = chapters[i + 1];
    const chTitle = inlineText(c.title);
    const toc = buildChapterToc(c, probs, r);
    const pager = html`<nav class="pager" aria-label="章の移動">
${prev ? html`<a class="prev" rel="prev" href="${base}${prev.slug}/"><span>前の章</span>第${prev.number}章 ${inlineText(prev.tocTitle).replace(/　課題解答$/, '')}</a>` : html`<span class="prev none"></span>`}
<a class="up" href="${base}">解答編の目次</a>
${next ? html`<a class="next" rel="next" href="${base}${next.slug}/"><span>次の章</span>第${next.number}章 ${inlineText(next.tocTitle).replace(/　課題解答$/, '')}</a>` : html`<span class="next none"></span>`}
</nav>`;
    const content = r.blocks(c.blocks);
    const body = html`${raw(siteHeader({ current: 'answers' }))}
<div class="answers-top"><a href="/works/${w.slug}/">${w.title}</a><span aria-hidden="true">／</span><a href="${base}">解答編</a></div>
<main id="main" class="chapter">
<header class="chapter-head">
<p class="ch-no">第${c.number}章</p>
<h1>${raw(r.inline(c.title))}</h1>
<p class="ch-count">${probs.length} 問</p>
</header>
${toc}
<div class="answer-body">
${raw(content)}
</div>
${pager}
</main>`;
    write(`works/${w.slug}/answers/${c.slug}/index.html`, page({
      site, title: `第${c.number}章 ${chTitle}｜解答編｜${w.title}`, path: `${base}${c.slug}/`, theme: w.theme,
      css: [`/assets/css/themes/${w.theme}.css`], head: headStuff, body, assets,
      description: `『${w.title}』別冊解答 第${c.number}章「${chTitle}」の全${probs.length}問。`,
      breadcrumbs: [{ label: '作品一覧', href: '/' }, { label: w.title, href: `/works/${w.slug}/` }, { label: '解答編', href: base }, { label: `第${c.number}章` }],
    }));
    report.pages.push(`${base}${c.slug}/`);
  });

  // 目次ページ
  const front = r.blocks(doc.front);
  const partsHtml = doc.parts.map((p) => html`<section class="toc-part" aria-labelledby="part-${p.number}">
<h2 id="part-${p.number}"><span class="part-no">第${p.roman}部</span>${raw(r.inline(p.short ?? p.title).replace(/^課題解答　/, ''))}</h2>
<ol class="toc-chapters">
${info.chapters.filter((c) => c.part === p.number).map((c) => html`<li><a href="${base}${c.slug}/"><span class="tc-no">第${c.number}章</span><span class="tc-title">${c.title}</span><span class="tc-count">${c.problems}問</span></a></li>`)}
</ol>
</section>`);
  const body = html`${raw(siteHeader({ current: 'answers' }))}
<div class="answers-top"><a href="/works/${w.slug}/">${w.title}</a></div>
<main id="main" class="answers-index">
<header class="chapter-head">
<p class="ch-no">別冊解答</p>
<h1>解答編</h1>
<p class="ch-count">全 ${info.chapters.length} 章・${info.total} 問</p>
</header>
${partsHtml}
<details class="front-matter">
<summary>この別冊について・記号・略称</summary>
<div class="answer-body">${raw(front)}</div>
</details>
<p class="source-note">この解答編は、別冊解答の TeX 原稿から自動で生成しています（原稿の版: <code>${manifest.source.sha256.slice(0, 12)}</code>、${manifest.createdAt} 取り込み）。</p>
</main>`;
  write(`works/${w.slug}/answers/index.html`, page({
    site, title: `解答編｜${w.title}`, path: base, theme: w.theme,
    css: [`/assets/css/themes/${w.theme}.css`], head: headStuff, body, assets,
    description: `『${w.title}』別冊解答の目次。全${info.chapters.length}章・${info.total}問。`,
    breadcrumbs: [{ label: '作品一覧', href: '/' }, { label: w.title, href: `/works/${w.slug}/` }, { label: '解答編' }],
  }));
  report.pages.push(base);
  report.answers[w.slug] = { ...info, stats: r.stats, manifest: manifest.counts, labels: Object.keys(doc.labels).length };
  return info;
}

function buildChapterToc(c, probs, r) {
  // 節（subsection）ごとに問題を並べる
  const groups = [];
  let cur = null;
  for (const b of c.blocks) {
    if (b.type === 'heading' && b.level === 3) {
      cur = { heading: b, probs: [] };
      groups.push(cur);
    } else if (b.type === 'problem') {
      if (!cur) { cur = { heading: null, probs: [] }; groups.push(cur); }
      cur.probs.push(b);
    }
  }
  const items = groups.map((g) => {
    const head = g.heading ? `<a class="toc-sec" href="#s${esc(g.heading.number.replace('.', '-'))}"><span class="hnum">${esc(g.heading.number)}</span>${r.inline(g.heading.short ?? g.heading.title)}</a>` : '';
    const list = g.probs.map((p) => `<li><a href="#${esc(p.id)}"><span class="pnum">第${p.number}問</span>${esc(inlineText(p.title))}</a></li>`).join('');
    return `<li>${head}<ol class="toc-probs">${list}</ol></li>`;
  });
  return raw(`<nav class="chapter-toc" aria-label="この章の問題"><details open><summary>この章の問題（${probs.length}問）</summary><ol>${items.join('')}</ol></details></nav>`);
}

// ---------------- 固定URL ----------------
async function buildPermanent() {
  const qrInfo = [];
  for (const p of PERMANENT) {
    const w = works.find((x) => x.slug === p.work);
    if (!w) throw new Error(`固定URL ${p.path} の作品 ${p.work} がない`);
    const links = p.links.map((l) => html`<li><a href="${l.href}">${l.label}</a></li>`);
    const body = html`<main id="main" class="permanent">
<p class="perm-work">${w.title}</p>
<h1>資料の入口</h1>
<p>この頁は、本に印刷した QR コードの行き先です。ここから資料へ進んでください。</p>
<ul class="perm-links">${links}</ul>
<p class="perm-note">この頁の URL は変えません：<br><code>${site.baseUrl}${p.path}</code></p>
</main>`;
    write(`${p.path.replace(/^\//, '')}index.html`, page({
      site, title: `${w.title}（資料の入口）`, path: p.path, theme: 'permanent', body, assets,
      head: `<meta name="robots" content="noindex">`,
    }));
    report.pages.push(p.path);
    // QR コード
    const url = site.baseUrl + p.path;
    const svg = await QRCode.toString(url, { type: 'svg', errorCorrectionLevel: 'M', margin: 4 });
    const png = await QRCode.toBuffer(url, { type: 'png', errorCorrectionLevel: 'M', margin: 4, scale: 16 });
    const name = p.path.replace(/^\/q\//, '').replace(/\/$/, '');
    write(`q/${name}/qr.svg`, svg);
    write(`q/${name}/qr.png`, png);
    qrInfo.push({ path: p.path, url, files: [`/q/${name}/qr.svg`, `/q/${name}/qr.png`] });
  }
  report.qr = qrInfo;
}

// ---------------- 404 ----------------
function build404() {
  const body = html`${raw(siteHeader({ current: '' }))}
<main id="main" class="notfound">
<h1>この頁はありません</h1>
<p>URL が変わったか、まだ公開していない資料です。</p>
<ul>
<li><a href="/">作品一覧へ</a></li>
${works.map((w) => html`<li><a href="/works/${w.slug}/">${w.title}</a></li>`)}
</ul>
</main>`;
  write('404.html', page({ site, title: '頁が見つかりません', path: '/404.html', theme: 'noa', css: ['/assets/css/themes/noa.css'], body, assets }));
}

// ---------------- 実行 ----------------
const answersInfo = {};
for (const w of works) {
  if (w.sections.some((s) => s.kind === 'answers' && s.status === 'published')) answersInfo[w.slug] = buildAnswers(w);
}
buildHome();
for (const w of works) buildWork(w, answersInfo[w.slug]);
await buildPermanent();
build404();
fs.mkdirSync(path.join(ROOT, '.tmp'), { recursive: true });
fs.writeFileSync(path.join(ROOT, '.tmp', 'build-report.json'), JSON.stringify(report, null, 2));
console.log(`ビルド完了: ${report.pages.length} 頁`);
for (const [k, v] of Object.entries(report.answers)) {
  console.log(`  ${k}: ${v.chapters.length} 章, ${v.total} 問, 表示数式 ${v.stats.displayMath}, インライン数式 ${v.stats.inlineMath}, 表 ${v.stats.tables}, 図 ${v.stats.figures}`);
}
