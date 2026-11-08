// 中間表現（IR）を HTML にする。数式は KaTeX でサーバー側で組む（MathML も出力する）。
// 文章は IR の文字列をそのまま出し、言い換え・省略はしない。

import katex from 'katex';
import { esc, raw } from './html.mjs';

export class IrRenderer {
  constructor({ macroSets, figures, figureAlts, figureSvgs, problemsIndex }) {
    this.macroSets = macroSets;
    this.figures = figures;
    this.figureAlts = figureAlts;
    this.figureSvgs = figureSvgs;
    this.problemsIndex = problemsIndex;
    this.stats = { inlineMath: 0, displayMath: 0, figures: 0, tables: 0 };
  }

  katex(tex, display, macros, line) {
    try {
      return katex.renderToString(tex, {
        displayMode: display,
        throwOnError: true,
        output: 'htmlAndMathml',
        macros: { ...this.macroSets[macros] },
        strict: (code) => (code === 'unicodeTextInMathMode' ? 'ignore' : 'error'),
        trust: false,
      });
    } catch (e) {
      throw new Error(`数式を組めない（原稿 ${line} 行目）: ${e.message}`);
    }
  }

  inline(list) {
    let out = '';
    for (const x of list ?? []) {
      switch (x.t) {
        case 'text': out += esc(x.v); break;
        case 'math':
          this.stats.inlineMath++;
          out += this.katex(x.tex, false, x.macros, x.line);
          break;
        case 'strong': out += `<strong>${this.inline(x.c)}</strong>`; break;
        case 'em': out += `<em>${this.inline(x.c)}</em>`; break;
        case 'br': out += '<br>'; break;
        case 'anchor': out += `<span id="${esc(x.id)}"></span>`; break;
        default: throw new Error('未知のインライン要素 ' + x.t);
      }
    }
    return out;
  }

  blocks(list) {
    return (list ?? []).map((b) => this.block(b)).join('\n');
  }

  block(b) {
    switch (b.type) {
      case 'p':
        return `<p${b.cont ? ' class="cont"' : ''}>${this.inline(b.c)}</p>`;
      case 'math': {
        this.stats.displayMath++;
        const [first, ...rest] = b.anchors ?? [];
        const extra = rest.map((id) => `<span id="${esc(id)}"></span>`).join('');
        return `<div class="math-display"${first ? ` id="${esc(first)}"` : ''}>${extra}${this.katex(b.tex, true, b.macros, b.line)}</div>`;
      }
      case 'heading': {
        const tag = { 3: 'h2', 4: 'h3', 5: 'h5' }[b.level];
        if (!tag) throw new Error('見出しの深さが想定外 ' + b.level);
        const id = b.level === 3 && b.number ? ` id="s${esc(b.number.replace('.', '-'))}"` : '';
        const num = b.number ? `<span class="hnum">${esc(b.number)}</span>` : '';
        return `<${tag}${id} class="h-l${b.level}">${num}${this.inline(b.title)}</${tag}>`;
      }
      case 'problem': return this.problem(b);
      case 'part': return this.part(b);
      case 'prelude':
        return `<div class="prelude">${this.blocks(b.blocks)}</div>`;
      case 'formulas':
        return `<div class="formulas">${this.blocks(b.blocks)}</div>`;
      case 'conclusion':
        return `<p class="conclusion"><span class="therefore" aria-hidden="true">∴</span><span class="visually-hidden">結論：</span>${this.inline(b.c)}</p>`;
      case 'list': return this.list(b);
      case 'center':
        return `<div class="center">${this.blocks(b.blocks)}</div>`;
      case 'quote':
        return `<blockquote>${this.blocks(b.blocks)}</blockquote>`;
      case 'table': return this.table(b);
      case 'figure': return this.figure(b);
      case 'record':
        return `<section class="record"><h2 class="record-title">${this.inline(b.title)}</h2>${this.blocks(b.blocks)}</section>`;
      default:
        throw new Error('未知のブロック ' + b.type);
    }
  }

