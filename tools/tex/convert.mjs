// 解答編 TeX → 中間表現（IR）の変換器。
//
// 方針
// - TeX のトークン列を先頭から順に解釈する。正規表現で原稿を切り分けない。
// - \begingroup / \endgroup と { } でマクロのスコープを管理する（章ごとに同名マクロの定義が違うため）。
// - 数式番号・問題番号・節番号は LaTeX と同じ規則で数える（\numberwithin{equation}{section} など）。
// - 知らない命令や環境に出会ったら、推測で読み飛ばさずに TexError で止める。
// - 数式の中身は書き換えない。行う変換は、利用者定義マクロの展開、\label の取り外し、
//   LaTeX が付ける番号を \tag として明示すること。利用者定義マクロは展開せず、
//   その位置で有効な定義を KaTeX の macros として渡す。

import { createHash } from 'node:crypto';
import { tokenize, serialize, TexError } from './tokenizer.mjs';
import { splitDocument, readPreamble } from './preamble.mjs';

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
const MATH_ENVS = new Set(['equation', 'equation*', 'align', 'align*']);
const LIST_ENVS = new Set(['itemize', 'enumerate', 'description']);

// 本文中で「表示に影響しない」と確認した命令と、その引数の数。
// ここにない命令は止まる。
const IGNORE = {
  clearpage: 0, bigskip: 0, medskip: 0, smallskip: 0, noindent: 0, par: 0,
  tableofcontents: 0, vfill: 0, selectfont: 0, loweranswerstrue: 0,
  sffamily: 0, bfseries: 0, small: 0, normalfont: 0,
  thispagestyle: 1, pagenumbering: 1, hypersetup: 1, Needspace: 1, needspace: 1,
  fontsize: 2, rule: 2,
};

class Stream {
  constructor(toks) {
    this.toks = toks;
    this.i = 0;
  }
  peek() { return this.toks[this.i]; }
  next() { return this.toks[this.i++]; }
  eof() { return this.i >= this.toks.length; }
  unshift(list) {
    this.toks = [...list, ...this.toks.slice(this.i)];
    this.i = 0;
  }
  lastLine() {
    const t = this.toks[Math.min(this.i, this.toks.length - 1)];
    return t?.line;
  }
}

class Scope {
  constructor(parent) {
    this.parent = parent;
    this.macros = new Map();
  }
  get(name) {
    for (let s = this; s; s = s.parent) if (s.macros.has(name)) return s.macros.get(name);
    return undefined;
  }
}

function isSpace(t) { return t && (t.t === 'space'); }

function readGroupTokens(st, what) {
  while (isSpace(st.peek())) st.next();
  const t = st.next();
  if (!t) throw new TexError(`${what} の引数がない`);
  if (t.t !== 'bgroup') {
    if (t.t === 'egroup') throw new TexError(`${what} の引数がない`, t.line);
    return [t];
  }
  let depth = 1;
  const out = [];
  for (;;) {
    const u = st.next();
    if (!u) throw new TexError(`${what} の引数の } が閉じていない`, t.line);
    if (u.t === 'bgroup') depth++;
    else if (u.t === 'egroup' && --depth === 0) return out;
    out.push(u);
  }
}

function readOptTokens(st) {
  // 省略可能引数 [..]。TeX と同じく、直前の空白は読み飛ばさない（\item[..] 等で必要な場合だけ呼ぶ）。
  const t = st.peek();
  if (!(t && t.t === 'char' && t.v === '[')) return null;
  st.next();
  let depth = 0;
  const out = [];
  for (;;) {
    const u = st.next();
    if (!u) throw new TexError('] が閉じていない', t.line);
    if (u.t === 'bgroup') depth++;
    if (u.t === 'egroup') depth--;
    if (depth === 0 && u.t === 'char' && u.v === ']') return out;
    out.push(u);
  }
}

function readEnvName(st, line) {
  const g = readGroupTokens(st, '\\begin/\\end');
  const name = serialize(g);
  if (!/^[A-Za-z*]+$/.test(name)) throw new TexError(`環境名が読めない: ${name}`, line);
  return name;
}

