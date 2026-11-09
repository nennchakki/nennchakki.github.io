# nennchakki.github.io

同人誌と原稿の資料（解答編・正誤表・補足資料・PDF）を公開する静的サイト。
公開先は https://nennchakki.github.io/ 。

サークル Warm Snow（ネンチャッキーG）のサイト。いま載せている作品は『篠澤広に超弦理論を教えてもらう本』で、別冊解答の全 15 章を章ごとの Web ページにしている。
解答編のページは、別冊解答の TeX 原稿から生成する。手で HTML を直すことはしない。

## 必要なもの

- Node.js 22 以上（ビルドとテスト。CI は 24）
- 原稿からスナップショットを作るときだけ: TeX Live（`lualatex`、`pdfcrop`）と Poppler（`pdftocairo`）
- 原稿との文字照合（任意）: Python 3 と lxml、Poppler の `pdftotext`
- 画面の確認（任意）: Google Chrome

```sh
npm ci
```

## ディレクトリ

| 場所 | 中身 |
|---|---|
| `content/site.json` | サイト名、注記、権利表記 |
| `content/profile.json` | トップのプロフィール、外部リンク、次の頒布（出典つき） |
| `content/writings/works.json` | 寄稿作品（題名・紹介文・登場人物・主題・章立て・公開状態）。原稿の生データと照合したもの |
| `content/writings/anthologies.json` | 寄稿先の合同誌と、頒布の機会（イベント・日付・配置）と出典 |
| `content/permanent-urls.mjs` | 固定 URL（QR コードの行き先）の定義 |
| `content/<作品>/work.json` | 作品の情報と、資料ごとの公開状態 |
| `content/<作品>/answers/source/answers.tex` | 公開用スナップショット（別冊解答の TeX のコピー） |
| `content/<作品>/answers/manifest.json` | スナップショットの記録（原稿のハッシュ、章数・問題数、本文との照合結果） |
| `content/<作品>/answers/structural.json` | 解答編の構造マクロの定義のハッシュ（変換器が想定している定義） |
| `content/<作品>/answers/figures/`、`figures.json` | 図の SVG と代替テキスト |
| `static/` | CSS と JavaScript |
| `tools/tex/` | TeX の字句解析と、解答編の変換器 |
| `tools/site/` | HTML の組み立て、キャラクター意匠の SVG |
| `tools/snapshot.mjs` | 原稿からスナップショットを作る |
| `tools/build.mjs` | `dist/` にサイトを組み立てる |
| `tests/` | 検査 |
| `docs/` | 調査記録、設計、TeX の解析結果、スクリーンショット |

`dist/`、`node_modules/`、`.tmp/`、`.private/`（参照画像。転載できない公式画像を含む）はコミットしない。

## よく使うコマンド

```sh
npm run build          # dist/ を作る
npm test               # 検査（リンク、固定 URL、QR、問題数、数式の照合、変換器の停止、章ごとの反映）
npm run serve          # http://127.0.0.1:8765/ で dist/ を見る
npm run test:browser   # serve している間に、PC と SP の幅で全ページを開いて崩れを調べる（--shots でスクリーンショット）
```

## 原稿から解答編を作り直す

原稿は、このリポジトリの外（作者の手元の原稿ディレクトリ）にある。
CI には原稿がないので、手元で「公開用スナップショット」を作ってコミットし、CI はスナップショットだけからビルドする。
原稿を保存しただけでは公開されない。

1. 原稿の側で、別冊解答の PDF が正常に組めることを確かめる（エラー・未定義参照 0）。
2. スナップショットを作る。原稿のディレクトリは引数で渡す（パスはリポジトリに書かない）。

   ```sh
   npm run snapshot -- hiro-string --source "<原稿の production ディレクトリ>"
   ```

   このコマンドは次を行う。原稿ディレクトリには書き込まない。
   - 別冊解答の TeX を読み、変換できることを確かめる。知らない命令・環境があれば、行番号を出して止まる。
   - 本文の TeX を読み、問題の題・章・小問の数が解答と一致するかを照合する（本文はコピーしない）。
   - `tikzpicture` の図を、原稿のプリアンブルで LuaLaTeX にかけ、SVG にする。
   - 別冊解答の TeX を `content/hiro-string/answers/source/answers.tex` にコピーし、`manifest.json` を書く。
   - プリアンブル（マクロ定義）が前回から変わっていたら止まる。変換器の対応を確かめてから `--accept-preamble` を付けて再実行する。
3. `npm run build && npm test` を通す。図が増えたら `figures.json` に代替テキストを書く（書かないとビルドが止まる）。
4. 文字の照合をする（任意だが、原稿を大きく直したときは行う）。原稿から組んだ別冊解答の PDF を渡す。

   ```sh
   npm run test:fidelity -- "<別冊解答の PDF>"
   ```

5. `git diff content/` で変わった章を確かめてコミットする。

### 変換で止まったとき

変換器は、知らない書き方を推測で読み替えない。止まったときのメッセージに原稿の行番号が出る。

