// HTML を組むための小さな道具。テンプレートエンジンは使わない。

export function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** タグ付きテンプレート。${} の値は既定でエスケープし、raw() で包んだものだけそのまま入れる。 */
export function html(strings, ...values) {
  let out = '';
  strings.forEach((s, i) => {
    out += s;
    if (i < values.length) out += toHtml(values[i]);
  });
  return raw(out);
}

class Raw {
  constructor(s) { this.s = s; }
  toString() { return this.s; }
}
export function raw(s) { return new Raw(s); }

function toHtml(v) {
  if (v === null || v === undefined || v === false) return '';
  if (v instanceof Raw) return v.s;
  if (Array.isArray(v)) return v.map(toHtml).join('');
  return esc(v);
}