/** \begin{name} から対応する \end{name} までのトークンをそのまま集める。 */
function collectEnvBody(st, name, line) {
  const out = [];
  let depth = 1;
  for (;;) {
    const t = st.next();
    if (!t) throw new TexError(`\\begin{${name}} が閉じていない`, line);
    if (t.t === 'cs' && (t.v === 'begin' || t.v === 'end')) {
      const save = st.i;
      const g = readGroupTokens(st, t.v);
      const n = serialize(g);
      if (n === name) {
        if (t.v === 'begin') depth++;
        else if (--depth === 0) return out;
      }
      out.push(t, { t: 'bgroup', v: '{', line: t.line }, ...g, { t: 'egroup', v: '}', line: t.line });
      void save;
      continue;
    }
    out.push(t);
  }
}

function sanitizeId(s) {
  return s.replace(/[^A-Za-z0-9_.:-]/g, '-');
}

export class AnswersConverter {
  constructor(src, opts = {}) {
    this.src = src;
    this.opts = opts;
    const { preamble, body, bodyLineOffset } = splitDocument(src);
    this.body = body;
    this.pre = readPreamble(preamble);
    this.global = new Scope(null);
    for (const [k, v] of this.pre.macros) this.global.macros.set(k, v);
    this.scope = new Scope(this.global);
    this.groupDepth = 0;
    this.counters = { part: 0, section: 0, subsection: 0, equation: 0, exercise: 0, tocdepth: 0 };
    this.runningTitle = null;
    this.labels = new Map();
    this.macroSets = [];
    this.macroSetIndex = new Map();
    this.figures = [];
    this.notes = [];
    this.tokens = tokenize(body, { lineOffset: bodyLineOffset });
    this.bodyStartOffset = src.indexOf('\\begin{document}') + '\\begin{document}'.length;
  }

  // ---------- マクロ ----------
  define(name, nargs, body, line, isRenew) {
    if (name === 'runningtitle') {
      this.runningTitle = this.inlineText(this.parseInline(body));
      return;
    }
    if (!isRenew && this.scope.macros.has(name)) throw new TexError(`\\${name} を同じスコープで二度定義している`, line);
    this.scope.macros.set(name, { nargs, body, line });
  }

  expandOnce(m, st, name, line) {
    const args = [];
    for (let k = 0; k < m.nargs; k++) args.push(readGroupTokens(st, '\\' + name));
    const out = [];
    for (const t of m.body) {
      if (t.t === 'param') {
        const a = args[Number(t.v) - 1];
        if (!a) throw new TexError(`\\${name} の引数 #${t.v} がない`, line);
        out.push(...a);
      } else out.push({ ...t, line });
    }
    return out;
  }

  // ---------- 数式 ----------
  mathInline(toks, line) {
    if (toks.some((t) => t.t === 'par')) throw new TexError('インライン数式の中に段落区切りがある', line);
    this.checkMathCs(toks, line);
    return { t: 'math', tex: serialize(toks).trim(), macros: this.macroSetId(), line };
  }

  /**
   * その位置で見えている利用者定義マクロの一覧を作り、番号を返す。
   * マクロは変換器では展開せず、KaTeX の macros に渡す。
   * KaTeX のマクロ展開は TeX と同じく遅延展開なので、\frac\Tens2 のような
   * 「マクロを1トークンの引数として渡す」書き方も TeX と同じ結果になる。
   */
  macroSetId() {
    const chain = [];
    for (let sc = this.scope; sc; sc = sc.parent) chain.unshift(sc);
    const defs = {};
    for (const sc of chain) for (const [k, v] of sc.macros) defs['\\' + k] = serialize(v.body);
    const key = JSON.stringify(Object.entries(defs).sort());
    if (!this.macroSetIndex.has(key)) {
      this.macroSetIndex.set(key, this.macroSets.length);
      this.macroSets.push(defs);
    }
    return this.macroSetIndex.get(key);
  }

  checkMathCs(toks, line) {
    for (const t of toks) {
      if (t.t === 'cs' && (t.v === 'label' || t.v === 'ref' || t.v === 'eqref')) {
        throw new TexError(`インライン数式の中の \\${t.v} には対応していない`, line);
      }
    }
  }

