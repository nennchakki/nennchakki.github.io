// 『篠澤広に超弦理論を教えてもらう本』の作品ページの意匠。顔は描かない。
// 根拠は docs/research/hiro.md。
//   - ヘアピン 2 本（§4, §5.1。目元以外で最も強い識別子）: 平行な濃い斜線 2 本 #564E49
//   - 虹彩の層（§2.2）: 縁 → 暗部 → 中間 → 代表色 → 明部 → 底の三日月、の色の並び
//   - まつ毛の色（§2.3）: 淡いグレーベージュ #C3B6AA、輪郭 #857C74

export const HIRO = {
  irisRim: '#55170A',
  irisDark: '#6E2010',
  irisMid: '#9F4024',
  iris: '#D85513',
  irisLight: '#FD9E44',
  irisLow: '#FFF484',
  lash: '#C3B6AA',
  lashLine: '#857C74',
  pin: '#564E49',
  hair: '#ECE1CD',
  hairTip: '#6F645E',
};

/** ヘアピン 2 本。見出しの印やサークル名の前に置く小さな記号。 */
export function hairpins({ size = 18, cls = 'hairpins' } = {}) {
  return `<svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M3 9 L11 2 M8 17 L17 9" stroke="${HIRO.pin}" stroke-width="2.6" stroke-linecap="round" fill="none"/></svg>`;
}

