// 篠澤広のちびぐるみ風の絵（座った姿のぬいぐるみ）。公式画像はなぞらず、基本図形で描く。
// 色と形の根拠: docs/research/hiro.md と、公式立ち絵の観察（2026-11-09。画像は .private/ にあり公開しない）。
//   髪: 根元 #ECE1CD → 毛先 #6F645E。長いストレート。前髪を分けて額を出す。
//   ヘアピン 2 本（向かって右上、平行な斜線）#564E49。
//   瞳: 縁 #55170A、中間 #9F4024、代表色 #D85513、明部 #FD9E44、底の三日月 #FFF484。まつ毛は淡いグレーベージュ。
//   服: 生成りのカーディガン #F4F4EC（袖口に葉の柄の帯 #CCC4B8）、白いブラウスと橙の編み上げの紐 #FC9468、
//       編んだ濃い色のベルト #5C504C、デニムのショートパンツ #A8BCFC（影 #7484C0）。
//   靴は公式立ち絵の範囲外で確認できないため、ぬいぐるみの足として無地の布にした。

const C = {
  hair: '#ECE1CD',
  hairMid: '#C9BBAA',
  hairTip: '#6F645E',
  line: '#857C74',
  skin: '#FFF3E8',
  blush: '#FFCFC6',
  rim: '#55170A',
  irisMid: '#9F4024',
  iris: '#D85513',
  irisLight: '#FD9E44',
  irisLow: '#FFF484',
  lash: '#B9AC9F',
  brow: '#B3A496',
  pin: '#564E49',
  cardigan: '#F4F4EC',
  cardiganShade: '#DCD3C5',
  band: '#CCC4B8',
  blouse: '#FBFAF6',
  cord: '#FC9468',
  belt: '#5C504C',
  denim: '#A8BCFC',
  denimShade: '#7484C0',
  foot: '#E9DFD2',
  seam: '#A89C90',
};

