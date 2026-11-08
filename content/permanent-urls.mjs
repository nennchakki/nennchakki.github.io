// 固定 URL（印刷物の QR コードの行き先）。
// ここに書いた path は、公開後に消したり変えたりしない。
// tests/permanent.test.mjs が、ここにある path が dist に必ずあること、
// 過去に登録した path（tests/permanent-urls.lock）が消えていないことを確かめる。
export const PERMANENT = [
  {
    path: '/q/hiro-string/',
    work: 'hiro-string',
    links: [
      { label: '解答編の目次', href: '/works/hiro-string/answers/' },
      { label: '作品ページ', href: '/works/hiro-string/' },
    ],
  },
];
