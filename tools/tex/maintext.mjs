// 本文 TeX と解答編の対応を照合する。本文は変換もコピーもしない。
// 本文の exercisebox を、トークン列で順に読み、次を取り出す。
//   - 章番号（\section の数。本文は \let\section\subsubsection の区間を除いて数える）
//   - 問題の題（exercisebox の引数）
//   - 外側の enumerate の \item の数（小問の数）
// 解答編の solutionbox と順に突き合わせる。

import { tokenize, serialize } from './tokenizer.mjs';
import { splitDocument } from './preamble.mjs';

function readGroup(toks, i) {
  while (toks[i] && toks[i].t === 'space') i++;
  if (toks[i]?.t !== 'bgroup') return { inner: [toks[i]], next: i + 1 };
  let d = 0;
  const s = i + 1;
  for (; i < toks.length; i++) {
    if (toks[i].t === 'bgroup') d++;
    else if (toks[i].t === 'egroup' && --d === 0) return { inner: toks.slice(s, i), next: i + 1 };
  }
  throw new Error('本文: } が閉じていない');
}

export function extractMainExercises(mainSrc) {
  const { body, bodyLineOffset } = splitDocument(mainSrc);
  const toks = tokenize(body, { lineOffset: bodyLineOffset });
  const out = [];
  let section = 0;
  let sectionIsSub = 0; // \let\section\subsubsection が有効な \begingroup の深さ
  let groupDepth = 0;
  let cur = null;
  let enumDepth = 0;
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (t.t !== 'cs') continue;
    if (t.v === 'begingroup') groupDepth++;
    else if (t.v === 'endgroup') {
      if (sectionIsSub === groupDepth) sectionIsSub = 0;
      groupDepth--;
    } else if (t.v === 'let' && toks[i + 1]?.v === 'section' && toks[i + 2]?.v === 'subsubsection') {
      sectionIsSub = groupDepth;
    } else if (t.v === 'section' && !sectionIsSub) {
      if (toks[i + 1]?.t === 'char' && toks[i + 1].v === '*') continue;
      section++;
    } else if (t.v === 'begin' || t.v === 'end') {
      const g = readGroup(toks, i + 1);
      const name = serialize(g.inner);
      if (name === 'exercisebox') {
        if (t.v === 'begin') {
          const title = readGroup(toks, g.next);
          cur = { chapter: section, title: serialize(title.inner).trim(), items: 0, line: t.line };
          enumDepth = 0;
        } else {
          out.push(cur);
          cur = null;
        }
      } else if (cur && (name === 'enumerate' || name === 'itemize' || name === 'description')) {
        enumDepth += t.v === 'begin' ? 1 : -1;
      }
    } else if (t.v === 'item' && cur && enumDepth === 1) {
      cur.items++;
    }
  }
  return out;
}

function inlineTex(inl) {
  return inl.map((x) => (x.t === 'text' ? x.v : x.t === 'math' ? `$${x.tex}$` : x.c ? inlineTex(x.c) : '')).join('');
}

// 本文側の TeX の題を、解答編の変換結果と同じ表記へ寄せる（アクセントと合字だけ）。
const ACC = { '"': '\u0308', "'": '\u0301', '`': '\u0300', '^': '\u0302', '~': '\u0303' };
const norm = (s) => s
  .replace(/\\textup\{([^}]*)\}/g, '$1')
  .replace(/\\(["'`^~])\{?([A-Za-z])\}?/g, (_, a, c) => (c + ACC[a]).normalize('NFC'))
  .replace(/--/g, '–')
  .replace(/'/g, '’')
  .replace(/\s+/g, '');

export function compareWithMainText(mainSrc, doc) {
  const main = extractMainExercises(mainSrc);
  const ans = [];
  for (const c of doc.chapters) {
    for (const b of c.blocks) {
      if (b.type !== 'problem') continue;
      const labeled = b.body.filter((p) => p.type === 'part' && p.label !== '' && p.label !== 'まとめ').length;
      const followup = b.body.filter((p) => p.type === 'part' && p.label === 'まとめ').length;
      ans.push({ chapter: c.number, code: b.code, title: inlineTex(b.title), parts: labeled, followup, line: b.line });
    }
  }
  const titleMismatches = [];
  const partMismatches = [];
  const chapterMismatches = [];
  const n = Math.max(main.length, ans.length);
  for (let k = 0; k < n; k++) {
    const m = main[k];
    const a = ans[k];
    if (!m || !a) {
      titleMismatches.push({ index: k + 1, main: m ?? null, answer: a ?? null });
      continue;
    }
    if (m.chapter !== a.chapter) chapterMismatches.push({ code: a.code, mainChapter: m.chapter, answerChapter: a.chapter });
    if (norm(m.title) !== norm(a.title)) titleMismatches.push({ code: a.code, main: m.title, mainLine: m.line, answer: a.title, answerLine: a.line });
    if (m.items !== a.parts) partMismatches.push({ code: a.code, mainItems: m.items, answerParts: a.parts, followup: a.followup, mainLine: m.line, answerLine: a.line });
  }
  return {
    mainExercises: main.length,
    answerProblems: ans.length,
    chapterMismatches,
    titleMismatches,
    partMismatches,
  };
}
