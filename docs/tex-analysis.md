# 『篠澤広に超弦理論を教えてもらう本』TeX 原稿の解析結果

調べた日: 2026-11-09。対象は原稿ディレクトリの `production/` にある 2 本の TeX。
数値はすべて TeX ソースを字句解析して数えたもので、PDF からは数えていない（PDF は照合にだけ使った）。

## 1. ファイルと依存関係

| ファイル | 役割 | 行数 | SHA-256（先頭 12 桁） |
|---|---|---|---|
| `hiro_string_theory_answers.tex` | 別冊解答（公開対象） | 21,487 | `73e7ea02d319` |
| `hiro_string_theory.tex` | 本文（照合にだけ使う。公開しない） | 31,229 | `0ffa8d3cd85a` |

- どちらも単一ファイルで、`\input`・`\include` はない。章ごとのファイル（`tmp/rewrite-20261107/answers_new/aNN.tex`）は作者の作業場にあり、`production/` へは組み立て済みの 1 本として入っている。サイトはこの 1 本だけを読む。
- 文書クラスは `jlreq`（LuaLaTeX、B5、`.latexmkrc` で `lualatex`）。
- 使用パッケージ（別冊解答）: geometry, luatexja, luatexja-fontspec, mathtools, amssymb, bm, tikz（arrows.meta, calc, decorations.markings, positioning, angles, quotes）, booktabs, tabularx, array, enumitem, etoolbox, fancyhdr, xcolor, tcolorbox（most）, hyperref, bookmark, needspace。
- 別冊解答は外部の画像を読まない（`\includegraphics` 0 個）。図は `tikzpicture` が 1 個だけ（第14章、原稿 20239 行目）。本文の図（`production/figures/*.pdf`）は別冊では使っていない。

## 2. 章・節・問題の構成（別冊解答）

- `\part` が 2 個（第I部 第1〜7章、第II部 第8〜15章）。
- `\section` が 15 個（＝章）。`\section` の番号は `\setcounter{section}{0}` で第I部の始めにだけ戻し、第II部では続き番号（8〜15）。
- `\subsection` が 36 個（節。本文の節に対応する見出し）。`\subsubsection*` が 22 個（節末の「解答を閉じる前に」「照合のための到達点」）。
- 問題は `solutionbox` 環境（大問）が 239 個。その中の `\solutionpart`（小問）が 894 個、`\solutionfollowup`（まとめの設問。中身は `\solutionpart{まとめ}`）が 3 個。
  - 小問の番号は `\solutionpart` の第 1 引数（`1`〜`8`、空なら「問題」1 つだけの大問）。
- 問題番号は `\theexercise` = `\Roman{part}-\arabic{section}-\arabic{exercise}`（例: I-1-1、II-15-8）。`exercise` は `section` ごとに 0 に戻る。
- 数式番号は `\numberwithin{equation}{section}`（例: (1.1)）。番号付きの行は 716 行。`\tag{A}` などの手書きの記号が 70 個。

| 章 | 章題（`\section` の長い形） | 原稿の行 | 大問 | 小問 |
|---|---|---|---|---|
| 1 | 次元と物理量──課題解答 | 277 | 4 | 4 |
| 2 | 微積分・テンソル・作用──課題解答 | 620 | 24 | 100 |
| 3 | 波動・量子力学・場──課題解答 | 2979 | 24 | 99 |
| 4 | 重力・有効理論・コンパクト化──課題解答 | 5454 | 24 | 97 |
| 5 | 相対論的な弦の古典論──課題解答 | 7757 | 24 | 96 |
| 6 | 弦の量子化と臨界次元──課題解答 | 10066 | 16 | 64 |
| 7 | 超弦理論と五つの理論──課題解答 | 11317 | 24 | 96 |
| 8 | 円周コンパクト化とT双対性──課題解答 | 13132 | 8 | 16 |
| 9 | Dブレーンと開弦──課題解答 | 13560 | 13 | 24 |
| 10 | 弦の相互作用と強結合双対性──課題解答 | 14254 | 23 | 46 |
| 11 | ブラックホール熱力学と2次元CFT──課題解答 | 15511 | 12 | 46 |
| 12 | ブラックホールの微視的状態とAdS/CFT──課題解答 | 16464 | 21 | 99 |
| 13 | 量子もつれとPage曲線──課題解答 | 18573 | 7 | 36 |
| 14 | 島公式と情報回収──課題解答 | 19506 | 7 | 39 |
| 15 | 量子重力の条件とswampland──課題解答 | 20502 | 8 | 34 |
| 計 | | | 239 | 896 |

小問の欄は `\solutionpart` と `\solutionfollowup` の合計。

## 3. マクロ

### 構造マクロ（プリアンブルで定義、変換器が意味を知っている）

