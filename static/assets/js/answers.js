// 横にはみ出す数式の枠だけ、キーボードで横スクロールできるようにする。
// JavaScript が無効でも、数式はマウスや指で横スクロールでき、文章とリンクは使える。
(function () {
  function mark() {
    var list = document.querySelectorAll('.math-display, .table-wrap');
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      var wide = el.scrollWidth > el.clientWidth + 4;
      if (wide) {
        el.setAttribute('tabindex', '0');
        el.setAttribute('role', 'region');
        el.setAttribute('aria-label', '横にスクロールできる数式');
        el.classList.add('is-wide');
      } else if (el.classList.contains('is-wide')) {
        el.removeAttribute('tabindex');
        el.removeAttribute('role');
        el.removeAttribute('aria-label');
        el.classList.remove('is-wide');
      }
    }
  }
  var t;
  window.addEventListener('resize', function () { clearTimeout(t); t = setTimeout(mark, 200); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(mark); else window.addEventListener('load', mark);
})();