  /** 表示数式。番号付きの行には LaTeX と同じ番号を \tag で明示する。 */
  mathDisplay(env, toks, line) {
    const ex = toks;
    const numbered = !env.endsWith('*') && env !== 'display';
    const isAlign = env.startsWith('align');
    const rows = isAlign ? this.splitRows(ex) : [ex];
    const anchors = [];
    const numbers = [];
    const outRows = rows.map((row) => {
      const r = [];
      let tag = null;
      let suppress = false;
      const labels = [];
      const st = new Stream(row);
      while (!st.eof()) {
        const t = st.next();
        if (t.t === 'cs' && (t.v === 'notag' || t.v === 'nonumber')) { suppress = true; continue; }
        if (t.t === 'cs' && t.v === 'label') { labels.push(serialize(readGroupTokens(st, '\\label'))); continue; }
        if (t.t === 'cs' && t.v === 'tag') {
          const g = readGroupTokens(st, '\\tag');
          tag = serialize(g);
          r.push(t, { t: 'bgroup', v: '{' }, ...g, { t: 'egroup', v: '}' });
          continue;
        }
        r.push(t);
      }
      let number = null;
      if (tag !== null) number = tag;
      else if (numbered && !suppress) {
        this.counters.equation++;
        number = `${this.counters.section}.${this.counters.equation}`;
        r.push({ t: 'cs', v: 'tag' }, { t: 'bgroup', v: '{' }, ...tokenize(number), { t: 'egroup', v: '}' });
      }
      if (number !== null) numbers.push(number);
      for (const lb of labels) {
        const id = 'eq-' + sanitizeId(lb);
        if (this.labels.has(lb)) throw new TexError(`\\label{${lb}} が重複している`, line);
        this.labels.set(lb, { id, number, chapter: this.counters.section });
        anchors.push(id);
      }
      return serialize(r).trim();
    });
    let tex;
    if (isAlign) tex = `\\begin{align*}\n${outRows.join('\\\\\n')}\n\\end{align*}`;
    else tex = outRows[0];
    return { type: 'math', tex, anchors, numbers, env, line, macros: this.macroSetId() };
  }

  /** align の行を、深さ 0 の \\ で分ける（中の pmatrix などの \\ は分けない）。 */
  splitRows(toks) {
    const rows = [[]];
    let depth = 0;
    let env = 0;
    for (let k = 0; k < toks.length; k++) {
      const t = toks[k];
      if (t.t === 'bgroup') depth++;
      else if (t.t === 'egroup') depth--;
      else if (t.t === 'cs' && t.v === 'begin') env++;
      else if (t.t === 'cs' && t.v === 'end') env--;
      if (depth === 0 && env === 0 && t.t === 'cs' && t.v === '\\') {
        rows.push([]);
        continue;
      }
      rows[rows.length - 1].push(t);
    }
    // 末尾の空行（\\ で終わる align）は LaTeX でも番号が付かない空行になる。ここでは止める。
    const last = rows[rows.length - 1];
    if (rows.length > 1 && last.every((t) => t.t === 'space' || t.t === 'par')) {
      throw new TexError('align が \\\\ で終わっている。番号の扱いが LaTeX と一致するか確認が必要', last[0]?.line);
    }
    return rows;
  }

  // ---------- 文字列化 ----------
  inlineText(inl) {
    return inl.map((x) => (x.t === 'text' ? x.v : x.t === 'math' ? `$${x.tex}$` : x.c ? this.inlineText(x.c) : '')).join('');
  }

  parseInline(toks, line) {
    const blocks = this.parseBlocks(new Stream(toks), { until: null, inlineOnly: true });
    if (blocks.length === 0) return [];
    if (blocks.length > 1 || blocks[0].type !== 'p') {
      throw new TexError('見出しや表のセルの中に段落や表示数式がある', line ?? toks[0]?.line);
    }
    return blocks[0].c;
  }

  withScope(fn) {
    const saved = this.scope;
    this.scope = new Scope(saved);
    try {
      return fn();
    } finally {
      this.scope = saved;
    }
  }

