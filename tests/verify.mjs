// ビルド後の検査。`npm test` で実行する（先に `npm run build`）。
// 1. 内部リンクとアンカーがすべて存在する
// 2. 固定 URL が残っていて、JavaScript なしでも行き先へのリンクがある
// 3. QR コードを読み取ると、固定 URL と一致する
// 4. 解答編の章数・問題数・問題番号が、スナップショットの記録・本文との照合と一致する
// 5. 公開対象外のファイルが dist/ に入っていない
// 6. 同じスナップショットから2回ビルドすると、同じ出力になる

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';
import { PERMANENT } from '../content/permanent-urls.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const DIST = path.join(ROOT, 'dist');
const site = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/site.json'), 'utf8'));
let failures = 0;
const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'ok  ' : 'NG  '} ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) failures++;
}

function walk(d) {
  return fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
}
const files = walk(DIST);
const rel = (f) => '/' + path.relative(DIST, f).split(path.sep).join('/');
const htmlFiles = files.filter((f) => f.endsWith('.html'));

// ---------- 1. リンク ----------
const ids = new Map();
const pageOf = (url) => {
  if (url.endsWith('/')) return url + 'index.html';
  return url;
};
for (const f of htmlFiles) {
  const s = fs.readFileSync(f, 'utf8');
  ids.set(rel(f), new Set([...s.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])));
}
const broken = [];
let linkCount = 0;
for (const f of htmlFiles) {
  const s = fs.readFileSync(f, 'utf8');
  const here = rel(f);
  for (const m of s.matchAll(/\s(?:href|src|srcset)="([^"]+)"/g)) {
    let u = m[1];
    if (/^(https?:|mailto:|data:)/.test(u)) {
      if (u.startsWith(site.baseUrl)) u = u.slice(site.baseUrl.length) || '/';
      else continue;
    }
    linkCount++;
    const [p0, frag] = u.split('#');
    const p = p0.split('?')[0];
    let target;
    if (p === '') target = here;
    else if (p.startsWith('/')) target = pageOf(p);
    else target = pageOf(path.posix.join(path.posix.dirname(here), p));
    if (!fs.existsSync(path.join(DIST, target))) { broken.push(`${here} → ${u}`); continue; }
    if (frag && target.endsWith('.html') && !ids.get(target)?.has(decodeURIComponent(frag))) broken.push(`${here} → ${u}（アンカーなし）`);
  }
}
check('内部リンクとアンカー', broken.length === 0, broken.length ? broken.slice(0, 10).join(' / ') : `${linkCount} 件`);

// id の重複
const dupIds = [];
for (const f of htmlFiles) {
  const s = fs.readFileSync(f, 'utf8');
  const seen = new Map();
  for (const m of s.matchAll(/\sid="([^"]+)"/g)) seen.set(m[1], (seen.get(m[1]) ?? 0) + 1);
  for (const [k, v] of seen) if (v > 1) dupIds.push(`${rel(f)} #${k}×${v}`);
}
check('id の重複がない', dupIds.length === 0, dupIds.slice(0, 5).join(' / '));

