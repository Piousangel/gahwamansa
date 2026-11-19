/* 디렉터 A 시안 공통: 글자 배율(?s=2), 펼침(?full=1), 접힘 경계 맞춤(R-15), 측정(잘림·겹침·대비·누름 높이).
   측정 결과는 <script id="measure" type="application/json">에 쓰고, tools/render.sh 가 --dump-dom 으로 읽는다. */
(function () {
  var q = new URLSearchParams(location.search);
  var s = parseFloat(q.get('s') || '1');
  var full = q.get('full') === '1';
  document.documentElement.style.setProperty('--s', s);
  if (full) document.documentElement.classList.add('full');
  document.documentElement.classList.add(s >= 1.5 ? 'fs2' : 'fs1');

  function lum(c) {
    var v = c.map(function (x) { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); });
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  }
  function rgb(str) { var m = str.match(/[\d.]+/g); return m ? m.map(Number) : null; }
  function ratio(a, b) { var x = lum(a), y = lum(b); if (x < y) { var t = x; x = y; y = t; } return Math.round((x + 0.05) / (y + 0.05) * 100) / 100; }
  function bgOf(el) {
    for (var e = el; e && e.nodeType === 1; e = e.parentElement) {
      var cs = getComputedStyle(e);
      if (e.dataset.bg) return rgb(e.dataset.bg);           // 무늬 면은 data-bg 로 대표색을 적는다
      var c = rgb(cs.backgroundColor);
      if (c && (c.length < 4 || c[3] > 0.99)) return c.slice(0, 3);
    }
    return [255, 255, 255];
  }
  function ownText(el) {
    for (var n = el.firstChild; n; n = n.nextSibling) if (n.nodeType === 3 && n.textContent.trim()) return true;
    return false;
  }
  function lineRects(el) {
    var r = document.createRange(); var out = [];
    for (var n = el.firstChild; n; n = n.nextSibling) {
      if (n.nodeType === 3 && n.textContent.trim()) { r.selectNodeContents(n); out = out.concat([].slice.call(r.getClientRects())); }
    }
    return out.filter(function (x) { return x.width > 0.5 && x.height > 0.5; });
  }
  function hit(a, b) { var w = Math.min(a.right, b.right) - Math.max(a.left, b.left); var h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top); return w > 1 && h > 1 ? w * h : 0; }

  function snapFold() {
    var sc = document.querySelector('.scroll'); if (!sc || full) return;
    document.body.classList.remove('has-more');
    if (sc.scrollHeight <= sc.clientHeight + 1) return;
    document.body.classList.add('has-more');
    var fold = sc.getBoundingClientRect().bottom;
    var blks = [].slice.call(sc.querySelectorAll('.blk'));
    var crossing = blks.filter(function (b) { var r = b.getBoundingClientRect(); return r.top < fold - 1 && r.bottom > fold + 1; });
    var leaf = crossing.filter(function (b) { return !crossing.some(function (o) { return o !== b && b.contains(o); }); });
    if (leaf.length) {
      var b = leaf[0], r = b.getBoundingClientRect();
      var mt = parseFloat(getComputedStyle(b).marginTop) || 0;
      b.style.marginTop = (mt + (fold - r.top) + 8) + 'px';
      b.dataset.pushed = '1'; window.__pushed = (b.className || b.tagName) + ' ' + Math.round(fold - r.top);
    }
  }

  function measure() {
    var who = document.body.classList.contains('child') ? 'child' : 'elder';
    var min = who === 'child' ? 16 : 20, need = who === 'child' ? 4.5 : 7;
    var vw = document.documentElement.clientWidth;
    var sc = document.querySelector('.scroll');
    var fold = sc && !full ? sc.getBoundingClientRect().bottom : Infinity;
    var texts = [].slice.call(document.querySelectorAll('.phone *')).filter(function (e) {
      return ownText(e) && !e.closest('.sian') && !e.closest('[aria-hidden="true"]') && getComputedStyle(e).visibility !== 'hidden';
    });
    var rep = { who: who, scale: s, full: full, vw: vw, texts: texts.length, small: [], lowContrast: [], clipped: [], overlap: [], foldCut: [], tapShort: [], dockRatio: null, more: document.body.classList.contains('has-more') };
    // 스크롤 영역 밖(접힘 아래)으로 가려진 줄은 겹침 검사에서 뺀다(보이지 않음)
    var rects = texts.map(function (e) {
      var r = lineRects(e);
      var ov = r.filter(function (x) { return !(sc && sc.contains(e) && x.top >= fold - 2); });
      return { e: e, r: ov };
    });
    texts.forEach(function (e, i) {
      var cs = getComputedStyle(e), fs = parseFloat(cs.fontSize), label = e.textContent.trim().slice(0, 18);
      var minHere = e.closest('.hand') ? 30 : min;
      if (fs < minHere - 0.01) rep.small.push(label + ' ' + fs + 'px');
      var c = ratio(rgb(cs.color).slice(0, 3), bgOf(e));
      if (c < need) rep.lowContrast.push(label + ' ' + c);
      rects[i].r.forEach(function (lr) {
        if (lr.left < -0.5 || lr.right > vw + 0.5) rep.clipped.push(label + ' x');
        if (lr.top < fold - 2 && lr.bottom > fold + 2) rep.foldCut.push(label);
      });
      if (e.scrollWidth > e.clientWidth + 1 && cs.overflow !== 'visible') rep.clipped.push(label + ' scrollW');
    });
    for (var i = 0; i < rects.length; i++) for (var j = i + 1; j < rects.length; j++) {
      if (rects[i].e.contains(rects[j].e) || rects[j].e.contains(rects[i].e)) continue;
      var a = 0; rects[i].r.forEach(function (x) { rects[j].r.forEach(function (y) { a += hit(x, y); }); });
      if (a > 4) rep.overlap.push(rects[i].e.textContent.trim().slice(0, 12) + ' / ' + rects[j].e.textContent.trim().slice(0, 12) + ' ' + Math.round(a));
    }
    [].slice.call(document.querySelectorAll('.tap')).forEach(function (t) {
      var h = t.getBoundingClientRect().height, m = parseFloat(t.dataset.min || (who === 'child' ? 48 : 64));
      if (h < m - 0.5) rep.tapShort.push(t.textContent.trim().slice(0, 12) + ' ' + Math.round(h) + '<' + m);
    });
    var dock = document.querySelector('.dock');
    if (dock && !full) rep.dockRatio = Math.round(dock.getBoundingClientRect().height / window.innerHeight * 100) / 100;
    rep.pushed = window.__pushed || null;
    rep.docH = Math.ceil(document.querySelector('.phone').getBoundingClientRect().height);
    var tag = document.createElement('script'); tag.type = 'application/json'; tag.id = 'measure';
    tag.textContent = JSON.stringify(rep); document.body.appendChild(tag);
    document.title = 'MEASURED';
  }

  function run() { snapFold(); requestAnimationFrame(function () { measure(); }); }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { setTimeout(run, 60); }); else window.addEventListener('load', run);
})();