  // ---------- 本体 ----------
  /**
   * ブロックの列を読む。
   * until: 'env:NAME' のとき \end{NAME} で止まる。null なら入力の終わりまで。
   */
  parseBlocks(st, { until, inlineOnly = false, listItems = false }) {
    const blocks = [];
    let para = null;
    let paraCont = false;
    let contNext = false;
    const stack = [];   // 書式付きインライン（\textbf{..} など）の入れ子
    const flush = () => {
      if (para) {
        const c = finishInlines(para);
        if (c.length) blocks.push({ type: 'p', cont: paraCont, c });
      }
      para = null;
    };
    const addInline = (x) => {
      if (!para) {
        if (x.t === 'text' && /^\s*$/.test(x.v)) return;
        para = [];
        paraCont = contNext;
        contNext = false;
      }
      para.push(x);
    };
    const addBlock = (b) => {
      if (inlineOnly) throw new TexError('ここには段落の中身しか置けない', b.line);
      flush();
      blocks.push(b);
      contNext = true;
    };
    void stack;

    while (!st.eof()) {
      const t = st.next();
      switch (t.t) {
        case 'char':
          addInline({ t: 'text', v: t.v });
          continue;
        case 'space':
          if (para) addInline({ t: 'text', v: ' ' });
          continue;
        case 'par':
          if (inlineOnly) { if (para) addInline({ t: 'text', v: ' ' }); continue; }
          flush();
          contNext = false;
          continue;
        case 'mathshift': {
          const m = [];
          for (;;) {
            const u = st.next();
            if (!u) throw new TexError('$ が閉じていない', t.line);
            if (u.t === 'mathshift') break;
            m.push(u);
          }
          if (m.length === 0) throw new TexError('$$ には対応していない', t.line);
          addInline(this.mathInline(m, t.line));
          continue;
        }
        case 'bgroup': {
          // 中括弧のグループ。スコープを作って中を読み、段落の中身として戻す。
          let depth = 1;
          const inner = [];
          for (;;) {
            const u = st.next();
            if (!u) throw new TexError('{ が閉じていない', t.line);
            if (u.t === 'bgroup') depth++;
            if (u.t === 'egroup' && --depth === 0) break;
            inner.push(u);
          }
          const c = this.withScope(() => this.parseInline(inner, t.line));
          for (const x of c) addInline(x);
          continue;
        }
        case 'egroup':
          throw new TexError('対応する { のない }', t.line);
        case 'tab':
          throw new TexError('表の外に & がある', t.line);
        case 'active':
          addInline({ t: 'text', v: '\u00a0' });
          continue;
        case 'param':
          throw new TexError('本文に # がある', t.line);
      }
      // 制御綴
      const name = t.v;
      if (name === 'end') {
        const n = readEnvName(st, t.line);
        if (until === 'env:' + n) {
          flush();
          return blocks;
        }
        throw new TexError(`\\end{${n}} が対応する \\begin なしに現れた（期待: ${until}）`, t.line);
      }
      if (name === 'item') {
        if (!listItems) throw new TexError('リストの外に \\item がある', t.line);
        const label = readOptTokens(st);
        flush();
        blocks.push({ type: 'item', label: label ? this.withScope(() => this.parseInline(label, t.line)) : null, line: t.line });
        contNext = false;
        continue;
      }
      if (name === 'begin') {
        const env = readEnvName(st, t.line);
        const b = this.beginEnv(env, st, t.line, inlineOnly);
        if (b.inline) { addInline(b.inline); continue; }
        addBlock(b);
        continue;
      }
      const r = this.command(name, st, t.line, { inlineOnly });
      if (r === undefined) continue;
      if (r.inline) addInline(r.inline);
      else if (r.inlines) r.inlines.forEach(addInline);
      else if (r.block) addBlock(r.block);
      else if (r.par) { flush(); contNext = false; }
    }
    if (until) throw new TexError(`\\begin{${until.slice(4)}} が閉じていない`, st.lastLine());
    flush();
    return blocks;
  }

