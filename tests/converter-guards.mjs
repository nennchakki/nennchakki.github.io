// 変換器が、知らない書き方に出会ったときに推測で進まず止まることを確かめる。
import fs from 'node:fs';
import path from 'node:path';
import { convertAnswers } from '../tools/tex/convert.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const src = fs.readFileSync(path.join(ROOT, 'content/hiro-string/answers/source/answers.tex'), 'utf8');
// 挿入位置は、前付けの最初の枠の直後（文面が変わっても位置が決まるように、環境の開始で探す）
const anchor = '\\begin{checkpointbox}{この別冊について}\n';
if (!src.includes(anchor)) throw new Error('挿入位置が見つからない');
const cases = [
  ['未知の命令', '\\unknowncommand{x}'],
  ['未知の環境', '\\begin{multicols}{2}x\\end{multicols}'],
  ['閉じていない数式', '$x+1'],
  ['閉じていない中括弧', '{abc'],
  ['対応のない \\endgroup', '\\endgroup'],
  ['インライン数式の中の \\label', '$x\\label{a}$'],
  ['\\\\ で終わる align', '\\begin{align}a&=b\\\\\n\\end{align}'],
];
let fail = 0;
for (const [name, ins] of cases) {
  const mod = src.replace(anchor, anchor + ins);
  try {
    convertAnswers(mod);
    console.log(`NG ${name}: 止まらなかった`);
    if (mod === src) console.log('   （挿入できていない）');
    fail++;
  } catch (e) {
    const hasLine = /原稿 \d+ 行目/.test(e.message);
    console.log(`${hasLine ? 'ok' : 'NG'} ${name}: ${e.message}`);
    if (!hasLine) fail++;
  }
}
process.exit(fail ? 1 : 0);
