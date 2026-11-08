// 篠澤広の目元を、基本図形から組み立てる（抽象化した描写。公式画像はなぞらない）。
// 比率と色は research/hiro.md §2.6・§3 の計測値による。
// 座標は「目の開口部の横幅 = 100」。原点は目尻側の開口端と上まつ毛の帯の上端。
// 目尻が左、目頭が右になる向き（キャラクターの右目）。左目は左右反転して使う。
//
// 残す要素（§5.1 の優先順）
//   1. 橙赤の虹彩と、底の黄色い三日月
//   2. 淡いグレーベージュの上まつ毛の帯、上へ立つ突起 2 本、目尻へ伸びる尾、目頭の鉤
//   3. ピンクの二重線
//   4. 細く淡い高い眉
//   5. 黒いヘアピン 2 本（左目の上だけ）
//   下まつ毛は虹彩の真下だけ、下向きのとげ 4 本。

export const HIRO = {
  irisRim: '#55170A',
  irisDark: '#6E2010',
  irisMid: '#9F4024',
  iris: '#D85513',
  irisLight: '#FD9E44',
  irisLow: '#FFF484',
  lash: '#C3B6AA',
  lashLine: '#857C74',
  lid: '#E29F99',
  brow: '#A89A8E',
  hair: '#ECE1CD',
  hairTip: '#6F645E',
  pin: '#564E49',
  skin: '#FFF2E8',
  white: '#FBF8F5',
};

/** 片目。ids は同じページに複数置くときの衝突よけ。 */
export function eye(id, { pins = false, detail = true } = {}) {
  const H = HIRO;
  const opening = 'M2,31 C16,21 32,17 47,17 C66,17 86,21 99,30 C101,50 97,72 87,86 C75,95 61,97 47,97 C33,97 20,94 10,86 C3,74 0,52 2,31 Z';
  return `<g class="eye">
  <path class="brow" d="M-33,-48 C-8,-82 28,-100 67,-98 C88,-97 106,-90 119,-81" fill="none" stroke="${H.brow}" stroke-width="3.2" stroke-linecap="round"/>
  <path class="lid" d="M36,-9 C52,-17 70,-20 84,-17 C91,-15 96,-12 99,-7" fill="none" stroke="${H.lid}" stroke-width="3.6" stroke-linecap="round"/>
  <clipPath id="${id}-open"><path d="${opening}"/></clipPath>
  <path d="${opening}" fill="${H.white}"/>
  <g clip-path="url(#${id}-open)">
    <path d="M0,29 C30,17 70,17 100,29 L100,40 C70,30 30,30 0,40 Z" fill="#D9CFD3" opacity="0.9"/>
    <ellipse class="iris" cx="48" cy="56" rx="37" ry="37" fill="${H.irisMid}"/>
    <ellipse cx="48" cy="56" rx="37" ry="37" fill="none" stroke="${H.irisRim}" stroke-width="3.2"/>
    <path d="M13,56 C13,36 28,24 48,24 C68,24 83,36 83,56 C76,46 64,42 48,42 C32,42 20,46 13,56 Z" fill="${H.irisDark}"/>
    <path class="iris-light" d="M16,58 C17,80 30,91 48,91 C66,91 79,80 80,58 L73,63 L69,54 L62,64 L56,52 L48,62 L40,52 L34,64 L27,54 L23,63 Z" fill="${H.irisLight}"/>
    <path d="M26,84 C34,77 62,77 70,84 C62,91 34,91 26,84 Z" fill="${H.irisLow}"/>
    ${detail ? `<path d="M31,85 C40,81 56,81 65,85" fill="none" stroke="#F6C85A" stroke-width="1"/>` : ''}
    <ellipse class="pupil" cx="48" cy="52" rx="13" ry="20" fill="${H.irisRim}"/>
    <circle cx="49" cy="66" r="2.6" fill="${H.iris}"/>
    <circle class="hl" cx="45" cy="30" r="6.4" fill="#fff"/>
    <circle cx="66" cy="40" r="3" fill="#FFD2B0"/>
    ${detail ? `<circle cx="17" cy="86" r="1.8" fill="#fff"/><circle cx="79" cy="86" r="1.8" fill="#fff"/>` : ''}
  </g>
  <path class="lash" d="M-40,13 C-28,11 -16,10 -7,11 L-11,-3 C-4,1 2,5 6,8 L23,-8 C26,-3 29,1 31,4 C52,1 77,4 95,13 C102,19 103,30 100,44 C97,36 93,31 87,28 C70,21 52,19 46,19 C30,19 14,23 0,31 C-12,38 -26,48 -40,56 C-28,44 -18,36 -11,30 C-20,24 -30,18 -40,13 Z" fill="${H.lash}" stroke="${H.lashLine}" stroke-width="1.5" stroke-linejoin="miter"/>
  ${detail ? `<path d="M50,8 C64,8 78,11 88,16" fill="none" stroke="#fff" stroke-width="1.2" opacity="0.7"/>` : ''}
  <path class="lower-lash" d="M20,91 C36,94 60,94 78,91 M29,92 L27,99 M42,93.5 L41,101 M55,93.5 L56,101 M68,92.5 L70,99" fill="none" stroke="${H.lashLine}" stroke-width="1.6" stroke-linecap="round"/>
  ${pins ? `<g class="pins"><path d="M78,-150 L118,-122" stroke="${H.pin}" stroke-width="7" stroke-linecap="round"/><path d="M92,-163 L132,-135" stroke="${H.pin}" stroke-width="7" stroke-linecap="round"/></g>` : ''}
</g>`;
}