  beginEnv(env, st, line, inlineOnly) {
    if (MATH_ENVS.has(env)) {
      const body = collectEnvBody(st, env, line);
      return this.mathDisplay(env, body, line);
    }
    if (env === 'solutionbox') {
      const title = readGroupTokens(st, 'solutionbox');
      this.counters.exercise++;
      const code = `${ROMAN[this.counters.part]}-${this.counters.section}-${this.counters.exercise}`;
      const number = this.counters.exercise;
      return this.withScope(() => {
        const titleInl = this.parseInline(title, line);
        const blocks = this.parseBlocks(st, { until: 'env:solutionbox' });
        const k = blocks.findIndex((b) => b.type === 'part');
        if (k < 0) throw new TexError('solutionbox の中に \\solutionpart がない', line);
        return {
          type: 'problem',
          id: `p${this.counters.section}-${number}`,
          number,
          code,
          title: titleInl,
          statement: blocks.slice(0, k),
          body: blocks.slice(k),
          line,
        };
      });
    }
    if (env === 'checkpointbox' || env === 'definitionbox') {
      const title = readGroupTokens(st, env);
      return this.withScope(() => ({
        type: 'record', env,
        title: this.parseInline(title, line),
        blocks: this.parseBlocks(st, { until: 'env:' + env }),
        line,
      }));
    }
    if (LIST_ENVS.has(env)) {
      readOptTokens(st); // enumitem の書式指定。HTML 側の CSS で同じ見た目にする
      return this.withScope(() => {
        const raw = this.parseBlocks(st, { until: 'env:' + env, listItems: true });
        const items = [];
        for (const b of raw) {
          if (b.type === 'item') items.push({ label: b.label, blocks: [] });
          else {
            if (!items.length) throw new TexError(`${env} の最初の \\item より前に中身がある`, line);
            items[items.length - 1].blocks.push(b);
          }
        }
        // \item の直後の段落は字下げしない
        for (const it of items) if (it.blocks[0]?.type === 'p') it.blocks[0].cont = true;
        return { type: 'list', kind: env, items, line };
      });
    }
    if (env === 'center' || env === 'quote') {
      return this.withScope(() => ({ type: env, blocks: this.parseBlocks(st, { until: 'env:' + env }), line }));
    }
    if (env === 'tabular' || env === 'tabularx') {
      if (env === 'tabularx') readGroupTokens(st, 'tabularx の幅');
      const spec = readGroupTokens(st, env + ' の列指定');
      const body = collectEnvBody(st, env, line);
      return this.withScope(() => this.table(spec, body, line));
    }
    if (env === 'tikzpicture') {
      const startTok = st.toks[st.i - 1];
      const body = collectEnvBody(st, env, line);
      void startTok;
      // 原稿の該当範囲をそのまま取り出す（図のコンパイル用）
      const src = this.sliceSourceByLines(line, env);
      const key = createHash('sha256').update(src).digest('hex').slice(0, 12);
      this.figures.push({ key, src, line, chapter: this.counters.section });
      void body;
      return { type: 'figure', key, line };
    }
    if (env === 'titlepage') {
      const blocks = this.withScope(() => this.parseBlocks(st, { until: 'env:titlepage' }));
      return { type: 'titlepage', blocks, line };
    }
    void inlineOnly;
    throw new TexError(`未対応の環境 ${env}`, line);
  }

  /** tikzpicture の原文を、原稿の行番号から取り出す。 */
  sliceSourceByLines(line, env) {
    const lines = this.src.split('\n');
    const startIdx = line - 1;
    const begin = lines[startIdx].indexOf(`\\begin{${env}}`);
    if (begin < 0) throw new TexError(`\\begin{${env}} を原稿の行から特定できない`, line);
    let k = startIdx;
    while (k < lines.length && !lines[k].includes(`\\end{${env}}`)) k++;
    const out = lines.slice(startIdx, k + 1);
    out[0] = out[0].slice(begin);
    const last = out.length - 1;
    out[last] = out[last].slice(0, out[last].indexOf(`\\end{${env}}`) + `\\end{${env}}`.length);
    return out.join('\n');
  }

  table(spec, body, line) {
    const cols = parseColSpec(serialize(spec), line);
    // 深さ 0 の \\ で行に、& でセルに分ける
    const rows = [];
    let cur = [[]];
    let depth = 0;
    let inMath = false;
    for (const t of body) {
      if (t.t === 'bgroup') depth++;
      if (t.t === 'egroup') depth--;
      if (t.t === 'mathshift') inMath = !inMath;
      if (depth === 0 && !inMath && t.t === 'cs' && t.v === '\\') { rows.push(cur); cur = [[]]; continue; }
      if (depth === 0 && !inMath && t.t === 'tab') { cur.push([]); continue; }
      cur[cur.length - 1].push(t);
    }
    rows.push(cur);
    const out = [];
    let pendingRule = null;
    for (const r of rows) {
      // 行頭の罫線命令を取り出す
      const first = r[0];
      const rules = [];
      while (true) {
        let k = 0;
        while (k < first.length && (first[k].t === 'space' || first[k].t === 'par')) k++;
        const t = first[k];
        if (t && t.t === 'cs' && ['toprule', 'midrule', 'bottomrule', 'hline'].includes(t.v)) {
          rules.push(t.v);
          first.splice(0, k + 1);
        } else break;
      }
      const empty = r.length === 1 && r[0].every((t) => t.t === 'space' || t.t === 'par');
      if (empty) {
        if (rules.length && out.length) out[out.length - 1].ruleBelow = rules[rules.length - 1];
        else if (rules.length) pendingRule = rules[rules.length - 1];
        continue;
      }
      if (r.length > cols.length) throw new TexError(`表の列が列指定より多い（${r.length} > ${cols.length}）`, line);
      const cells = r.map((c) => this.withScope(() => this.parseInline(c, line)));
      const row = { cells, ruleAbove: rules[rules.length - 1] ?? pendingRule ?? null };
      pendingRule = null;
      out.push(row);
    }
    return { type: 'table', cols, rows: out, line };
  }