- 原稿の誤り（閉じていない括弧など）なら、原稿を直す。このリポジトリでは原稿を直さない。
- 原稿は正しく、変換器が対応していない書き方なら、`tools/tex/convert.mjs` に対応を足す。
  表示に関係しない命令（改頁の調整など）は `IGNORE` に足す。足す前に、その命令が本当に表示に関係しないかを PDF で確かめる。
- 構造マクロ（`solutionbox`、`\solutionpart` など）の定義を原稿で変えると、`structural.json` との照合で止まる。
  変換器の解釈が新しい定義と合っているかを確かめてから、`structural.json` を作り直す。

## 新しい作品を足す

1. `content/<slug>/work.json` を作る。`content/hiro-string/work.json` を写して書き換える。
   - `theme` は `static/assets/css/themes/<theme>.css` の名前。作品ごとのスタイルはこのファイルにだけ書く（`body[data-theme="<theme>"]` で範囲を限る）。ほかの作品のテーマには影響しない。
   - `sections` の `status` は `published` か `pending`。`pending` の資料は「準備中」と表示し、リンクは張らない。
   - 公開日・頒布イベントがまだ決まっていなければ `null` のままにする（「未定」と表示する）。
2. 解答編を TeX から作る場合は、`tools/sources.config.mjs` に原稿のファイル名を足し、上の手順でスナップショットを作る。
   ほかの作品の解答編は、マクロの組み方が違えば変換器の対応を足す必要がある。
3. 固定 URL が要るなら、`content/permanent-urls.mjs` と `tests/permanent-urls.lock` の両方に足す。

## 固定 URL と QR コード

印刷物の QR コードは `https://nennchakki.github.io/q/<作品>/` を指す。PDF のファイル名や解答ページの構成を変えても、この入口から資料へ進める。

- 入口のページは JavaScript を使わず、リンクだけで成り立つ。
- `tests/permanent-urls.lock` に書いた URL が `dist/` から消えると、`npm test` が失敗する。lock の行は消さない。
- QR コードの画像はビルドで作る: `dist/q/<作品>/qr.svg`（印刷用）と `qr.png`。`npm test` が PNG を読み取り、URL と一致することを確かめる。
- 印刷に使う QR コードは、GitHub Pages で公開したあと、スマートフォンで実際に読み取って入口のページが開くことを確かめてから使う。

## 正誤表・補足資料・PDF を足す

`work.json` の `sections` で、該当する資料の `status` を `published` にし、中身（`errata`、`supplements`、`files`）を書く。
現時点の `tools/build.mjs` は解答編（`kind: "answers"`）の表示だけを実装している。ほかの種類を `published` にするとビルドが止まるので、表示を足してから公開する。
PDF は `static/files/<作品>/` に置き、リンクは作品ページから張る。QR コードから PDF を直接指さない。

## 公開

GitHub Pages の公開元は、いま `main` ブランチのルート（従来の方式）になっている。
このサイトは `dist/` を公開するので、公開元を「GitHub Actions」に切り替え、`.github/workflows/pages.yml` で公開する。

1. Settings → Pages → Build and deployment → Source を「GitHub Actions」にする。
2. `main` に push すると、CI が `npm ci → npm run build → npm test` を通したうえで `dist/` を公開する。
3. 公開後、総合トップ、作品ページ、解答編の目次、`/q/hiro-string/` を開いて確かめる。

## 寄稿作品を足す・直す

1. 収録先の合同誌が新しければ、`content/writings/anthologies.json` の `books` に足す。頒布の機会（`distributions`）ごとに、イベント・日付・配置・状態・出典を書く。告知されていないことは `null` のままにする（表示は「日付は未告知」「配置は未告知」）。会期全体の日付を、その合同誌の頒布日として書かない。
2. 作品を `content/writings/works.json` の `works` に足す。題名・章立て・登場人物は原稿の生データ（TeX・Markdown・Word。PDF ではない）から取る。
3. 告知の前の作品は、題名や紹介文をこのリポジトリに入れない（`visibility: "hold"` で非表示にするだけでは、公開リポジトリから見えてしまう）。下書きは `.private/`（Git の対象外）に置く。
4. `npm run build && npm test`。公開しない作品の題名がどのページにも出ないこと、全作品に出典があることを確かめる。

本文・PDF は配らない。サイトに出すのは書誌情報と紹介文だけ。

## X の情報を使うとき

X のポストやプロフィールは、FxTwitter API v2（https://api.fxtwitter.com 、仕様 https://api.fxtwitter.com/2/openapi.json ）で取得する。
`GET /2/status/{id}`、`/2/thread/{id}`、`/2/profile/{handle}`、`/2/profile/{handle}/statuses`（カーソルでページ送り）など。
HTTP ステータスとレスポンスの `code` を確かめ、取れなかった情報は推測で埋めない。
サイトに載せる情報には、元のポストの URL・ID・投稿者・投稿日時を `content/*.json` に残す。

## 権利について

キャラクターの意匠（総合トップのヘイロー、作品ページの虹彩の色の帯・ヘアピンの記号）は、公式画像を使わず、公式資料の観察をもとに基本図形から描いた。
公式画像は転載しない（調査の結論は `docs/research/` を参照）。作品ページの図を表紙などの画像に差し替える場合は、`work.json` に `cover` か `hero` を書く（`docs/design.md` を参照）。
