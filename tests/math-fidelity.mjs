// 数式の照合。変換器を通さずに原稿から取り出した数式と、Web 版で KaTeX に渡した数式を比べる。
//
// 原稿側: TeX ソースから $...$、\(...\)、\[...\]、equation/align 環境の中身を、字句解析だけで順に取り出す。
// Web 側: dist の HTML に KaTeX が埋め込んだ <annotation encoding="application/x-tex"> を順に取り出す。
// 比べる前に両方から、空白・\label{..}・\notag・\nonumber・変換器が足した \tag{章.番号} を取り除く。
// 変換器が足してよいのは \tag だけなので、これ以外の差は誤変換として報告する。

import fs from 'node:fs';
import path from 'node:path';
import { splitDocument } from '../tools/tex/preamble.mjs';
import { tokenize, serialize } from '../tools/tex/tokenizer.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const slug = process.argv[2] ?? 'hiro-string';
const src = fs.readFileSync(path.join(ROOT, 'content', slug, 'answers/source/answers.tex'), 'utf8');
const { body, bodyLineOffset } = splitDocument(src);
const toks = tokenize(body, { lineOffset: bodyLineOffset });

// ---- 原稿から順に取り出す ----
const fromTex = [];
const MATH_ENVS = new Set(['equation', 'equation*', 'align', 'align*']);
for (let i = 0; i < toks.length; i++) {
  const t = toks[i];
  if (t.t === 'mathshift') {
    let j = i + 1;
    while (toks[j].t !== 'mathshift') j++;
    fromTex.push({ tex: serialize(toks.slice(i + 1, j)), line: t.line, display: false });
    i = j;
  } else if (t.t === 'cs' && (t.v === '(' || t.v === '[')) {
    const close = t.v === '(' ? ')' : ']';
    let j = i + 1;
    while (!(toks[j].t === 'cs' && toks[j].v === close)) j++;
    fromTex.push({ tex: serialize(toks.slice(i + 1, j)), line: t.line, display: t.v === '[' });
    i = j;
  } else if (t.t === 'cs' && t.v === 'begin') {
    // \begin{name}
    let name = '';
    let j = i + 2;
    while (toks[j].t !== 'egroup') name += toks[j++].v;
    if (name === 'tikzpicture') {
      // 図の中のラベルは SVG に組み込まれる（図は別に照合する）。\end{tikzpicture} まで飛ばす
      let k = j;
      while (!(toks[k].t === 'cs' && toks[k].v === 'end' && serialize(toks.slice(k + 2, k + 2 + 11)) === 'tikzpicture')) k++;
      i = k;
      continue;
    }
    if (!MATH_ENVS.has(name)) continue;
    const start = j + 1;
    let k = start;
    let depth = 1;
    for (;; k++) {
      const u = toks[k];
      if (u.t === 'cs' && (u.v === 'begin' || u.v === 'end')) {
        let n2 = '';
        let m = k + 2;
        while (toks[m].t !== 'egroup') n2 += toks[m++].v;
        if (n2 === name) {
          depth += u.v === 'begin' ? 1 : -1;
          if (depth === 0) break;
        }
      }
    }
    fromTex.push({ tex: serialize(toks.slice(start, k)), line: t.line, display: true, env: name });
    i = k;
  }
}

// ---- Web から順に取り出す ----
const answersDir = path.join(ROOT, 'dist/works', slug, 'answers');
const decode = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, '&');
const pagesInOrder = ['index.html', ...fs.readdirSync(answersDir).filter((d) => /^ch\d\d$/.test(d)).sort().map((d) => `${d}/index.html`)];
const fromWeb = [];
for (const p of pagesInOrder) {
  let h = fs.readFileSync(path.join(answersDir, p), 'utf8');
  if (p === 'index.html') {
    // 目次ページでは、前付け（この別冊について等）だけが原稿の数式を含む。目次の章題の数式を除くため範囲を限る
    const a = h.indexOf('<details class="front-matter">');
    h = h.slice(a, h.indexOf('</details>', a));
  } else {
    // 章ページ: 章題 h1 → 本文の順。章内目次（nav）の重複は除く
    const h1 = h.slice(h.indexOf('<header class="chapter-head">'), h.indexOf('</header>', h.indexOf('<header class="chapter-head">')));
    const bodyStart = h.indexOf('<div class="answer-body">');
    h = h1 + h.slice(bodyStart, h.indexOf('<nav class="pager"'));
  }
  for (const m of h.matchAll(/<annotation encoding="application\/x-tex">([\s\S]*?)<\/annotation>/g)) fromWeb.push(decode(m[1]));
}

// 原稿の数式のうち、章題（\section）の中の数式は、章ページの h1 と章内目次の両方に出る。
// 目次の分はすでに除いた。前付けより前（表紙と目次）は Web にない。
// \part の題の数式はない（確認済み）。

const norm = (s) => s
  .replace(/\\label\{[^}]*\}/g, '')
  .replace(/\\(notag|nonumber)(?![A-Za-z])/g, '')
  .replace(/\\tag\{\d+\.\d+\}/g, '')
  .replace(/\\begin\{align\*\}|\\end\{align\*\}/g, '')
  .replace(/\\\\/g, '\\\\')
  .replace(/\s+/g, '');

// 表紙（titlepage）と目次は Web に出さないので、原稿の最初の「この別冊について」より前の数式は除く
const firstBodyLine = src.split('\n').findIndex((l) => l.includes('\\begin{checkpointbox}{この別冊について}')) + 1;
const texList = fromTex.filter((x) => x.line >= firstBodyLine);

let ok = 0;
const bad = [];
const n = Math.max(texList.length, fromWeb.length);
for (let k = 0; k < n; k++) {
  const a = texList[k];
  const b = fromWeb[k];
  if (!a || !b) { bad.push({ k, tex: a?.tex, web: b, line: a?.line }); break; }
  if (norm(a.tex) === norm(b)) ok++;
  else { bad.push({ k, line: a.line, tex: a.tex.slice(0, 200), web: b.slice(0, 200) }); if (bad.length > 20) break; }
}
console.log(`原稿の数式 ${texList.length} 個、Web の数式 ${fromWeb.length} 個、一致 ${ok} 個`);
for (const x of bad.slice(0, 10)) console.log('不一致', JSON.stringify(x));
const pass = bad.length === 0 && texList.length === fromWeb.length;
console.log(pass ? '数式はすべて原稿と一致（\\tag の付加と \\label の除去を除く）' : '数式に不一致がある');
fs.mkdirSync(path.join(ROOT, '.tmp'), { recursive: true });
fs.writeFileSync(path.join(ROOT, '.tmp/math-fidelity.json'), JSON.stringify({ tex: texList.length, web: fromWeb.length, ok, bad }, null, 1));
process.exit(pass ? 0 : 1);