| マクロ | 原稿での意味 | Web での表し方 |
|---|---|---|
| `solutionbox{題}` | 大問。番号を進め、枠の見出しに「第n問 題 （I-1-1）」 | `<article class="problem">` |
| `\solutionpart{番号}{問題文}{考え方}{解いてみる}` | 小問。問題文の枠、「考え方」「解いてみる」、□ | `<section class="part">` |
| `\solutionfollowup{…}{…}{…}` | `\solutionpart{まとめ}` と同じ | 同上（見出しは「(まとめ)」） |
| `\solutionprelude{…}` | 小問に共通する条件（大問の枠の中） | 大問の枠の中の段落 |
| `\problemformulas{…}` | 問題で使う式を罫線で挟む | 罫線で挟んだ `div` |
| `\answerheading{…}` | 小見出し | `h5` |
| `\answerconclusion{…}` | ∴ と結論 | ∴ 付きの段落 |
| `checkpointbox`・`definitionbox` | 前付けの見出し付きの区画 | `section` |

これらの定義を原稿で変えると、`content/hiro-string/answers/structural.json` との照合でビルドが止まる。

### 数式用のマクロ

- プリアンブルで 9 個（`\alphap`、`\Z`、`\R`、`\dd`、`\e`、`\imunit`、`\term`、`\cl`、`\spherearea`）。
- 本文中で、節ごとに `\begingroup … \endgroup` の中で `\newcommand` するものが 99 個（延べ）。同じ名前を節ごとに別の意味で定義している（例: `\GN` は第1章で `G_{\mathrm N}`、第11章で `G`）。
- 変換器は `\begingroup`/`\endgroup` と `{ }` でスコープを追い、その位置で有効な定義を KaTeX に渡す。マクロを変換器の側で展開しない（`\frac\Tens2` のように、マクロを 1 トークンの引数として渡す書き方があるため。KaTeX のマクロ展開は TeX と同じ遅延展開なので同じ結果になる）。

## 4. 参照

- `\label` は 25 個（すべて数式）。`\ref`・`\eqref`・`\cite` は 0 個。
- 本文中の式の参照は、`式\textup{(A)}` のように手で書いた記号（`\tag{A}` などと対応）で、`\ref` を使っていない。Web 版ではこの文字をそのまま表示する。
- 文献参照はない（別冊解答には参考文献リストがなく、`\cite` もない）。

## 5. 数式

- インライン数式 9,738 個（`$…$` と `\(…\)`）、表示数式 2,282 個（`\[…\]`、`equation(*)`、`align(*)`）。
- 中で使う環境: `pmatrix`（76）、`cases`（8）、`array`（2）、`aligned`（1）、`smallmatrix`（1）。`gather`・`multline`・`split` はない。
- 数式内の日本語: `\text{…}` の中に多数。`\text` を使わずに数式に直接日本語を書いた箇所が 1 つ（原稿 13692 行目 `$X=x+2\alphap p\tau+〈振動子部分〉$`）。LaTeX でも KaTeX でもそのまま組めるので、変換では手を加えていない。
- KaTeX 0.16.47 で 12,019 個すべてがエラーなしで組めた（`unicodeTextInMathMode` の警告は上の 1 箇所だけ）。

## 6. 表と図

- `tabular` 8 個、`tabularx` 2 個。列指定は `c`・`l`・`p{}`・`X`・`>{\bfseries\sffamily}`・`*{9}{c}`。罫線は booktabs。`\multicolumn` はない。
- `tikzpicture` 1 個。原稿のプリアンブルのまま LuaLaTeX で組み、`pdftocairo` で SVG にした（文字はパスになるので選択できない。代替テキストは `figures.json`）。

## 7. 本文との対応

- 本文の問題は `exercisebox` 環境で 239 個。本文の `\section` の数え方（`\let\section\subsubsection` の区間を除く）で章を数えると、解答と同じ 15 章に、同じ数ずつ並ぶ。
- 239 問すべてで、本文の問題の題（`exercisebox` の引数）と解答の題（`solutionbox` の引数）が一致した。違いは、アクセント（`B\'ezout` / `Bézout`）とアポストロフィの表記だけで、照合では同じ文字に直して比べた。
- 本文の問題の小問数（外側の `enumerate` の `\item` 数）と、解答の番号付き `\solutionpart` の数も 239 問すべてで一致した。
- 別冊解答は、各小問の問題文を省かずに書き直している（別冊の「この別冊について」に「小問は問題文を省かずにもう一度書き」とある）。そのため、Web 版では本文から問題文を併記する必要がなく、本文は公開していない。

## 8. 原稿で気づいた点（直していない）

変換の過程で、原稿の誤りは見つからなかった。表記の揺れとして次がある（作者の引き継ぎメモにも記載あり）。

- 節末の見出し（`\subsubsection*`）が「解答を閉じる前に」（第1〜4章、第7章、第12・13章）と「照合のための到達点」（第5・6章）で混在している。第8〜11章、第14・15章には節末の見出しがない。Web 版も原稿のとおり表示している。
- 節の見出しの末尾の「──解答」は、第8章以降の `\subsection` にだけあり、第1〜7章の `\subsection` の短い形（目次用）にはない。Web 版の章内目次は短い形を使うので、原稿の目次と同じ見え方になる。
- 別冊の表紙の日付は 2026年12月29日。Web 版では表紙（titlepage）を出していない。