/** 前髪の細い束（縦の細線）。x は位置、h は長さ。 */
function strands(list) {
  return list
    .map(([x, y1, y2, bend, w, col]) => `<path d="M${x},${y1} C${x + bend},${(y1 + y2) / 2} ${x + bend * 0.6},${y2 - 30} ${x + bend * 0.2},${y2}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round"/>`)
    .join('');
}

/**
 * PC 用：両目を水平に並べた横長の図（§5.2）。
 * viewBox 1600×700。両目の中心は高さの約 58%、目の幅は画面幅の約 16%。
 */
export function eyesWide() {
  const H = HIRO;
  const s = 2.6;  // 目の幅 100 → 260（画面幅 1600 の 16%）
  const rightEye = `<g transform="translate(450,330) scale(${s})">${eye('hw-r')}</g>`;
  const leftEye = `<g transform="translate(1150,330) scale(${-s},${s})">${eye('hw-l', { pins: true })}</g>`;
  return `<svg class="hiro-eyes hiro-eyes-wide" viewBox="0 0 1600 700" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
<rect width="1600" height="700" fill="${H.skin}"/>
<ellipse cx="380" cy="640" rx="190" ry="60" fill="#FFE2DA" opacity="0.6"/>
<ellipse cx="1220" cy="640" rx="190" ry="60" fill="#FFE2DA" opacity="0.6"/>
${rightEye}
${leftEye}
${strands([
    [120, -20, 720, 30, 5, H.hair], [176, -20, 720, 20, 3, '#D8CCB8'], [610, -20, 560, -18, 3, '#D8CCB8'],
    [1000, -20, 520, 16, 2.5, '#D8CCB8'], [1450, -20, 720, -26, 5, H.hair], [1500, -20, 720, -16, 3, '#CFC3B1'],
  ])}
</svg>`;
}

/**
 * スマートフォン用：広の左目だけのクローズアップ（§5.3）。
 * viewBox 600×900。目の幅（尾を含む）は画面幅の約 76%、目の中心は高さの約 40%。
 */
export function eyeTall() {
  // 縦に「ヘアピン → 眉 → 二重線 → 目 → 下まつ毛 → 頬」が並ぶ（§5.3）。
  // viewBox 600×960。目の幅（尾を含む）は画面幅の約 73%。
  const H = HIRO;
  const s = 3.1;
  return `<svg class="hiro-eyes hiro-eyes-tall" viewBox="0 0 600 960" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
<rect width="600" height="960" fill="${H.skin}"/>
<g transform="translate(420,470) scale(${-s},${s})">${eye('ht-l', { pins: true })}</g>
${strands([[46, -20, 980, 24, 5, H.hair], [90, -20, 980, 14, 2.5, '#D8CCB8'], [566, -20, 980, -20, 4, '#D8CCB8']])}
<ellipse cx="300" cy="900" rx="220" ry="56" fill="#FFE2DA" opacity="0.55"/>
</svg>`;
}
