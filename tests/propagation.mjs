// 原稿の一部を変えたとき、変わるのがその章のページだけであることを確かめる。
// スナップショットの TeX をメモリ上で書き換えて変換し、章ごとの HTML のハッシュを比べる（ファイルは書き換えない）。
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { convertAnswers } from '../tools/tex/convert.mjs';
import { IrRenderer } from '../tools/site/render-ir.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const dir = path.join(ROOT, 'content/hiro-string/answers');
const src = fs.readFileSync(path.join(dir, 'source/answers.tex'), 'utf8');
const alts = JSON.parse(fs.readFileSync(path.join(dir, 'figures.json'), 'utf8'));
const svgs = Object.fromEntries(fs.readdirSync(path.join(dir, 'figures')).map((f) => [f.replace('.svg', ''), fs.readFileSync(path.join(dir, 'figures', f), 'utf8')]));

function chapterHashes(tex) {
  const doc = convertAnswers(tex);
  const r = new IrRenderer({ macroSets: doc.macroSets, figures: doc.figures, figureAlts: alts, figureSvgs: svgs });
  return doc.chapters.map((c) => createHash('sha256').update(r.blocks(c.blocks)).digest('hex'));
}
const base = chapterHashes(src);
let fail = 0;
// 各章の最初の「解いてみる」の中の文に1文字足す。変わる章が1つだけで、それが狙った章であること
const lines = src.split('\n');
const sectionLines = lines.map((l, i) => (/^\\section\[/.test(l) ? i : -1)).filter((i) => i >= 0);
for (let k = 0; k < sectionLines.length; k++) {
  const from = sectionLines[k];
  const to = sectionLines[k + 1] ?? lines.length;
  // その章の中で、行頭が和文で始まり「。」で終わる最初の地の文の行
  let target = -1;
  for (let i = from; i < to; i++) if (/^[\u3040-\u9fff].*。$/.test(lines[i]) && !lines[i].includes('%')) { target = i; break; }
  const mod = lines.slice();
  mod[target] = mod[target].replace(/。$/, '。（試験用の変更）');
  const h = chapterHashes(mod.join('\n'));
  const changed = h.map((x, i) => (x !== base[i] ? i + 1 : 0)).filter(Boolean);
  const ok = changed.length === 1 && changed[0] === k + 1;
  if (!ok) fail++;
  console.log(`${ok ? 'ok' : 'NG'} 原稿 ${target + 1} 行目（第${k + 1}章）を変更 → 変わった章: ${changed.join(', ')}`);
}
// 同じ入力からは同じ出力
const again = chapterHashes(src);
const same = again.every((x, i) => x === base[i]);
console.log(`${same ? 'ok' : 'NG'} 同じ TeX から同じ章 HTML が出る`);
if (!same) fail++;
process.exit(fail ? 1 : 0);