  command(name, st, line, ctx) {
    // 利用者定義マクロ（本文で使われるのは \term のような書式マクロ）
    const m = this.scope.get(name);
    if (m) {
      st.unshift(this.expandOnce(m, st, name, line));
      return undefined;
    }
    if (name in IGNORE) {
      if (name === 'rule' || name === 'fontsize') { readOptTokens(st); }
      for (let k = 0; k < IGNORE[name]; k++) readGroupTokens(st, '\\' + name);
      if (name === 'par') return { par: true };
      return undefined;
    }
    switch (name) {
      case ' ': return { inline: { t: 'text', v: ' ' } };
      case ',': return { inline: { t: 'text', v: '\u2009' } };
      case 'quad': return { inline: { t: 'text', v: '\u2003' } };
      case 'qquad': return { inline: { t: 'text', v: '\u2003\u2003' } };
      case '%': case '#': case '{': case '}': case '&': case '_': case '$':
        return { inline: { t: 'text', v: name } };
      case '"': case '\'': case '`': case '^': case '~': case '=': case '.': {
        // 欧文のアクセント。結合文字を付けて NFC で合成する
        const COMB = { '"': '\u0308', "'": '\u0301', '`': '\u0300', '^': '\u0302', '~': '\u0303', '=': '\u0304', '.': '\u0307' };
        const a = readGroupTokens(st, '\\' + name);
        const base = serialize(a);
        if (!/^[A-Za-z]$/.test(base)) throw new TexError(`アクセント \\${name} の対象が1文字でない`, line);
        return { inline: { t: 'text', v: (base + COMB[name]).normalize('NFC') } };
      }
      case '\\': {
        // 行分割。\\[2mm] の間隔指定は読み飛ばす
        if (st.peek()?.t === 'char' && st.peek().v === '*') st.next();
        readOptTokens(st);
        return { inline: { t: 'br' } };
      }
      case 'vspace': {
        if (st.peek()?.t === 'char' && st.peek().v === '*') st.next();
        readGroupTokens(st, '\\vspace');
        return undefined;
      }
      case 'postdisplaypenalty': {
        // \postdisplaypenalty=10000 。改頁の調整なので表示には関係しない
        while (isSpace(st.peek())) st.next();
        if (st.peek()?.t === 'char' && st.peek().v === '=') st.next();
        while (st.peek()?.t === 'char' && /[0-9-]/.test(st.peek().v)) st.next();
        return undefined;
      }
      case '(': {
        const m2 = [];
        for (;;) {
          const u = st.next();
          if (!u) throw new TexError('\\( が閉じていない', line);
          if (u.t === 'cs' && u.v === ')') break;
          m2.push(u);
        }
        return { inline: this.mathInline(m2, line) };
      }
      case '[': {
        const m2 = [];
        for (;;) {
          const u = st.next();
          if (!u) throw new TexError('\\[ が閉じていない', line);
          if (u.t === 'cs' && u.v === ']') break;
          m2.push(u);
        }
        return { block: this.mathDisplay('display', m2, line) };
      }
      case 'textbf': return { inline: { t: 'strong', c: this.withScope(() => this.parseInline(readGroupTokens(st, '\\textbf'), line)) } };
      case 'emph': return { inline: { t: 'em', c: this.withScope(() => this.parseInline(readGroupTokens(st, '\\emph'), line)) } };
      // amsmath の \text は、文中で使うと引数をそのまま組む
      case 'text': return { inlines: this.withScope(() => this.parseInline(readGroupTokens(st, '\\text'), line)) };
      case 'textup': return { inlines: this.withScope(() => this.parseInline(readGroupTokens(st, '\\textup'), line)) };
      case 'texorpdfstring': {
        const a = readGroupTokens(st, '\\texorpdfstring');
        readGroupTokens(st, '\\texorpdfstring');
        return { inlines: this.withScope(() => this.parseInline(a, line)) };
      }
      case 'begingroup':
        this.scope = new Scope(this.scope);
        this.groupDepth++;
        return undefined;
      case 'endgroup':
        if (this.groupDepth === 0) throw new TexError('\\begingroup のない \\endgroup', line);
        this.scope = this.scope.parent;
        this.groupDepth--;
        return undefined;
      case 'newcommand': case 'renewcommand': {
        const nameTok = readGroupTokens(st, '\\' + name);
        if (nameTok.length !== 1 || nameTok[0].t !== 'cs') throw new TexError('\\newcommand の名前が読めない', line);
        const opt = readOptTokens(st);
        const body = readGroupTokens(st, '\\' + name);
        this.define(nameTok[0].v, opt ? Number(serialize(opt)) : 0, body, line, name === 'renewcommand');
        return undefined;
      }
      case 'setcounter': {
        const c = serialize(readGroupTokens(st, '\\setcounter'));
        const v = Number(serialize(readGroupTokens(st, '\\setcounter')));
        if (!(c in this.counters)) throw new TexError(`未知のカウンター ${c}`, line);
        this.counters[c] = v;
        return undefined;
      }
      case 'part': {
        const short = readOptTokens(st);
        const long = readGroupTokens(st, '\\part');
        this.counters.part++;
        return {
          block: {
            type: 'part', number: this.counters.part, roman: ROMAN[this.counters.part],
            short: short ? this.parseInline(short, line) : null,
            title: this.withScope(() => this.parseInline(long, line)), line,
          },
        };
      }
      case 'section': case 'subsection': case 'subsubsection': {
        const star = st.peek()?.t === 'char' && st.peek().v === '*' ? (st.next(), true) : false;
        const short = readOptTokens(st);
        const long = readGroupTokens(st, '\\' + name);
        if (!star) {
          if (name === 'section') {
            this.counters.section++;
            this.counters.subsection = 0;
            this.counters.equation = 0;
            this.counters.exercise = 0;
          } else if (name === 'subsection') this.counters.subsection++;
          else throw new TexError('番号付きの \\subsubsection には対応していない', line);
        }
        const level = { section: 2, subsection: 3, subsubsection: 4 }[name];
        return {
          block: {
            type: 'heading', level, star,
            number: star ? null : name === 'section' ? `${this.counters.section}` : `${this.counters.section}.${this.counters.subsection}`,
            short: short ? this.withScope(() => this.parseInline(short, line)) : null,
            title: this.withScope(() => this.parseInline(long, line)),
            runningTitle: this.runningTitle,
            line,
          },
        };
      }
      case 'solutionpart': case 'solutionfollowup': {
        const label = name === 'solutionpart' ? readGroupTokens(st, '\\solutionpart') : null;
        const a = readGroupTokens(st, '\\' + name);
        const b = readGroupTokens(st, '\\' + name);
        const c = readGroupTokens(st, '\\' + name);
        const labelText = name === 'solutionfollowup' ? 'まとめ' : serialize(label).trim();
        return {
          block: this.withScope(() => ({
            type: 'part',
            label: labelText,
            statement: this.withScope(() => this.parseBlocks(new Stream(a), { until: null })),
            approach: this.withScope(() => this.parseBlocks(new Stream(b), { until: null })),
            solution: this.withScope(() => this.parseBlocks(new Stream(c), { until: null })),
            line,
          })),
        };
      }
      case 'solutionprelude': {
        const a = readGroupTokens(st, '\\solutionprelude');
        return { block: { type: 'prelude', blocks: this.withScope(() => this.parseBlocks(new Stream(a), { until: null })), line } };
      }
      case 'problemformulas': {
        const a = readGroupTokens(st, '\\problemformulas');
        return { block: { type: 'formulas', blocks: this.withScope(() => this.parseBlocks(new Stream(a), { until: null })), line } };
      }
      case 'answerheading': {
        const a = readGroupTokens(st, '\\answerheading');
        return { block: { type: 'heading', level: 5, star: true, title: this.withScope(() => this.parseInline(a, line)), line } };
      }
      case 'answerconclusion': {
        const a = readGroupTokens(st, '\\answerconclusion');
        return { block: { type: 'conclusion', c: this.withScope(() => this.parseInline(a, line)), line } };
      }
      case 'label': {
        const lb = serialize(readGroupTokens(st, '\\label'));
        const id = 'l-' + sanitizeId(lb);
        this.labels.set(lb, { id, number: null, chapter: this.counters.section });
        return { inline: { t: 'anchor', id } };
      }
    }
    void ctx;
    throw new TexError(`未対応の命令 \\${name}`, line);
  }

