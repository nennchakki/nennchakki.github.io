// 篠澤広のちびぐるみ風の絵。公式画像はなぞらず、基本図形で描く。
//
// 形の根拠: バンプレスト（BANDAI SPIRITS）のプライズ「学園アイドルマスター ちびぐるみvol.3」（2024-12、約11cm）の
// 篠澤広の商品写真の観察（2026-11-09。https://bsp-prize.jp/item/2766551/ 。画像は .private/ にだけ置き、公開しない）。
//   - 全体は頭が大きく、胴は頭の下に小さく付く。腕と脚は作らず、胴の下端が短い足になる。
//   - 顔は肌色の布を髪の中にはめ込んだ形で、顔と髪の境目は布の切り替えの線になる。
//   - 髪は額の上で大きく丸く、肩の高さで毛先が左右へ羽のように広がる。毛先ほど暗い。
//   - 目は刺繍。上半分が暗い色で上まつ毛が付き、下半分が琥珀色、白いハイライトが1つ。
//   - 眉は淡い色の細い刺繍。鼻は小さな桃色の点。口はない（vol.3 の写真で確認できない）。
//   - ヘアピン 2 本は髪の右上に黒い斜線で刺繍されている。
//   - 向かって左の耳だけが髪から出ていて、白い粒のピアスが付く。その下で、手が顔の横に少しのぞく。
//   - 服は vol.3 の私服: 生成りのカーディガン、白いブラウスと橙の編み上げの紐、デニムのショートパンツ。
// 色は同じ写真から取った近似値（布の色で、ゲームの立ち絵より彩度が低い）。

const C = {
  hair: '#D3C7B4',
  hairShade: '#BFB19C',
  hairTip: '#7A6852',
  face: '#F2D3BE',
  faceLine: '#C9A894',
  eyeTop: '#42363C',
  eyeAmber: '#E2A228',
  brow: '#FBEBD8',
  blush: '#EDB7AA',
  nose: '#E59A98',
  pin: '#36363A',
  cardigan: '#D9D3CB',
  cardiganShade: '#C2BAB0',
  blouse: '#ECE9F2',
  lace: '#F08A55',
  denim: '#A9C3E6',
  denimShade: '#7F9CC8',
  belt: '#4B4744',
  stud: '#FFFFFF',
  seam: '#CDB8A6',
};