// ---------- 2. 固定 URL ----------
const locked = fs.readFileSync(path.join(ROOT, 'tests/permanent-urls.lock'), 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
for (const u of locked) check(`固定 URL ${u} が存在する`, fs.existsSync(path.join(DIST, u, 'index.html')));
for (const p of PERMANENT) {
  check(`固定 URL ${p.path} が lock に記録されている`, locked.includes(p.path));
  const s = fs.readFileSync(path.join(DIST, p.path, 'index.html'), 'utf8');
  const noScript = !/<script/i.test(s) && !/http-equiv="refresh"/i.test(s);
  check(`固定 URL ${p.path} は JavaScript なしで読める（script なし）`, noScript);
  for (const l of p.links) check(`固定 URL ${p.path} から ${l.href} へのリンク`, s.includes(`href="${l.href}"`) && fs.existsSync(path.join(DIST, l.href, 'index.html')));
  check(`固定 URL ${p.path} は PDF を直接指さない`, !p.links.some((l) => /\.pdf$/i.test(l.href)));
}

// ---------- 3. QR コード ----------
for (const p of PERMANENT) {
  const name = p.path.replace(/^\/q\//, '').replace(/\/$/, '');
  const png = PNG.sync.read(fs.readFileSync(path.join(DIST, 'q', name, 'qr.png')));
  const code = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  check(`QR コード q/${name}/qr.png を読み取ると ${site.baseUrl}${p.path}`, code?.data === site.baseUrl + p.path, code?.data ?? '読み取れない');
  // SVG 版も同じ内容から作っている（qrcode ライブラリの同じ入力）ことを、モジュール数で確かめる
  const svg = fs.readFileSync(path.join(DIST, 'q', name, 'qr.svg'), 'utf8');
  const vb = svg.match(/viewBox="0 0 (\d+) (\d+)"/);
  check(`QR コード q/${name}/qr.svg の大きさが PNG と一致`, vb && Number(vb[1]) * 16 === png.width, vb ? `${vb[1]} モジュール` : '');
}

// ---------- 4. 解答編 ----------
const report = JSON.parse(fs.readFileSync(path.join(ROOT, '.tmp/build-report.json'), 'utf8'));
for (const [slug, a] of Object.entries(report.answers)) {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', slug, 'answers/manifest.json'), 'utf8'));
  check(`${slug}: 章数がスナップショットの記録と一致`, a.chapters.length === manifest.counts.chapters, `${a.chapters.length}`);
  check(`${slug}: 問題数がスナップショットの記録と一致`, a.total === manifest.counts.problems, `${a.total}`);
  const mc = manifest.mainTextCheck;
  if (mc) {
    check(`${slug}: 本文の問題数と解答の問題数が一致`, mc.mainExercises === mc.answerProblems, `${mc.mainExercises} / ${mc.answerProblems}`);
    check(`${slug}: 本文と解答で、問題の題・章・小問数がすべて一致`, !mc.titleMismatches.length && !mc.chapterMismatches.length && !mc.partMismatches.length);
  }
  // 各章ページの問題の数と番号
  let pageProblems = 0;
  const codes = [];
  for (const c of a.chapters) {
    const s = fs.readFileSync(path.join(DIST, 'works', slug, 'answers', c.slug, 'index.html'), 'utf8');
    const n = (s.match(/<article class="problem"/g) ?? []).length;
    pageProblems += n;
    if (n !== c.problems) check(`${slug}/${c.slug}: 問題数`, false, `${n} ≠ ${c.problems}`);
    for (const m of s.matchAll(/<span class="pcode">（([^）]+)）<\/span>/g)) codes.push(m[1]);
    if (/katex-error/.test(s)) check(`${slug}/${c.slug}: 数式の組版エラーがない`, false);
  }
  check(`${slug}: 章ページの問題の合計`, pageProblems === a.total, `${pageProblems}`);
  const expectCodes = a.chapters.flatMap((c) => Array.from({ length: c.problems }, (_, i) => `${c.part === 1 ? 'I' : 'II'}-${c.number}-${i + 1}`));
  check(`${slug}: 問題番号（I-1-1 など）が章ごとに 1 から連番`, JSON.stringify(codes) === JSON.stringify(expectCodes));
  check(`${slug}: 章の URL が ch01 から連番`, a.chapters.every((c, i) => c.slug === 'ch' + String(i + 1).padStart(2, '0')));
}

// ---------- 4b. 寄稿作品 ----------
{
  const works = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/writings/works.json'), 'utf8')).works;
  const anth = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/writings/anthologies.json'), 'utf8'));
  const page = fs.readFileSync(path.join(DIST, 'writings/index.html'), 'utf8');
  const home = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
  const pub = works.filter((w) => w.visibility === 'public');
  const hold = works.filter((w) => w.visibility !== 'public');
  check('寄稿作品: id が重複しない', new Set(works.map((w) => w.id)).size === works.length);
  check('寄稿作品: 公開する作品がすべて詳細ページにある', pub.every((w) => page.includes(`id="${w.id}"`)), `${pub.length} 作品`);
  check('寄稿作品: 公開しない作品の題名がどのページにも出ない', hold.every((w) => !htmlFiles.some((f) => fs.readFileSync(f, 'utf8').includes(w.title))), `${hold.length} 作品`);
  check('寄稿作品: トップから全作品へリンクしている', pub.every((w) => home.includes(`href="/writings/#${w.id}"`)));
  const missingSrc = pub.filter((w) => !w.sources?.length || w.sources.some((s) => !/^https:\/\//.test(s.url)));
  check('寄稿作品: 告知の出典 URL がある', missingSrc.length === 0, missingSrc.map((w) => w.id).join(', '));
  const badDist = [];
  for (const [k, b] of Object.entries(anth.books)) for (const d of b.distributions) {
    if (!anth.events[d.event]) badDist.push(`${k}:${d.event}`);
    if (!d.source) badDist.push(`${k}: 出典なし`);
    if (d.date && !/^\d{4}-\d{2}-\d{2}$/.test(d.date)) badDist.push(`${k}: 日付の書式`);
  }
  check('合同誌: 頒布の機会にイベントと出典がある', badDist.length === 0, badDist.join(', '));
  // 会期全体を個別の頒布日として表示していないこと（C109 の 3 日間をまとめて書かない）
  check('寄稿作品: 会期の範囲を頒布日として書いていない', !/12月29日〜31日|12\/29〜31|29〜31日/.test(page));
  // 本文の PDF・TeX・Word を配っていないこと
  check('寄稿作品: 原稿ファイルを配布していない', !files.some((f) => /\.(pdf|docx?|md)$/i.test(f) && rel(f).startsWith('/writings')));
}

// ---------- 5. 公開対象外 ----------
const forbidden = files.filter((f) => /\.(tex|aux|log|toc|out|synctex\.gz|fls|fdb_latexmk|md|mjs|json|lock|py|sh)$/i.test(f) || /\.DS_Store$/.test(f) || /(^|\/)(\.private|content|tools|tests|node_modules|docs)(\/|$)/.test(rel(f).slice(1)));
check('公開対象外のファイル（TeX・中間ファイル・メモなど）が dist に入っていない', forbidden.length === 0, forbidden.slice(0, 5).map(rel).join(', '));
const absPath = htmlFiles.filter((f) => /\/Users\/|C108原稿|University\/VSCode/.test(fs.readFileSync(f, 'utf8')));
check('ローカルの絶対パスが HTML に入っていない', absPath.length === 0, absPath.map(rel).join(', '));

// ---------- 6. 再現性 ----------
if (!process.argv.includes('--no-rebuild')) {
  const digest = () => createHash('sha256').update(walk(DIST).sort().map((f) => rel(f) + ':' + createHash('sha256').update(fs.readFileSync(f)).digest('hex')).join('\n')).digest('hex');
  const d1 = digest();
  execFileSync('node', [path.join(ROOT, 'tools/build.mjs')], { cwd: ROOT, stdio: 'pipe' });
  const d2 = digest();
  check('同じスナップショットから再ビルドすると同じ出力', d1 === d2, d1.slice(0, 12));
}

fs.writeFileSync(path.join(ROOT, '.tmp/verify-result.json'), JSON.stringify(results, null, 2));
console.log(failures ? `\n失敗 ${failures} 件` : `\nすべて合格（${results.length} 項目）`);
process.exit(failures ? 1 : 0);