  run() {
    const blocks = this.parseBlocks(new Stream(this.tokens), { until: null });
    if (this.groupDepth !== 0) throw new TexError(`\\begingroup が ${this.groupDepth} 個閉じていない`);
    return this.assemble(blocks);
  }

  assemble(blocks) {
    const doc = { titlepage: null, front: [], parts: [], chapters: [] };
    let chapter = null;
    let part = null;
    for (const b of blocks) {
      if (b.type === 'titlepage') { doc.titlepage = b; continue; }
      if (b.type === 'part') {
        part = { number: b.number, roman: b.roman, short: b.short, title: b.title, chapters: [] };
        doc.parts.push(part);
        chapter = null;
        continue;
      }
      if (b.type === 'heading' && b.level === 2 && !b.star) {
        chapter = {
          number: Number(b.number),
          slug: 'ch' + String(b.number).padStart(2, '0'),
          part: part?.number ?? null,
          title: b.title,
          tocTitle: b.short ?? b.title,
          runningTitle: b.runningTitle,
          line: b.line,
          blocks: [],
        };
        doc.chapters.push(chapter);
        part?.chapters.push(chapter.number);
        continue;
      }
      if (!chapter) {
        if (part) throw new TexError('部の見出しと最初の章の間に中身がある', b.line);
        doc.front.push(b);
      } else chapter.blocks.push(b);
    }
    return doc;
  }
}