/** @param {{id?: string, label?: string}} o */
export function hiroPlush({ id = 'plush', label = '篠澤広のちびぐるみ風の絵（ファンが描いたもの）。大きな頭に小さな胴の、ぬいぐるみの形。淡い色の髪の毛先が肩の高さで左右へ広がり、髪の右上にヘアピンが2本、刺繍の目は上が暗く下が琥珀色。生成りのカーディガンに橙の編み上げの紐のブラウス、デニムのショートパンツ。' } = {}) {
  // 刺繍の目（向かって左の目を基準に、右の目は左右反転）。横長で、上まぶたが厚く平ら。
  // 刺繍の目。上まぶたは太い一本の線で、目尻に短いまつ毛が数本。黒目の下 4 割ほどが琥珀色。
  const eye = (cx, flip) => `<g transform="translate(${cx} 254) scale(${flip ? -1 : 1} 1)">
    <ellipse cx="0" cy="0" rx="23" ry="28" fill="${C.eyeTop}"/>
    <path d="M-22.5 6 C-20 20 -11 27.5 0 27.5 C11 27.5 20 20 22.5 6 C14 2 -14 2 -22.5 6 Z" fill="${C.eyeAmber}"/>
    <ellipse cx="0" cy="0" rx="23" ry="28" fill="none" stroke="${C.eyeTop}" stroke-width="2.4"/>
    <circle cx="7" cy="-12" r="5.5" fill="#F4F2F6"/>
    <path d="M-28 -12 C-20 -34 20 -36 30 -14" fill="none" stroke="${C.eyeTop}" stroke-width="6" stroke-linecap="round"/>
    <path d="M-27 -16 L-39 -24 M-28 -10 L-41 -12 M-27 -4 L-37 1" stroke="${C.eyeTop}" stroke-width="3" stroke-linecap="round"/>
    <path d="M18 -29 L22 -37" stroke="${C.eyeTop}" stroke-width="2.6" stroke-linecap="round"/>
  </g>`;
  return `<svg class="hiro-plush" viewBox="0 0 440 480" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${label}">
<defs>
  <linearGradient id="${id}-tips" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${C.hair}"/>
    <stop offset="0.4" stop-color="${C.hairShade}"/>
    <stop offset="1" stop-color="${C.hairTip}"/>
  </linearGradient>
  <radialGradient id="${id}-nap" cx="0.42" cy="0.3" r="0.7">
    <stop offset="0" stop-color="#fff" stop-opacity="0.35"/>
    <stop offset="1" stop-color="#fff" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="${id}-body" cx="0.5" cy="0.35" r="0.7">
    <stop offset="0" stop-color="#000" stop-opacity="0"/>
    <stop offset="1" stop-color="#000" stop-opacity="0.08"/>
  </radialGradient>
</defs>
<ellipse cx="220" cy="468" rx="96" ry="8" fill="#000" opacity="0.07"/>
<g class="plush-body">
  <!-- 毛先: 頭の両側から出て、肩の高さで外へ広がる（先ほど暗い） -->
  <path d="M106 270 C104 318 88 346 56 360 C42 366 30 368 20 368 C32 378 46 380 58 378 C50 388 44 396 40 404 C58 402 74 396 86 388 C84 398 84 406 84 412 C110 402 132 380 144 344 Z" fill="url(#${id}-tips)"/>
  <path d="M334 270 C336 318 352 346 384 360 C398 366 410 368 420 368 C408 378 394 380 382 378 C390 388 396 396 400 404 C382 402 366 396 354 388 C356 398 356 406 356 412 C330 402 308 380 296 344 Z" fill="url(#${id}-tips)"/>
  <!-- 向かって左、顔の横から少しだけのぞく手（vol.3 の写真で、手を上げた形になっている） -->
  <path d="M120 318 C112 300 114 284 124 280 C132 278 138 288 140 300 L142 326 Z" fill="${C.face}"/>
  <path d="M124 286 C128 292 130 300 132 308" fill="none" stroke="${C.faceLine}" stroke-width="1.4" stroke-linecap="round"/>
  <!-- 胴（丸みのある袋の形。腕と脚はなく、下端が二つに分かれた短い足） -->
  <path d="M146 326 L294 326 C310 360 314 398 306 432 C302 452 286 460 266 460 C250 460 240 456 232 450 L220 444 L208 450 C200 456 190 460 174 460 C154 460 138 452 134 432 C126 398 130 360 146 326 Z" fill="${C.blouse}"/>
  <path d="M146 326 C130 360 126 398 134 432 C138 452 156 460 176 460 L188 334 Z" fill="${C.cardigan}"/>
  <path d="M294 326 C310 360 314 398 306 432 C302 452 284 460 264 460 L252 334 Z" fill="${C.cardigan}"/>
  <path d="M188 334 L176 460 M252 334 L264 460" stroke="${C.cardiganShade}" stroke-width="2"/>
  <path d="M136 396 L160 396 L159 416 L137 416 Z M280 396 L304 396 L303 416 L281 416 Z" fill="none" stroke="${C.cardiganShade}" stroke-width="1.8"/>
  <!-- 編み上げの紐 -->
  <path d="M212 342 L228 352 L212 362 L228 372 M228 342 L212 352 L228 362 L212 372" fill="none" stroke="${C.lace}" stroke-width="3.2" stroke-linecap="round"/>
  <path d="M220 372 L215 400 M220 372 L225 398" stroke="${C.lace}" stroke-width="2.4" stroke-linecap="round"/>
  <!-- ベルトとデニム -->
  <path d="M184 418 L256 418 L256 427 L184 427 Z" fill="${C.belt}"/>
  <path d="M186 422.5 L254 422.5" stroke="#7A736C" stroke-width="2" stroke-dasharray="5 4"/>
  <path d="M180 427 L260 427 L262 454 C252 460 240 458 232 452 L220 446 L208 452 C200 458 188 460 178 454 Z" fill="${C.denim}"/>
  <path d="M220 430 L220 444" stroke="${C.denimShade}" stroke-width="1.6"/>
  <path d="M134 432 C138 452 156 460 176 460 C190 460 200 456 208 450 L220 444 L232 450 C240 456 250 460 266 460 C286 460 302 452 306 432" fill="url(#${id}-body)"/>
  <!-- 頭（幅の広い卵形の髪の布） -->
  <path d="M220 34 C120 34 84 92 86 180 C88 250 100 300 122 330 C150 346 290 346 318 330 C340 300 352 250 354 180 C356 92 320 34 220 34 Z" fill="${C.hair}"/>
  <!-- 向かって左の耳と、白い粒のピアス -->
  <ellipse cx="98" cy="262" rx="15" ry="20" fill="${C.face}"/>
  <path d="M94 254 C101 256 103 268 98 274" fill="none" stroke="${C.faceLine}" stroke-width="1.6" stroke-linecap="round"/>
  <circle cx="97" cy="286" r="3.8" fill="${C.stud}" stroke="#D8D2CC" stroke-width="1"/>
  <!-- 顔の布（上の辺はやや右下がり、縦の辺はまっすぐ、下は丸い） -->
  <path d="M130 146 L300 156 L304 280 C304 316 280 336 246 338 L194 338 C158 336 134 316 134 280 Z" fill="${C.face}"/>
  <path d="M130 146 L300 156 L304 280 C304 316 280 336 246 338 L194 338 C158 336 134 316 134 280 Z" fill="none" stroke="${C.seam}" stroke-width="1.4" stroke-dasharray="4 3"/>
  <!-- 顔の右側に垂れる髪 -->
  <path d="M300 156 C286 200 284 260 296 324 L318 330 C326 280 324 210 300 156 Z" fill="${C.hair}"/>
  <!-- ヘアピン 2 本（刺繍の黒い斜線） -->
  <path d="M234 136 L270 66 M270 148 L306 80" stroke="${C.pin}" stroke-width="9" stroke-linecap="round"/>
  <!-- 眉（淡い色の細い刺繍）・目・頬・鼻 -->
  <path d="M150 204 C160 192 182 188 202 194 M238 194 C258 188 278 192 288 204" fill="none" stroke="${C.brow}" stroke-width="4" stroke-linecap="round"/>
  ${eye(174, false)}
  ${eye(264, true)}
  <ellipse cx="158" cy="300" rx="16" ry="9" fill="${C.blush}" opacity="0.8"/>
  <ellipse cx="280" cy="300" rx="16" ry="9" fill="${C.blush}" opacity="0.8"/>
  <path d="M214 304 Q220 297 226 304 Q220 309 214 304 Z" fill="${C.nose}"/>
  <!-- 起毛した布のつや -->
  <ellipse cx="190" cy="80" rx="84" ry="38" fill="url(#${id}-nap)"/>
</g>
</svg>`;
}
