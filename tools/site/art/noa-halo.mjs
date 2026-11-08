// 生塩ノアのヘイローを、基本図形（楕円・弧）から組み立てる。
// 寸法と色は research/noa.md §2・§3 の計測値（公式画像からの推定）による。
// 公式画像の線はなぞっていない。
//
// 構成（外環の外周の半径を R=100 とする）
//   外環: 灰色 #C5C5D4 の帯（幅 0.14R）。外周に暗い輪郭線、上縁に白いハイライト。
//   青い区画: 外環のうち 95°〜155°（0°=右、90°=奥）。上縁は #C0ECFC。
//   内周面: 手前側にだけ見える濃紺 #2A2A5C の三日月（最大幅 0.07〜0.08R）。中央に破線 #4C7CBE（周期 20°）。
//   内側の円: シアン #8DEFFC の細線。半径 0.53R、外環より 0.10R 下。

const C = {
  band: '#C5C5D4',
  blue: '#548ED4',
  blueHi: '#C0ECFC',
  inner: '#2A2A5C',
  dash: '#4C7CBE',
  cyan: '#8DEFFC',
  line: '#42424B',
};

const rad = (d) => (d * Math.PI) / 180;
const f = (x) => Number(x.toFixed(2));
function pt(rx, ry, deg, cy = 0) {
  return [f(rx * Math.cos(rad(deg))), f(cy - ry * Math.sin(rad(deg)))];
}
/** 楕円上の弧（角度は数学の向き。画面では反時計回り）。 */
function arc(rx, ry, from, to, cy = 0) {
  const [x1, y1] = pt(rx, ry, from, cy);
  const [x2, y2] = pt(rx, ry, to, cy);
  const large = Math.abs(to - from) > 180 ? 1 : 0;
  return `M${x1} ${y1}A${rx} ${ry} 0 ${large} 0 ${x2} ${y2}`;
}

/**
 * 斜めから見たヘイロー。ページの大きな装飾用。
 * @param {{id:string, ratio?:number, tilt?:number, title?:string}} o
 */
export function haloOblique({ id, ratio = 0.52, tilt = -6, title }) {
  const R = 100;
  const w = 14;
  const ryOut = R * ratio;           // 外周
  const rxMid = R - w / 2;           // 帯の中心線
  const ryMid = ryOut - w / 2;
  const rxIn = R - w;                // 内周
  const ryIn = ryOut - w;
  const crescent = 8;                // 内周面の見かけの最大幅
  const label = title ? `<title>${title}</title>` : '';
  return `<svg class="halo halo-oblique" viewBox="-112 -82 224 164" xmlns="http://www.w3.org/2000/svg" ${title ? 'role="img"' : 'aria-hidden="true" focusable="false"'}>${label}
<defs>
  <mask id="${id}-m" maskUnits="userSpaceOnUse" x="-120" y="-80" width="240" height="160">
    <ellipse rx="${rxIn}" ry="${f(ryIn)}" fill="#fff"/>
    <ellipse cy="${-crescent}" rx="${rxIn}" ry="${f(ryIn)}" fill="#000"/>
  </mask>
</defs>
<g transform="rotate(${tilt})">
  <g mask="url(#${id}-m)">
    <ellipse rx="${rxIn}" ry="${f(ryIn)}" fill="${C.inner}"/>
    <ellipse class="halo-dash" cy="${-crescent / 2}" rx="${rxIn}" ry="${f(ryIn)}" fill="none" stroke="${C.dash}" stroke-width="2.4" pathLength="360" stroke-dasharray="10 10"/>
  </g>
  <ellipse rx="${rxMid}" ry="${f(ryMid)}" fill="none" stroke="${C.band}" stroke-width="${w}"/>
  <path d="${arc(rxMid, ryMid, 95, 155)}" fill="none" stroke="${C.blue}" stroke-width="${w}"/>
  <path d="${arc(R - 1.6, ryOut - 1.6, 18, 95)}" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>
  <path d="${arc(R - 1.6, ryOut - 1.6, 155, 172)}" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>
  <path d="${arc(R - 1.8, ryOut - 1.8, 95, 155)}" fill="none" stroke="${C.blueHi}" stroke-width="2.8"/>
  <ellipse rx="${R}" ry="${f(ryOut)}" fill="none" stroke="${C.line}" stroke-width="0.9"/>
  <ellipse rx="${rxIn}" ry="${f(ryIn)}" fill="none" stroke="${C.line}" stroke-width="0.7"/>
  <ellipse class="halo-cyan" cy="10" rx="53" ry="${f(53 * 0.46)}" fill="none" stroke="${C.cyan}" stroke-width="2.2"/>
</g>
</svg>`;
}

/** 真上から見た形に平面化したヘイロー（小さな記号・ファビコン用）。 */
export function haloMark({ size = 32, cls = 'halo-mark', title } = {}) {
  const label = title ? `<title>${title}</title>` : '';
  const [bx1, by1] = pt(90, 90, 95);
  const [bx2, by2] = pt(90, 90, 155);
  return `<svg class="${cls}" width="${size}" height="${size}" viewBox="-100 -100 200 200" xmlns="http://www.w3.org/2000/svg" ${title ? 'role="img"' : 'aria-hidden="true" focusable="false"'}>${label}
<circle r="90" fill="none" stroke="${C.band}" stroke-width="13"/>
<path d="M${bx1} ${by1}A90 90 0 0 0 ${bx2} ${by2}" fill="none" stroke="${C.blue}" stroke-width="13"/>
<circle r="96.5" fill="none" stroke="${C.line}" stroke-width="2"/>
<circle r="79" fill="none" stroke="${C.inner}" stroke-width="9"/>
<circle r="79" fill="none" stroke="${C.dash}" stroke-width="3" pathLength="360" stroke-dasharray="10 10"/>
<circle r="51" fill="none" stroke="#5FCDE0" stroke-width="5"/>
</svg>`;
}

export const NOA_COLORS = C;
