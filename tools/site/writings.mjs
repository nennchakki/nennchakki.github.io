// 寄稿作品（合同誌に寄せた原稿）の表示。
// データは content/writings/works.json（作品）と anthologies.json（合同誌・頒布の機会・イベント）。
// 作品の本文や PDF は出さない。出すのは書誌情報と紹介文だけ。

import { html, raw, esc } from './html.mjs';

const STATUS_ORDER = { '頒布予定': 0, '初頒布': 1, '頒布済み': 2 };

function fmtDate(d) {
  if (!d) return null;
  const [y, m, day] = d.split('-').map(Number);
  const w = '日月火水木金土'[new Date(Date.UTC(y, m - 1, day)).getUTCDay()];
  return `${y}年${m}月${day}日（${w}）`;
}

/** 作品データを検査して、合同誌の情報と結び付けた形にする。 */
export function loadWritings(worksData, anthData) {
  const problems = [];
  const items = worksData.works.map((w) => {
    const book = anthData.books[w.book];
    if (!book) problems.push(`作品 ${w.id} の収録先 ${w.book} が anthologies.json にない`);
    for (const k of ['id', 'title', 'book', 'short', 'detail', 'characters', 'subjects', 'outline', 'visibility']) {
      if (w[k] === undefined || w[k] === null || (Array.isArray(w[k]) && !w[k].length)) problems.push(`作品 ${w.id} に ${k} がない`);
    }
    if (!['public', 'hold'].includes(w.visibility)) problems.push(`作品 ${w.id} の visibility が public / hold でない`);
    const dists = (book?.distributions ?? []).map((d) => {
      const ev = anthData.events[d.event];
      if (!ev) problems.push(`合同誌 ${w.book} のイベント ${d.event} がない`);
      return { ...d, eventName: ev?.name ?? d.event, venue: ev?.venue ?? null };
    });
    return { ...w, bookData: book, dists };
  });
  // 前作への参照を解決する（前作が公開されていないときは出さない）
  const byId = new Map(items.map((w) => [w.id, w]));
  for (const w of items) {
    if (!w.sequelOf) continue;
    const prev = byId.get(w.sequelOf);
    if (!prev) problems.push(`作品 ${w.id} の前作 ${w.sequelOf} がない`);
    w.sequelOf = prev && prev.visibility === 'public' ? { id: prev.id, title: prev.title } : null;
  }
  if (problems.length) throw new Error('寄稿作品のデータに問題がある:\n  ' + problems.join('\n  '));
  return items.filter((w) => w.visibility === 'public');
}

function sortKey(w) {
  // 頒布予定 → 頒布済み、同じ状態なら日付の新しい順
  const d = w.dists[0] ?? {};
  const s = Math.min(...w.dists.map((x) => STATUS_ORDER[x.status] ?? 9));
  const date = w.dists.map((x) => x.date).filter(Boolean).sort().pop() ?? '9999';
  return [s, date];
}
export function sortWritings(list) {
  return [...list].sort((a, b) => {
    const [sa, da] = sortKey(a); const [sb, db] = sortKey(b);
    if (sa !== sb) return sa - sb;
    return da < db ? 1 : da > db ? -1 : 0;
  });
}

function distLine(d) {
  const parts = [d.eventName];
  const date = fmtDate(d.date);
  parts.push(date ?? (d.day ? d.day : '日付は未告知'));
  if (date && d.day) parts.push(d.day);
  parts.push(d.space ?? '配置は未告知');
  return html`<li><span class="d-status">${d.status}</span>${parts.join('　')}</li>`;
}

/** トップページ用の短い一覧。題名・収録先・一覧用の紹介文と、詳細ページへのリンク。 */
export function writingsSummary(list) {
  return html`<ul class="contrib-list">
${list.map((w) => html`<li>
<p class="contrib-title"><a href="/writings/#${w.id}">${w.title}</a></p>
<p class="contrib-meta"><span>${w.bookData.title}</span><span>${w.dists.map((d) => `${d.eventName}${d.status === '頒布予定' ? '（頒布予定）' : ''}`).join('・')}</span></p>
<p class="contrib-topic">${w.short}</p>
</li>`)}
</ul>
<p class="ledger-more"><a href="/writings/">寄稿作品の詳細（${list.length}作品）</a></p>`;
}

/** 詳細ページの1作品分。 */
export function writingEntry(w, index) {
  const b = w.bookData;
  return html`<article class="writing" id="${w.id}" aria-labelledby="${w.id}-h">
<header class="writing-head">
<p class="writing-no" aria-hidden="true">${String(index + 1).padStart(2, '0')}</p>
<div>
<h2 id="${w.id}-h">${w.title}</h2>
<p class="writing-book">収録: ${b.title}${b.circle ? html`<span>${b.circle}</span>` : ''}</p>
</div>
</header>
<p class="writing-short">${w.short}</p>
<div class="writing-body">
<div class="writing-detail">${w.detail.split('\n').filter(Boolean).map((p) => html`<p>${p}</p>`)}</div>
<dl class="writing-meta">
<dt>登場人物</dt><dd>${w.characters.join('、')}</dd>
<dt>主題</dt><dd><ul class="tags">${w.subjects.map((s) => html`<li>${s}</li>`)}</ul></dd>
<dt>頒布</dt><dd><ul class="dists">${w.dists.map(distLine)}</ul></dd>
<dt>章立て</dt><dd><ol class="outline">${w.outline.map((o) => html`<li>${o}</li>`)}</ol></dd>
${w.sequelOf ? html`<dt>前作</dt><dd><a href="#${w.sequelOf.id}">${w.sequelOf.title}</a></dd>` : ''}
<dt>告知</dt><dd><ul class="srcs">${w.sources.map((s) => html`<li><a href="${s.url}" rel="noopener">${s.label}</a></li>`)}</ul></dd>
</dl>
</div>
</article>`;
}
