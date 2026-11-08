// 作品ごとの原稿ファイル名。原稿のディレクトリ（絶対パス）はここに書かず、
// 実行時に --source または環境変数 SOURCE_DIR で渡す。
export const WORKS_SOURCES = {
  'hiro-string': {
    answersFile: 'hiro_string_theory_answers.tex',
    // 本文。照合にだけ使い、リポジトリにはコピーしない
    mainFile: 'hiro_string_theory.tex',
  },
};