  problemTitle(title) {
    // 「確認　単位換算」の最初の語（難しさの区分）を、文字は変えずに印として分ける
    const first = title[0];
    if (first?.t === 'text') {
      const k = first.v.indexOf('　');
      if (k > 0) {
        const kind = first.v.slice(0, k);
        const rest = [{ t: 'text', v: first.v.slice(k + 1) }, ...title.slice(1)];
        return `<span class="kind">${esc(kind)}</span><span class="sep">　</span><span class="ptitle">${this.inline(rest)}</span>`;
      }
    }
    return `<span class="ptitle">${this.inline(title)}</span>`;
  }

  problem(b) {
    this.currentProblem = b;
    const statement = b.statement.length ? `<div class="statement">${this.blocks(b.statement)}</div>` : '';
    const out = `<article class="problem" id="${esc(b.id)}" aria-labelledby="${esc(b.id)}-h">
<header class="problem-head"><h3 id="${esc(b.id)}-h"><span class="pnum">第${b.number}問</span>${this.problemTitle(b.title)}</h3><span class="pcode">（${esc(b.code)}）</span></header>
${statement}
${this.blocks(b.body)}
</article>`;
    this.currentProblem = null;
    return out;
  }

  part(b) {
    const p = this.currentProblem;
    const label = b.label === '' ? '問題' : `(${b.label})`;
    const slug = b.label === '' ? 'q' : b.label === 'まとめ' ? 'sum' : b.label;
    const id = p ? `${p.id}-${slug}` : null;
    return `<section class="part"${id ? ` id="${esc(id)}"` : ''}>
<div class="part-statement"><p class="part-label">${esc(label)}</p>${this.blocks(b.statement)}</div>
<h4 class="part-h">考え方</h4>
<div class="approach">${this.blocks(b.approach)}</div>
<h4 class="part-h">解いてみる</h4>
<div class="solution">${this.blocks(b.solution)}</div>
<p class="qed"><span aria-hidden="true">□</span><span class="visually-hidden">${esc(label)}の終わり</span></p>
</section>`;
  }

  list(b) {
    if (b.kind === 'description') {
      return `<dl class="desc">${b.items.map((it) => `<dt>${this.inline(it.label)}</dt><dd>${this.blocks(it.blocks)}</dd>`).join('')}</dl>`;
    }
    const tag = b.kind === 'enumerate' ? 'ol' : 'ul';
    for (const it of b.items) if (it.label) throw new Error(`${b.kind} の \\item[...] には対応していない（原稿 ${b.line} 行目）`);
    return `<${tag} class="${b.kind}">${b.items.map((it) => `<li>${this.blocks(it.blocks)}</li>`).join('')}</${tag}>`;
  }

  table(b) {
    this.stats.tables++;
    const rows = b.rows.map((r) => {
      const cls = [r.ruleAbove ? 'rule-' + r.ruleAbove : '', r.ruleBelow ? 'rule-below-' + r.ruleBelow : ''].filter(Boolean).join(' ');
      const cells = r.cells.map((c, i) => {
        const col = b.cols[i] ?? b.cols[b.cols.length - 1];
        const cc = [`a-${col.align}`, col.bold ? 'b' : '', col.sans ? 'sans' : ''].filter(Boolean).join(' ');
        return `<td class="${cc}">${this.inline(c)}</td>`;
      }).join('');
      return `<tr${cls ? ` class="${cls}"` : ''}>${cells}</tr>`;
    }).join('');
    return `<div class="table-wrap"><table class="tex-table">${rows}</table></div>`;
  }

  figure(b) {
    this.stats.figures++;
    const alt = this.figureAlts[b.key];
    const svg = this.figureSvgs[b.key];
    if (!alt) throw new Error(`図 ${b.key}（原稿 ${b.line} 行目）の代替テキストが figures.json にない`);
    if (!svg) throw new Error(`図 ${b.key} の SVG がスナップショットにない`);
    const body = svg.replace(/^<\?xml[^>]*>\s*/, '').replace(/<svg /, `<svg role="img" aria-label="${esc(alt)}" `);
    return `<figure class="tex-figure" data-key="${esc(b.key)}">${body}</figure>`;
  }
}

export { raw };