function finishInlines(list) {
  // 隣り合う文字をまとめ、TeX の合字（-- → – など）を当てる。前後の空白を落とす。
  const out = [];
  for (const x of list) {
    const last = out[out.length - 1];
    if (x.t === 'text' && last && last.t === 'text') last.v += x.v;
    else out.push(x.t === 'text' ? { ...x } : x);
  }
  for (const x of out) {
    if (x.t === 'text') {
      x.v = x.v.replace(/ {2,}/g, ' ').replace(/---/g, '\u2014').replace(/--/g, '\u2013').replace(/'/g, '\u2019').replace(/`/g, '\u2018');
    }
  }
  if (out[0]?.t === 'text') out[0].v = out[0].v.replace(/^\s+/, '');
  const L = out[out.length - 1];
  if (L?.t === 'text') L.v = L.v.replace(/\s+$/, '');
  return out.filter((x) => !(x.t === 'text' && x.v === ''));
}

function parseColSpec(s, line) {
  const cols = [];
  let i = 0;
  let pendingStyle = null;
  const readBrace = () => {
    if (s[i] !== '{') throw new TexError(`列指定が読めない: ${s}`, line);
    let d = 0;
    const st = i;
    for (; i < s.length; i++) {
      if (s[i] === '{') d++;
      if (s[i] === '}' && --d === 0) { i++; return s.slice(st + 1, i - 1); }
    }
    throw new TexError(`列指定の { が閉じていない: ${s}`, line);
  };
  while (i < s.length) {
    const c = s[i++];
    if (/\s|\|/.test(c)) continue;
    if (c === '*') {
      const n = Number(readBrace());
      const rep = readBrace();
      s = s.slice(0, i) + rep.repeat(n) + s.slice(i);
      continue;
    }
    if (c === '>') { pendingStyle = readBrace(); continue; }
    if (c === '@') { readBrace(); continue; }
    const col = { align: 'left', bold: false, width: null };
    if (pendingStyle) { col.bold = /\\bfseries/.test(pendingStyle); col.sans = /\\sffamily/.test(pendingStyle); pendingStyle = null; }
    if (c === 'l') col.align = 'left';
    else if (c === 'c') col.align = 'center';
    else if (c === 'r') col.align = 'right';
    else if (c === 'p') { col.width = readBrace(); col.align = 'left'; }
    else if (c === 'X') { col.align = 'left'; col.width = 'X'; }
    else throw new TexError(`未対応の列指定 ${c}（${s}）`, line);
    cols.push(col);
  }
  return cols;
}

export function convertAnswers(src, opts) {
  const conv = new AnswersConverter(src, opts);
  const doc = conv.run();
  doc.labels = Object.fromEntries(conv.labels);
  doc.figures = conv.figures;
  doc.macroSets = conv.macroSets;
  doc.structural = conv.pre.structural;
  return doc;
}
