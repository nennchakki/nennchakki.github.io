// プリアンブルの検査。
// 解答編の構造を作るマクロ（solutionbox, \solutionpart など）は、変換器が意味を知っている前提で
// 組み込みとして扱う。原稿側でその定義が変わったら、変換器の対応が古くなっている可能性があるので止める。
// 数式用の単純なマクロ（\alphap など）は、定義をそのまま読み取って展開に使う。

import { createHash } from 'node:crypto';
import { tokenize, serialize, TexError } from './tokenizer.mjs';

// 構造マクロ。値は「定義の本体」を正規化した文字列の SHA-256 の先頭 16 桁。
// 原稿の定義を変えたら `npm run snapshot -- --accept-preamble` ではなく、
// 変換器（convert.mjs）の対応を確かめてからここを更新する。
export const STRUCTURAL = {
  runningtitle: null, // 柱。中身は章ごとに \renewcommand される。定義の検査はしない
  stepmark: 'auto',
  recordbreak: 'auto',
  problemformulas: 'auto',
  answerheading: 'auto',
  answerconclusion: 'auto',
  'env:storybox': 'auto',
  'env:boardbox': 'auto',
  'env:checkpointbox': 'auto',
  'env:definitionbox': 'auto',
  'env:exercisebox': 'auto',
  prepareanswerheading: 'auto',
  closesolutionstatement: 'auto',
  solutionpart: 'auto',
  solutionfollowup: 'auto',
  solutionprelude: 'auto',
  'env:solutionbox': 'auto',
};

export function splitDocument(src) {
  const b = src.indexOf('\\begin{document}');
  const e = src.lastIndexOf('\\end{document}');
  if (b < 0 || e < 0) throw new TexError('\\begin{document} または \\end{document} がない');
  const preamble = src.slice(0, b);
  const bodyStart = b + '\\begin{document}'.length;
  const bodyLineOffset = src.slice(0, bodyStart).split('\n').length - 1;
  return { preamble, body: src.slice(bodyStart, e), bodyLineOffset };
}

function readGroup(toks, i) {
  // toks[i] が { であること。対応する } までの中身と、その次の位置を返す。
  if (toks[i]?.t !== 'bgroup') throw new TexError('{ が来るはずの位置に別のものがある', toks[i]?.line);
  let depth = 0;
  const start = i + 1;
  for (; i < toks.length; i++) {
    if (toks[i].t === 'bgroup') depth++;
    else if (toks[i].t === 'egroup') {
      depth--;
      if (depth === 0) return { inner: toks.slice(start, i), next: i + 1 };
    }
  }
  throw new TexError('} が閉じていない', toks[start - 1].line);
}

function skipSpaces(toks, i) {
  while (toks[i] && (toks[i].t === 'space' || toks[i].t === 'par')) i++;
  return i;
}

function readOptional(toks, i) {
  i = skipSpaces(toks, i);
  if (toks[i]?.t === 'char' && toks[i].v === '[') {
    let j = i + 1;
    const start = j;
    let depth = 0;
    for (; j < toks.length; j++) {
      const t = toks[j];
      if (t.t === 'bgroup') depth++;
      else if (t.t === 'egroup') depth--;
      else if (depth === 0 && t.t === 'char' && t.v === ']') return { value: toks.slice(start, j), next: j + 1 };
    }
    throw new TexError('] が閉じていない', toks[i].line);
  }
  return { value: null, next: i };
}

/**
 * プリアンブルから \newcommand / \renewcommand / \newenvironment を読み出す。
 * @returns {{macros: Map<string,{nargs:number, body:any[]}>, structural: Record<string,string>}}
 */
export function readPreamble(preamble) {
  const toks = tokenize(preamble);
  const macros = new Map();
  const structural = {};
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (t.t !== 'cs') continue;
    if (t.v === 'newcommand' || t.v === 'renewcommand') {
      let j = skipSpaces(toks, i + 1);
      let name;
      if (toks[j].t === 'bgroup') {
        const g = readGroup(toks, j);
        if (g.inner.length !== 1 || g.inner[0].t !== 'cs') throw new TexError('\\newcommand の名前が読めない', t.line);
        name = g.inner[0].v;
        j = g.next;
      } else if (toks[j].t === 'cs') {
        name = toks[j].v;
        j++;
      } else throw new TexError('\\newcommand の名前が読めない', t.line);
      const opt = readOptional(toks, j);
      j = opt.next;
      const opt2 = readOptional(toks, j);
      if (opt2.value) throw new TexError(`\\${name} の省略可能引数には対応していない`, t.line);
      j = skipSpaces(toks, opt2.next);
      const g = readGroup(toks, j);
      const nargs = opt.value ? Number(serialize(opt.value)) : 0;
      if (name in STRUCTURAL) {
        structural[name] = hashBody(nargs, g.inner);
      } else if (/^theH/.test(name) || name === 'theexercise' || name === 'headrulewidth' || name === 'footrulewidth') {
        // ハイパーリンクの内部名、柱の罫線。表示には関係しない。\theexercise は convert.mjs が同じ書式を持つ。
        structural[name] = hashBody(nargs, g.inner);
      } else {
        macros.set(name, { nargs, body: g.inner, line: t.line });
      }
      i = g.next - 1;
    } else if (t.v === 'newenvironment') {
      let j = skipSpaces(toks, i + 1);
      const gname = readGroup(toks, j);
      const name = serialize(gname.inner);
      const opt = readOptional(toks, gname.next);
      let k = opt.next;
      const opt2 = readOptional(toks, k);
      k = skipSpaces(toks, opt2.next);
      const gb = readGroup(toks, k);
      const ge = readGroup(toks, skipSpaces(toks, gb.next));
      const key = 'env:' + name;
      if (!(key in STRUCTURAL)) throw new TexError(`未知の環境定義 ${name}。変換器が対応していない`, t.line);
      structural[key] = hashBody(Number(opt.value ? serialize(opt.value) : 0), [...gb.inner, { t: 'char', v: '|' }, ...ge.inner], opt2.value);
      i = ge.next - 1;
    }
  }
  return { macros, structural };
}

function hashBody(nargs, body, optDefault) {
  const s = `${nargs}|${optDefault ? serialize(optDefault) : ''}|${serialize(body).replace(/\s+/g, ' ')}`;
  return createHash('sha256').update(s).digest('hex').slice(0, 16);
}

/**
 * 構造マクロの定義が、変換器が想定している定義と同じか確かめる。
 * expected は snapshot に記録した値（初回の確認時に人が目で確かめたもの）。
 */
export function verifyStructural(structural, expected) {
  const problems = [];
  for (const key of Object.keys(expected)) {
    if (!(key in structural)) problems.push(`構造マクロ ${key} の定義が原稿から消えた`);
    else if (structural[key] !== expected[key]) problems.push(`構造マクロ ${key} の定義が変わった`);
  }
  for (const key of Object.keys(structural)) {
    if (!(key in expected)) problems.push(`構造マクロ ${key} の定義が新しく増えた`);
  }
  return problems;
}