/** @param {{id?: string, label?: string}} o */
export function hiroPlush({ id = 'plush', label = '篠澤広のちびぐるみ風の絵。座った姿のぬいぐるみで、淡い色の長い髪にヘアピンが2本、橙赤の瞳、生成りのカーディガンにデニムのショートパンツ。' } = {}) {
  const eye = (cx, flip) => {
    const s = flip ? -1 : 1;
    return `<g transform="translate(${cx} 196) scale(${s * 1.45} 1.45)">
  <ellipse rx="17" ry="21" fill="${C.irisMid}"/>
  <path d="M-17 2 A17 21 0 0 0 17 2 L12 6 L7 0 L2 7 L-3 0 L-8 7 L-13 1 Z" fill="${C.irisLight}"/>
  <path d="M-10 13 Q0 8 10 13 Q0 21 -10 13 Z" fill="${C.irisLow}"/>
  <ellipse cx="0" cy="-2" rx="6" ry="9" fill="${C.rim}"/>
  <ellipse rx="17" ry="21" fill="none" stroke="${C.rim}" stroke-width="2.4"/>
  <circle cx="-4" cy="-10" r="5" fill="#fff"/>
  <circle cx="7" cy="-4" r="2.2" fill="#FFE2CC"/>
  <path d="M-19 -12 Q0 -27 19 -14" fill="none" stroke="${C.lash}" stroke-width="5" stroke-linecap="round"/>
  <path d="M-17 -15 L-27 -19 M-18 -12 L-28 -11" stroke="${C.lash}" stroke-width="3" stroke-linecap="round"/>
</g>`;
  };
  return `<svg class="hiro-plush" viewBox="0 0 400 440" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${label}">
<defs>
  <linearGradient id="${id}-hair" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${C.hair}"/>
    <stop offset="0.62" stop-color="${C.hair}"/>
    <stop offset="0.82" stop-color="${C.hairMid}"/>
    <stop offset="1" stop-color="${C.hairTip}"/>
  </linearGradient>
  <linearGradient id="${id}-head" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#F4EBDA"/>
    <stop offset="1" stop-color="${C.hair}"/>
  </linearGradient>
  <radialGradient id="${id}-soft" cx="0.4" cy="0.35" r="0.75">
    <stop offset="0" stop-color="#fff" stop-opacity="0.55"/>
    <stop offset="1" stop-color="#fff" stop-opacity="0"/>
  </radialGradient>
</defs>
<ellipse cx="200" cy="425" rx="130" ry="10" fill="#000" opacity="0.06"/>
<g class="plush-body">
  <!-- 後ろ髪（長いストレート、毛先が暗い） -->
  <path d="M86 150 C70 230 64 320 78 392 Q96 404 112 392 L120 300 L280 300 L288 392 Q304 404 322 392 C336 320 330 230 314 150 Z" fill="url(#${id}-hair)" stroke="${C.line}" stroke-width="2"/>
  <!-- 足（座った姿） -->
  <ellipse cx="160" cy="400" rx="30" ry="20" fill="${C.foot}" stroke="${C.line}" stroke-width="2"/>
  <ellipse cx="240" cy="400" rx="30" ry="20" fill="${C.foot}" stroke="${C.line}" stroke-width="2"/>
  <path d="M146 396 Q160 388 174 396 M226 396 Q240 388 254 396" fill="none" stroke="${C.seam}" stroke-width="1.4" stroke-dasharray="3 3"/>
  <!-- 胴: ブラウス -->
  <path d="M148 262 L252 262 L262 352 L138 352 Z" fill="${C.blouse}" stroke="${C.line}" stroke-width="2"/>
  <!-- 編み上げの紐 -->
  <path d="M192 268 L208 278 L192 288 L208 298 M208 268 L192 278 L208 288 L192 298" fill="none" stroke="${C.cord}" stroke-width="2.6" stroke-linecap="round"/>
  <path d="M200 298 Q196 316 190 330 M200 298 Q206 318 212 334" fill="none" stroke="${C.cord}" stroke-width="2.2" stroke-linecap="round"/>
  <!-- ベルトとショートパンツ -->
  <path d="M138 344 L262 344 L264 386 Q232 392 200 388 Q168 392 136 386 Z" fill="${C.denim}" stroke="${C.line}" stroke-width="2"/>
  <path d="M200 356 L200 388" stroke="${C.denimShade}" stroke-width="1.6"/>
  <rect x="136" y="338" width="128" height="11" rx="5" fill="${C.belt}"/>
  <path d="M142 343.5 L258 343.5" stroke="#80746C" stroke-width="2" stroke-dasharray="5 4"/>
  <!-- カーディガン（前を開けて羽織る） -->
  <path d="M146 258 Q122 270 120 300 L124 360 L168 360 L176 300 L184 262 Z" fill="${C.cardigan}" stroke="${C.line}" stroke-width="2"/>
  <path d="M254 258 Q278 270 280 300 L276 360 L232 360 L224 300 L216 262 Z" fill="${C.cardigan}" stroke="${C.line}" stroke-width="2"/>
  <!-- 袖（大きめ）と袖口の柄の帯 -->
  <path d="M128 268 Q96 286 92 330 L96 356 L136 356 L140 320 Z" fill="${C.cardigan}" stroke="${C.line}" stroke-width="2"/>
  <path d="M272 268 Q304 286 308 330 L304 356 L264 356 L260 320 Z" fill="${C.cardigan}" stroke="${C.line}" stroke-width="2"/>
  <path d="M95 338 L137 338 L136 356 L96 356 Z M263 338 L305 338 L304 356 L264 356 Z" fill="${C.band}"/>
  <path d="M102 347 l5 -4 l5 4 M114 347 l5 -4 l5 4 M126 347 l4 -4 l4 4 M270 347 l5 -4 l5 4 M282 347 l5 -4 l5 4 M294 347 l4 -4 l4 4" fill="none" stroke="#F8F6F0" stroke-width="1.6"/>
  <ellipse cx="116" cy="362" rx="14" ry="10" fill="${C.skin}" stroke="${C.line}" stroke-width="2"/>
  <ellipse cx="284" cy="362" rx="14" ry="10" fill="${C.skin}" stroke="${C.line}" stroke-width="2"/>
  <path d="M120 300 L124 352 M280 300 L276 352" stroke="${C.seam}" stroke-width="1.4" stroke-dasharray="3 3"/>
  <!-- 頭 -->
  <path d="M200 52 C108 52 70 112 72 170 C74 236 124 268 200 268 C276 268 326 236 328 170 C330 112 292 52 200 52 Z" fill="url(#${id}-head)" stroke="${C.line}" stroke-width="2.2"/>
  <!-- 顔（額を出す） -->
  <path d="M112 182 C112 128 148 104 196 104 C246 104 290 126 290 182 C290 232 252 256 200 256 C148 256 112 232 112 182 Z" fill="${C.skin}"/>
  <!-- 横の髪の束（顔の両側に垂れる） -->
  <path d="M120 112 C98 150 96 208 108 262 L128 258 C122 214 124 160 146 120 Z" fill="${C.hair}" stroke="${C.line}" stroke-width="2"/>
  <path d="M276 108 C302 146 306 206 294 262 L274 258 C280 214 278 160 254 118 Z" fill="${C.hair}" stroke="${C.line}" stroke-width="2"/>
  <!-- 分け目と、両側へ流れる髪の筋（額は出したまま） -->
  <path d="M206 58 Q200 82 198 104" fill="none" stroke="${C.line}" stroke-width="1.8" stroke-linecap="round"/>
  <path d="M196 104 C168 102 140 116 124 140 M188 82 C162 88 140 104 126 124" fill="none" stroke="${C.hairMid}" stroke-width="1.6" stroke-linecap="round"/>
  <path d="M202 104 C232 102 262 116 278 142 M212 82 C240 88 262 104 276 126" fill="none" stroke="${C.hairMid}" stroke-width="1.6" stroke-linecap="round"/>
  <!-- ヘアピン 2 本 -->
  <path d="M236 96 L270 78 M246 110 L281 92" stroke="${C.pin}" stroke-width="6" stroke-linecap="round"/>
  <!-- 眉・目・頬・口 -->
  <path d="M134 140 Q154 130 174 136 M226 136 Q246 130 266 140" fill="none" stroke="${C.brow}" stroke-width="2.2" stroke-linecap="round"/>
  ${eye(156, false)}
  ${eye(244, true)}
  <ellipse cx="130" cy="236" rx="15" ry="8" fill="${C.blush}" opacity="0.75"/>
  <ellipse cx="270" cy="236" rx="15" ry="8" fill="${C.blush}" opacity="0.75"/>
  <ellipse cx="200" cy="242" rx="4.5" ry="3.4" fill="#E8958A"/>
  <!-- 縫い目と布のつや -->
  <path d="M200 58 C122 58 82 112 80 168" fill="none" stroke="${C.seam}" stroke-width="1.4" stroke-dasharray="3 4"/>
  <ellipse cx="160" cy="96" rx="70" ry="34" fill="url(#${id}-soft)"/>
  <!-- タグ -->
  <path d="M318 330 L338 326 L342 352 L322 356 Z" fill="#fff" stroke="${C.line}" stroke-width="1.4"/>
  <path d="M324 342 l6 -6 M328 348 l6 -6" stroke="${C.pin}" stroke-width="1.8" stroke-linecap="round"/>
</g>
</svg>`;
}
