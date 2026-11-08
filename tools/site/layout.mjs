// ページ共通の外枠。テーマごとの CSS はページの data-theme で切り替え、
// 作品ごとのスタイルは themes/<theme>.css に閉じ込める（他の作品へ影響しない）。

import { html, raw, esc } from './html.mjs';
import { haloMark } from './art/noa-halo.mjs';

export function page({ site, title, description, path, theme, css = [], body, head = '', breadcrumbs = null, assets }) {
  const fullTitle = title ? `${title}｜${site.title}` : site.title;
  const canonical = site.baseUrl + path;
  const styles = ['/assets/css/base.css', ...css].map((h) => `<link rel="stylesheet" href="${esc(assets(h))}">`).join('\n');
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(description ?? site.description)}">
<link rel="canonical" href="${esc(canonical)}">
<link rel="icon" href="${esc(assets('/assets/favicon.svg'))}" type="image/svg+xml">
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${esc(canonical)}">
${styles}
${head}
</head>
<body data-theme="${esc(theme)}">
<a class="skip" href="#main">本文へ移動</a>
${body}
${footer(site, breadcrumbs)}
</body>
</html>
`;
}

export function siteHeader({ current }) {
  return html`<header class="site-header">
<a class="site-mark" href="/">${raw(haloMark({ size: 22 }))}<span>nennchakki</span></a>
<nav aria-label="サイト">
<ul>
<li><a href="/"${current === 'home' ? raw(' aria-current="page"') : ''}>作品一覧</a></li>
</ul>
</nav>
</header>`;
}

function footer(site, breadcrumbs) {
  const crumbs = breadcrumbs
    ? `<nav class="crumbs" aria-label="現在位置"><ol>${breadcrumbs
        .map((b, i) => (i === breadcrumbs.length - 1 ? `<li><span aria-current="page">${esc(b.label)}</span></li>` : `<li><a href="${esc(b.href)}">${esc(b.label)}</a></li>`))
        .join('')}</ol></nav>`
    : '';
  return `<footer class="site-footer">
${crumbs}
<p>${esc(site.notice)}</p>
<p class="rights">${site.rights.map(esc).join('<br>')}</p>
<p class="rights">本文・解答の文章と数式の著作権は ${esc(site.circle)} に帰属します。</p>
</footer>`;
}
