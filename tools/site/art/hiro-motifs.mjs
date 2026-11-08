// 『篠澤広に超弦理論を教えてもらう本』の作品ページの意匠。顔は描かない。
// 根拠は docs/research/hiro.md。
//   - ヘアピン 2 本（§4, §5.1。目元以外で最も強い識別子）: 平行な濃い斜線 2 本 #564E49
//   - 虹彩の層（§2.2）: 縁 → 暗部 → 中間 → 代表色 → 明部 → 底の三日月、の色の並び
//   - まつ毛の色（§2.3）: 淡いグレーベージュ #C3B6AA、輪郭 #857C74
// 作品の内容に根拠がある図として、両端固定の弦の固有振動 y_n(x) = A_n sin(nπx/ℓ)（n = 1〜4）を描く。
// 別冊解答 第3章「弦を分解する準備--波動方程式とFourier展開」の固定端の固有関数（原稿 3289〜3318 行目付近）。
// 端は y(0)=y(ℓ)=0 で固定される。振幅は 1/n に比例させた（図の見やすさのためで、物理的な意味は持たせない）。

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

const f = (x) => Number(x.toFixed(1));

/** ヘアピン 2 本。見出しの印やサークル名の前に置く小さな記号。 */
export function hairpins({ size = 18, cls = 'hairpins' } = {}) {
  return `<svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M3 9 L11 2 M8 17 L17 9" stroke="${HIRO.pin}" stroke-width="2.6" stroke-linecap="round" fill="none"/></svg>`;
}

function mode(n, amp, x0, x1, y0, phase = 1) {
  const pts = [];
  const N = 120;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    pts.push(`${f(x0 + (x1 - x0) * t)} ${f(y0 - phase * amp * Math.sin(n * Math.PI * t))}`);
  }
  return 'M' + pts.join(' L');
}

/**
 * 両端固定の弦の固有振動。n=1 を虹彩の色で描き、ほかはまつ毛の色。破線は n=1 の半周期後の形。
 */
export function stringModes() {
  const H = HIRO;
  const x0 = 60, x1 = 540, y0 = 200;
  const post = (x) => `<path d="M${x} 130 L${x} 270" stroke="${H.lashLine}" stroke-width="1.4"/>
<path d="M${x - 9} 270 L${x + 9} 270" stroke="${H.lashLine}" stroke-width="1.4"/>`;
  const others = [4, 3, 2]
    .map((n, i) => `<path d="${mode(n, 110 / n, x0, x1, y0)}" fill="none" stroke="${i === 2 ? H.lashLine : H.lash}" stroke-width="${i === 2 ? 1.6 : 1.3}"/>`)
    .join('\n');
  return `<svg class="string-modes" viewBox="0 0 600 340" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
${post(x0)}
${post(x1)}
<path d="M${x0} ${y0} L${x1} ${y0}" stroke="${H.lash}" stroke-width="1" stroke-dasharray="2 6"/>
${others}
<path d="${mode(1, 110, x0, x1, y0, -1)}" fill="none" stroke="${H.irisLight}" stroke-width="1.4" stroke-dasharray="6 6"/>
<path class="mode-1" d="${mode(1, 110, x0, x1, y0)}" fill="none" stroke="${H.iris}" stroke-width="3"/>
<circle cx="${x0}" cy="${y0}" r="4.5" fill="${H.irisDark}"/>
<circle cx="${x1}" cy="${y0}" r="4.5" fill="${H.irisDark}"/>
</svg>`;
}
