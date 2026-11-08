"""Web 版の日本語の文字列を、同じ TeX から LuaLaTeX で組んだ PDF の文字列と照合する。

変換器とは独立した経路（TeX 処理系 → PDF → pdftotext）で得た文字列を正とみなし、
Web 版の HTML から取り出した文字列と、仮名・漢字・全角記号の並びだけで比べる。
数式の中の \\text{...} の日本語も含む（HTML 側は KaTeX の表示用の部分だけを読む）。
PDF 側の柱・ノンブル・目次は取り除く。

使い方: python3 tests/fidelity_pdf.py <TeX から組んだ PDF> [dist の解答編ディレクトリ]
"""
import json, re, subprocess, sys, difflib, pathlib
from lxml import html as LH

pdf = sys.argv[1]
answers_dir = pathlib.Path(sys.argv[2] if len(sys.argv) > 2 else 'dist/works/hiro-string/answers')
JA = re.compile(r'[\u3040-\u30ff\u3400-\u9fff\uff01-\uff60\u3000-\u303f]')

def ja_only(s):
    # 全角空白は PDF の文字抽出で落ちることがあるので比べない
    return ''.join(JA.findall(s)).replace('\u3000', '')

# ---- PDF ----
# 柱（上）とノンブル（下）を除くため、版面だけを切り出して読む。
# 原稿の geometry: B5 (516×729pt)、top=25mm, bottom=23mm, headsep=7mm, footskip=10mm。
# 版面は y=71pt〜664pt。柱の基線は約 51pt、ノンブルは約 692pt。
pages = subprocess.run(['pdftotext', '-enc', 'UTF-8', '-x', '0', '-y', '60', '-W', '516', '-H', '618', pdf, '-'], capture_output=True, text=True, check=True).stdout.split('\f')
body = []
for i, p in enumerate(pages):
    lines = p.split('\n')
    keep = []
    for ln in lines:
        t = ln.strip()
        if not t: continue
        if re.fullmatch(r'[0-9ivxlc]+', t): continue                       # ノンブル
        if t == '篠澤広に超弦理論を教えてもらう本' or t == '別冊解答': continue  # 柱（左頁・前付）
        if re.fullmatch(r'解答 第\d+章\s*\S.*', t): continue                  # 柱（右頁）
        keep.append(t)
    body.append('\n'.join(keep))
pdf_text = '\n'.join(body)
# 目次（前付け）を除く: 「この別冊について」の本文以降を使う
start = pdf_text.index('この別冊について')
pdf_text = pdf_text[start:]
pdf_ja = ja_only(pdf_text)

# ---- HTML ----
def page_text(path, selector):
    doc = LH.parse(str(path)).getroot()
    # 読み上げ用の要素を消す。lxml の remove() は後続のテキスト（tail）も消すので、drop_tree() を使う
    for cls in ('katex-mathml', 'visually-hidden'):
        for el in doc.xpath(f'//*[contains(concat(" ", normalize-space(@class), " "), " {cls} ")]'):
            el.drop_tree()
    nodes = doc.xpath(selector)
    return ''.join(n.text_content() for n in nodes)

html_parts = []
# 前付け（この別冊について・記号・略称）
html_parts.append(page_text(answers_dir / 'index.html', '//details[@class="front-matter"]//div[@class="answer-body"]'))
chapters = sorted(p for p in answers_dir.iterdir() if p.is_dir() and re.fullmatch(r'ch\d\d', p.name))
for ch in chapters:
    t = page_text(ch / 'index.html', '//header[@class="chapter-head"]/h1 | //div[@class="answer-body"]')
    html_parts.append(t)
html_ja = ja_only('\n'.join(html_parts))

# ---- 比較 ----
sm = difflib.SequenceMatcher(None, pdf_ja, html_ja, autojunk=False)
ops = [op for op in sm.get_opcodes() if op[0] != 'equal']
def ctx(s, i, j):
    return s[max(0, i - 12):i] + '【' + s[i:j] + '】' + s[j:j + 12]
report = []
for tag, i1, i2, j1, j2 in ops:
    report.append({'op': tag, 'pdf': ctx(pdf_ja, i1, i2), 'web': ctx(html_ja, j1, j2), 'pdf_len': i2 - i1, 'web_len': j2 - j1})
matched = sum(b.size for b in sm.get_matching_blocks())
summary = {'pdf_chars': len(pdf_ja), 'web_chars': len(html_ja), 'matched': matched, 'diff_ops': len(ops)}
pathlib.Path('.tmp').mkdir(exist_ok=True)
pathlib.Path('.tmp/fidelity-report.json').write_text(json.dumps({'summary': summary, 'diffs': report}, ensure_ascii=False, indent=1))
print(json.dumps(summary, ensure_ascii=False))
for r in report[:40]:
    print(r['op'], 'PDF:', r['pdf'], ' WEB:', r['web'])

