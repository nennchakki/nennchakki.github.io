// TeX の字句解析。TeX の読み取り規則（状態 N/M/S）に沿って、
// 制御綴・文字・空白・段落区切りの列に分ける。
// カテゴリーコードは LaTeX 文書本文の既定値を前提にする。
//
// LuaTeX-ja の規則を一つ再現する。
// 入力行が和文文字で終わるとき、行末は空白にならない。

const LETTER = /[A-Za-z]/;

// 和文文字として扱う範囲（この原稿で使う範囲）。欧文側（ギリシャ文字、– — … など）は含めない。
const JA = /[\u2E80-\u2FFF\u3000-\u303F\u3040-\u30FF\u3100-\u31FF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF\u2500-\u257F]/u;

export function isJaChar(ch) {
  return JA.test(ch);
}

export class TexError extends Error {
  constructor(message, line) {
    super(line ? `${message}（原稿 ${line} 行目）` : message);
    this.texLine = line;
  }
}

export function tokenize(src, opt = {}) {
  const toks = [];
  const n = src.length;
  let i = 0;
  let line = 1 + (opt.lineOffset ?? 0);
  let state = 'N';
  let start = 0;
  const push = (t, v) => toks.push({ t, v, line, pos: start, end: i });

  const lineEndsWithJa = (nlPos) => {
    let k = nlPos - 1;
    while (k >= 0 && (src[k] === ' ' || src[k] === '\t' || src[k] === '\r')) k--;
    if (k < 0) return false;
    const code = src.charCodeAt(k);
    const ch = code >= 0xdc00 && code <= 0xdfff && k > 0 ? src.slice(k - 1, k + 1) : src[k];
    return isJaChar(ch);
  };

  while (i < n) {
    const c = src[i];
    start = i;
    if (c === '\\') {
      i++;
      if (i >= n) throw new TexError('ファイル末尾に \\ がある', line);
      if (LETTER.test(src[i])) {
        let j = i;
        while (j < n && LETTER.test(src[j])) j++;
        const name = src.slice(i, j);
        i = j;
        push('cs', name);
        state = 'S';
      } else {
        const ch = src[i];
        i++;
        if (ch === '\n') {
          push('cs', ' ');
          line++;
          state = 'N';
        } else {
          push('cs', ch);
          state = ch === ' ' ? 'S' : 'M';
        }
      }
      continue;
    }
    if (c === '%') {
      while (i < n && src[i] !== '\n') i++;
      if (i < n) {
        i++;
        line++;
      }
      state = 'N';
      continue;
    }
    if (c === '\n') {
      i++;
      if (state === 'N') push('par');
      else if (state === 'M' && !lineEndsWithJa(i - 1)) push('space');
      line++;
      state = 'N';
      continue;
    }
    if (c === ' ' || c === '\t' || c === '\r') {
      i++;
      if (state === 'M') {
        push('space');
        state = 'S';
      }
      continue;
    }
    state = 'M';
    if (c === '{') { i++; push('bgroup', '{'); continue; }
    if (c === '}') { i++; push('egroup', '}'); continue; }
    if (c === '$') { i++; push('mathshift', '$'); continue; }
    if (c === '&') { i++; push('tab', '&'); continue; }
    if (c === '~') { i++; push('active', '~'); continue; }
    if (c === '#') {
      const d = src[i + 1];
      if (!/[1-9]/.test(d ?? '')) throw new TexError('# の後に引数番号がない', line);
      i += 2;
      push('param', d);
      continue;
    }
    const ch = String.fromCodePoint(src.codePointAt(i));
    i += ch.length;
    push('char', ch);
  }
  return toks;
}

/** トークン列を TeX の文字列へ戻す（数式を KaTeX へ渡すときに使う）。 */
export function serialize(tokens) {
  let out = '';
  for (let k = 0; k < tokens.length; k++) {
    const t = tokens[k];
    switch (t.t) {
      case 'cs':
        out += '\\' + t.v;
        if (LETTER.test(t.v[0])) {
          const nx = tokens[k + 1];
          if (nx && nx.t === 'char' && LETTER.test(nx.v)) out += ' ';
        }
        break;
      case 'char': out += t.v; break;
      case 'space': out += ' '; break;
      case 'par': out += '\n\n'; break;
      case 'bgroup': out += '{'; break;
      case 'egroup': out += '}'; break;
      case 'mathshift': out += '$'; break;
      case 'tab': out += '&'; break;
      case 'active': out += '~'; break;
      case 'param': out += '#' + t.v; break;
      default: throw new Error('serialize: unknown token ' + t.t);
    }
  }
  return out;
}
