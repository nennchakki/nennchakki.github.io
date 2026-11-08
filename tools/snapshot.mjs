// 原稿ディレクトリから、公開用スナップショットを作る。
//
//   node tools/snapshot.mjs hiro-string --source <原稿の production ディレクトリ> [--accept-preamble]
//
// - 原稿ディレクトリは読み取りだけ行う。書き込みはしない。
// - リポジトリへ入れるのは、解答編の TeX 1 本と、そこから作った図の SVG と、manifest.json だけ。
//   本文の TeX は読むだけで、コピーしない（問題との対応を照合するために使う）。
// - 図は、原稿のプリアンブルをそのまま使って LuaLaTeX で組み、SVG に変換する。
// - ローカルの絶対パスは manifest に書かない（ファイル名だけを書く）。

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { splitDocument } from './tex/preamble.mjs';
import { convertAnswers } from './tex/convert.mjs';
import { compareWithMainText } from './tex/maintext.mjs';
import { WORKS_SOURCES } from './sources.config.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

function parseArgs(argv) {
  const a = { work: argv[0], source: process.env.SOURCE_DIR ?? null, acceptPreamble: false };
  for (let i = 1; i < argv.length; i++) {
    if (argv[i] === '--source') a.source = argv[++i];
    else if (argv[i] === '--accept-preamble') a.acceptPreamble = true;
    else throw new Error('不明な引数: ' + argv[i]);
  }
  return a;
}

function compileFigure(preamble, figSrc, workdir, key) {
  const tex = `${preamble}\\begin{document}\\pagestyle{empty}\\thispagestyle{empty}\n\\noindent${figSrc}\n\\end{document}\n`;
  const dir = path.join(workdir, key);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'fig.tex'), tex);
  const env = { ...process.env, TEXMFVAR: path.join(workdir, 'texmfvar') };
  execFileSync('lualatex', ['-interaction=nonstopmode', '-halt-on-error', 'fig.tex'], { cwd: dir, env, stdio: 'pipe' });
  execFileSync('pdfcrop', ['--margins', '2', 'fig.pdf', 'crop.pdf'], { cwd: dir, env, stdio: 'pipe' });
  execFileSync('pdftocairo', ['-svg', 'crop.pdf', 'fig.svg'], { cwd: dir, stdio: 'pipe' });
  let svg = fs.readFileSync(path.join(dir, 'fig.svg'), 'utf8');
  // pdftocairo の出力の id は図ごとに同じ名前になるので、図の key を前に付けて衝突を避ける
  svg = svg.replace(/id="([^"]+)"/g, `id="${key}-$1"`).replace(/(xlink:href|href)="#([^"]+)"/g, `$1="#${key}-$2"`).replace(/url\(#([^)]+)\)/g, `url(#${key}-$1)`);
  return svg;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const conf = WORKS_SOURCES[args.work];
  if (!conf) throw new Error(`作品 ${args.work} の設定が tools/sources.config.mjs にない`);
  if (!args.source) throw new Error('--source で原稿のディレクトリを指定する（または SOURCE_DIR）');
  const srcDir = path.resolve(args.source);
  const answersPath = path.join(srcDir, conf.answersFile);
  const mainPath = conf.mainFile ? path.join(srcDir, conf.mainFile) : null;
  const before = fs.statSync(answersPath).mtimeMs;
  const src = fs.readFileSync(answersPath, 'utf8');
  const srcHash = sha256(src);

  const outDir = path.join(ROOT, 'content', args.work, 'answers');
  const lockPath = path.join(outDir, 'preamble.lock.json');
  const { preamble } = splitDocument(src);
  const preHash = sha256(preamble);
  if (fs.existsSync(lockPath) && !args.acceptPreamble) {
    const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    if (lock.sha256 !== preHash) {
      throw new Error('解答編のプリアンブル（マクロ定義など）が前回から変わった。変換器の対応を確かめてから --accept-preamble を付けて再実行する');
    }
  }

  // 変換が通るかを先に確かめる（通らなければスナップショットを更新しない）
  const doc = convertAnswers(src);

  // 本文との照合（本文はコピーしない）
  let mainCheck = null;
  if (mainPath && fs.existsSync(mainPath)) {
    const mainSrc = fs.readFileSync(mainPath, 'utf8');
    mainCheck = { file: path.basename(mainPath), sha256: sha256(mainSrc), ...compareWithMainText(mainSrc, doc) };
  }

  // 図
  fs.mkdirSync(path.join(ROOT, '.tmp'), { recursive: true });
  const work = fs.mkdtempSync(path.join(ROOT, '.tmp', 'snapshot-fig-'));
  const figDir = path.join(outDir, 'figures');
  fs.rmSync(figDir, { recursive: true, force: true });
  fs.mkdirSync(figDir, { recursive: true });
  for (const f of doc.figures) {
    process.stdout.write(`図 ${f.key}（原稿 ${f.line} 行目）を組む… `);
    const svg = compileFigure(preamble, f.src, work, f.key);
    fs.writeFileSync(path.join(figDir, `${f.key}.svg`), svg);
    console.log('ok');
  }
  fs.rmSync(work, { recursive: true, force: true });

  // 原稿が読み取り中に変わっていないか
  if (fs.statSync(answersPath).mtimeMs !== before || sha256(fs.readFileSync(answersPath, 'utf8')) !== srcHash) {
    throw new Error('スナップショットの作成中に原稿が更新された。もう一度実行する');
  }

  fs.mkdirSync(path.join(outDir, 'source'), { recursive: true });
  fs.writeFileSync(path.join(outDir, 'source', 'answers.tex'), src);
  fs.writeFileSync(lockPath, JSON.stringify({ sha256: preHash, note: '解答編プリアンブルのハッシュ。変わったら変換器の対応を確認する' }, null, 2) + '\n');

  const problems = doc.chapters.map((c) => c.blocks.filter((b) => b.type === 'problem').length);
  const manifest = {
    work: args.work,
    createdAt: new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' }),
    source: { file: path.basename(answersPath), sha256: srcHash, bytes: Buffer.byteLength(src) },
    counts: {
      chapters: doc.chapters.length,
      problems: problems.reduce((a, b) => a + b, 0),
      problemsByChapter: Object.fromEntries(doc.chapters.map((c, i) => [c.slug, problems[i]])),
      figures: doc.figures.length,
    },
    figures: doc.figures.map((f) => ({ key: f.key, line: f.line, chapter: f.chapter, sha256: sha256(f.src) })),
    mainTextCheck: mainCheck,
  };
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(`スナップショットを更新した: ${manifest.counts.chapters} 章, ${manifest.counts.problems} 問, 図 ${manifest.counts.figures}`);
  if (mainCheck) {
    console.log(`本文との照合: 問題 ${mainCheck.mainExercises} / 解答 ${mainCheck.answerProblems}, 題の不一致 ${mainCheck.titleMismatches.length}, 小問数の不一致 ${mainCheck.partMismatches.length}`);
  }
}

main().catch((e) => {
  console.error('停止: ' + e.message);
  process.exit(1);
});