# ---- 並びの入れ替わりを相殺する ----
# PDF の文字抽出では、表示数式をはさんで折り返した文の一部が、別の行として前後に出ることがある。
# そのため「PDF で消えた文字列」と「Web で増えた文字列」が近くで同じなら、並びの違いとして相殺する。
from collections import Counter
dels = []  # (位置, 文字列)
ins = []
for tag, i1, i2, j1, j2 in ops:
    if tag in ('delete', 'replace'): dels.append([i1, pdf_ja[i1:i2]])
    if tag in ('insert', 'replace'): ins.append([i1, html_ja[j1:j2]])
residual_del = []
used = [False] * len(ins)
for pos, s in dels:
    hit = None
    for k, (ipos, t) in enumerate(ins):
        if not used[k] and t == s and abs(ipos - pos) < 400:
            hit = k; break
    if hit is None: residual_del.append((pos, s))
    else: used[hit] = True
residual_ins = [(p, t) for k, (p, t) in enumerate(ins) if not used[k]]
# 残りを、文字の多重集合で ±400 字の窓ごとに相殺する（分割された入れ替わり）
def counter_of(lst): return Counter(''.join(t for _, t in lst))
cd, ci = counter_of(residual_del), counter_of(residual_ins)
print('\n相殺後に残る差分:', len(residual_del), '件の削除,', len(residual_ins), '件の挿入')
print('削除のみの文字:', dict((cd - ci).most_common(30)))
print('挿入のみの文字:', dict((ci - cd).most_common(30)))
for p, s in residual_del[:30]: print('  PDFのみ', ctx(pdf_ja, p, p + len(s)))
for p, t in residual_ins[:30]: print('  WEBのみ', t)
json.dump({'summary': summary, 'residual_pdf_only': [s for _, s in residual_del], 'residual_web_only': [t for _, t in residual_ins], 'chars_pdf_only': dict(cd - ci), 'chars_web_only': dict(ci - cd)}, open('.tmp/fidelity-residual.json', 'w'), ensure_ascii=False, indent=1)

# ---- 文字の数の比較（並びによらない） ----
gp, gw = Counter(pdf_ja), Counter(html_ja)
only_pdf, only_web = gp - gw, gw - gp
print('\n文字数の差（PDF にだけ多い）:', sum(only_pdf.values()), dict(only_pdf.most_common(40)))
print('文字数の差（Web にだけ多い）:', sum(only_web.values()), dict(only_web.most_common(40)))

# ---- 大問ごとの照合 ----
# PDF を問題番号（I-1-1 など）で区切り、Web の各 article と、文字の多重集合が同じかを比べる。
code_re = re.compile(r'（(I{1,2}-\d+-\d+)）')
pdf_codes = [(m.start(), m.group(1)) for m in code_re.finditer(pdf_text)]
pdf_by_code = {}
for k, (pos, code) in enumerate(pdf_codes):
    end = pdf_codes[k + 1][0] if k + 1 < len(pdf_codes) else len(pdf_text)
    pdf_by_code[code] = pdf_text[pos:end]
web_by_code = {}
for ch in chapters:
    doc = LH.parse(str(ch / 'index.html')).getroot()
    for cls in ('katex-mathml', 'visually-hidden'):
        for el in doc.xpath(f'//*[contains(concat(" ", normalize-space(@class), " "), " {cls} ")]'):
            el.drop_tree()
    arts = doc.xpath('//article[@class="problem"]')
    for i, a in enumerate(arts):
        code = a.xpath('.//span[@class="pcode"]')[0].text_content().strip('（）')
        # PDF の区切りは「問題番号の後ろから次の問題番号の手前まで」。Web 側も同じ範囲にそろえる:
        # この問題の、番号より後ろ（本文） + 次の問題の見出し（番号より前）、+ 間にある節の見出しなど
        web_by_code[code] = a
# PDF の抽出順は、見出し（「問題」など）が番号の前に出ることがあり、隣の問題の範囲に入る。
# そこで、Web の問題 k の文字が、PDF の問題 k-1, k, k+1 の範囲の合計に収まるかを調べる。
order = [c for _, c in pdf_codes]
def web_body(code):
    a = web_by_code[code]
    head = a.xpath('.//header[@class="problem-head"]')[0]
    return a.text_content().replace(head.text_content(), '', 1)
mismatch = []
for k, code in enumerate(order):
    if code not in web_by_code:
        mismatch.append((code, 'Web にない')); continue
    pool = Counter()
    for j in (k - 1, k, k + 1):
        if 0 <= j < len(order): pool += Counter(ja_only(pdf_by_code[order[j]]))
    extra_web = Counter(ja_only(web_body(code))) - pool
    if extra_web: mismatch.append((code, 'Web にだけある文字', dict(extra_web)))
missing_web = [c for c in web_by_code if c not in pdf_by_code]
print('\n大問ごとの照合:', len(pdf_by_code), '問（Web', len(web_by_code), '問）。Web にだけある文字がある問:', len(mismatch), ' PDF にない問:', len(missing_web))
for m in mismatch[:10]: print('  ', m)
summary.update({'per_problem_checked': len(pdf_by_code), 'per_problem_web_extra': len(mismatch)})
json.dump({'summary': summary}, open('.tmp/fidelity-summary.json', 'w'), ensure_ascii=False, indent=1)
