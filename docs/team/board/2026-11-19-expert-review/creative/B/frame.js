/* 디렉터 B 시안 공통 틀.
 * 주소: <안>.html?s=P3&f=2  (s = 화면 id, f = 글자 배율 1 또는 2. 역할별 상한은 CSS 변수 --f15·--f20 으로 적용)
 * 하는 일
 *  1) 화면 하나만 보이기, 배율 변수 넣기
 *  2) R-15 접힘 경계: 스크롤 영역 끝에 걸친 .blk 를 간격으로 통째로 아래로 밀고, 넘칠 때만 '더 있음' 띠(R-19)
 *  3) DOM 측정: 걸침·겹침·가로 넘침·Dock 비율·최소 글자·누름 높이 → <pre id="m"> JSON (Chrome --dump-dom 으로 읽음)
 */
(function () {
  const q = new URLSearchParams(location.search);
  const sid = q.get('s') || 'P3';
  const f = Math.max(1, Math.min(2, parseFloat(q.get('f') || '1')));
  const root = document.documentElement;
  root.style.setProperty('--f20', f);
  root.style.setProperty('--f15', Math.min(f, 1.5));
  document.querySelectorAll('.scr').forEach(s => { s.hidden = s.dataset.id !== sid; });
  const scr = document.querySelector(`.scr[data-id="${sid}"]`);
  if (!scr) return;
  const elder = scr.dataset.who !== 'child';

  function foldFix() {
    const body = scr.querySelector('.body');
    const more = scr.querySelector('.more');
    if (!body) return;
    const H = body.clientHeight;
    const top0 = body.getBoundingClientRect().top - body.scrollTop;
    for (const b of body.querySelectorAll('.blk')) {
      const r = b.getBoundingClientRect();
      const t = r.top - top0, bt = r.bottom - top0;
      if (r.height >= H) continue; // 한 화면보다 큰 덩어리는 밀지 않는다(안쪽 .blk 가 처리)
      if (t < H && bt > H) {
        const cur = parseFloat(getComputedStyle(b).marginTop) || 0;
        b.style.marginTop = (cur + (H - t) + 1) + 'px';
      }
    }
    if (more) more.hidden = !(body.scrollHeight > body.clientHeight + 1);
  }

  function measure() {
    const out = { screen: sid, scale: f, who: elder ? 'elder' : 'child', straddle: [], overlap: [], overflowX: [], smallText: [], smallTap: [] };
    const sr = scr.getBoundingClientRect();
    const body = scr.querySelector('.body');
    const dock = scr.querySelector('.dock');
    if (body) {
      const br = body.getBoundingClientRect();
      // 보이는 창 아래 끝에 걸친 글줄·요소(잎 노드 기준)
      const leaves = [...body.querySelectorAll('*')].filter(e => e.children.length === 0 && e.offsetParent !== null);
      for (const e of leaves) {
        const r = e.getBoundingClientRect();
        if (r.height === 0) continue;
        if (r.top < br.bottom - 1 && r.bottom > br.bottom + 1) out.straddle.push((e.textContent || e.tagName).trim().slice(0, 24) || e.tagName);
      }
      // 같은 부모 아래 .blk 끼리 겹침
      const blks = [...body.querySelectorAll('.blk')];
      for (let i = 0; i < blks.length; i++) for (let j = i + 1; j < blks.length; j++) {
        const a = blks[i], b = blks[j];
        if (a.contains(b) || b.contains(a) || a.parentElement !== b.parentElement) continue;
        const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
        const ov = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
        const ovx = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
        if (ov > 1 && ovx > 1) out.overlap.push([(a.textContent || '').trim().slice(0, 12), (b.textContent || '').trim().slice(0, 12)]);
      }
      out.bodyOverflow = body.scrollHeight > body.clientHeight + 1;
    }
    for (const e of scr.querySelectorAll('*')) {
      const r = e.getBoundingClientRect();
      if (r.width && (r.right > sr.right + 0.5 || r.left < sr.left - 0.5) && !e.closest('.bleed') && !e.closest('.sr')) out.overflowX.push(e.className || e.tagName);
      if (e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX !== 'visible' && e.clientWidth && !e.classList.contains('sr')) out.overflowX.push('clip:' + (e.className || e.tagName));
    }
    const minFs = elder ? 20 : 16;
    const walker = document.createTreeWalker(scr, NodeFilter.SHOW_TEXT);
    let n; while ((n = walker.nextNode())) {
      if (!n.textContent.trim()) continue;
      const el = n.parentElement; if (el.closest('[aria-hidden="true"]') || el.closest('.deco')) continue;
      const fs = parseFloat(getComputedStyle(el).fontSize);
      if (fs < minFs) out.smallText.push(n.textContent.trim().slice(0, 16) + ' ' + fs);
    }
    const minTap = elder ? 64 : 48;
    for (const t of scr.querySelectorAll('.tap')) {
      const r = t.getBoundingClientRect();
      if (r.height < minTap - 0.5) out.smallTap.push((t.textContent || '').trim().slice(0, 12) + ' ' + Math.round(r.height));
    }
    if (dock) out.dockRatio = Math.round(dock.getBoundingClientRect().height / sr.height * 100) / 100;
    out.moreBand = !!(scr.querySelector('.more') && !scr.querySelector('.more').hidden);
    out.ok = !out.straddle.length && !out.overlap.length && !out.overflowX.length && !out.smallText.length && !out.smallTap.length && (out.dockRatio || 0) <= 0.4;
    let m = document.getElementById('m');
    if (!m) { m = document.createElement('pre'); m.id = 'm'; m.hidden = true; document.body.appendChild(m); }
    m.textContent = JSON.stringify(out);
  }

  // headless 에서는 requestAnimationFrame 이 안 돌 수 있어 setTimeout 을 쓴다
  const run = () => { foldFix(); setTimeout(() => { foldFix(); measure(); }, 30); };
  let done = false;
  const once = () => { if (done) return; done = true; run(); };
  const go = () => (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => setTimeout(once, 50));
  if (document.readyState === 'complete') go(); else window.addEventListener('load', go);
  setTimeout(once, 3000); // 글꼴·사진이 늦어도 측정은 남긴다
})();
