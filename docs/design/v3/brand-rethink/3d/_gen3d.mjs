// 3D 시안 생성기: 그라디언트·하이라이트·부드러운 그림자로 만든 의사 3D (손으로 쓴 SVG, 래스터·AI 생성·시판 서체 없음)
// '家'는 서체가 아니라 아래 GLYPH에서 획 10개를 직접 좌표로 설계한 패스다.
import { writeFileSync } from 'node:fs';
const OUT = '/Users/hyunseok/Desktop/bumo-jasik/docs/design/v3/brand-rethink/3d';

// ── 家 손그림 획(100×100 글자 상자). 宀 3획 + 豕 7획 = 10획, 필순대로 ──
const GLYPH = [
  'M50 5 L53 15',                         // 宀1 점
  'M18 19 L15 32',                        // 宀2 왼점(세로 점)
  'M18 20 L82 20 Q85 21 81 31',           // 宀3 가로꺾고 갈고리
  'M30 39 L70 39',                        // 豕1 가로
  'M50 39 Q43 50 24 58',                  // 豕2 삐침(머리)
  'M40 52 Q57 55 57 70 Q57 86 49 93 L42 88', // 豕3 굽은 갈고리(弯钩)
  'M50 64 Q40 73 23 79',                  // 豕4 삐침
  'M53 75 Q42 86 22 93',                  // 豕5 삐침
  'M76 54 Q70 61 60 66',                  // 豕6 짧은 삐침(오른쪽 위)
  'M58 71 Q70 84 86 93',                  // 豕7 파임(捺)
];
const glyph = (x, y, s, color, w = 9) =>
  `<g transform="translate(${x} ${y}) scale(${s / 100})" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${GLYPH.map(d => `<path d="${d}"/>`).join('')}</g>`;
// 눌러 찍은 듯한 글자: 아래 어두운 그림자 한 겹 + 위 밝은 면
const glyph3d = (x, y, s, face, shade) => glyph(x, y + 1, s, shade) + glyph(x, y, s, face);

const SHADOW = (id, op = 0.28, c = '#4E2F14') => `<filter id="${id}" x="-30%" y="-30%" width="160%" height="170%"><feGaussianBlur in="SourceAlpha" stdDeviation="2"/><feOffset dy="2.6" result="b"/><feFlood flood-color="${c}" flood-opacity="${op}"/><feComposite in2="b" operator="in"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
const lin = (id, a, b, x2 = 0, y2 = 1) => `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
const rad = (id, a, b, cx = 0.35, cy = 0.3) => `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="0.75"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></radialGradient>`;

// 말랑한 판(두께 + 윗면 그라디언트 + 광택)
const slab = (x, y, w, h, r, face, side, depth = 3) =>
  `<rect x="${x}" y="${y + depth}" width="${w}" height="${h}" rx="${r}" fill="${side}"/>
   <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="url(#${face})"/>
   <rect x="${x + 1}" y="${y + 1}" width="${w - 2}" height="${h - 2}" rx="${r - 1}" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="1.2"/>`;
const gloss = (cx, cy, rx, ry, op = 0.3) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#fff" opacity="${op}" transform="rotate(-18 ${cx} ${cy})"/>`;

// 3D 폴라로이드(흰 카드 두께 + 사진 창)
const polaroid = (x, y, w, h, win, inner) =>
  `<rect x="${x}" y="${y + 2.4}" width="${w}" height="${h}" rx="4" fill="#D9C9B6"/>
   <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="url(#card)"/>
   <rect x="${win[0]}" y="${win[1]}" width="${win[2]}" height="${win[3]}" rx="2" fill="url(#sky)"/>
   <rect x="${win[0]}" y="${win[1]}" width="${win[2]}" height="${win[3]}" rx="2" fill="none" stroke="#4E2F14" stroke-opacity=".12" stroke-width="1"/>${inner}`;
// 광택 있는 해(구슬)
const sun = (cx, cy, r, rays = true) => {
  let d = '';
  if (rays) for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4, r1 = r + 2.2, r2 = r + 4.6;
    d += `M${(cx + r1 * Math.cos(a)).toFixed(2)} ${(cy + r1 * Math.sin(a)).toFixed(2)}L${(cx + r2 * Math.cos(a)).toFixed(2)} ${(cy + r2 * Math.sin(a)).toFixed(2)}`;
  }
  return (rays ? `<path d="${d}" stroke="url(#ray)" stroke-width="2.8" stroke-linecap="round"/>` : '') +
    `<circle cx="${cx}" cy="${cy + 0.8}" r="${r}" fill="#E0861A"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#sun)"/>` +
    `<ellipse cx="${cx - r * 0.35}" cy="${cy - r * 0.4}" rx="${r * 0.38}" ry="${r * 0.22}" fill="#fff" opacity=".7" transform="rotate(-25 ${cx - r * 0.35} ${cy - r * 0.4})"/>`;
};
const COMMON = lin('card', '#FFFFFF', '#F3ECE3') + lin('sky', '#CFE6F7', '#F6EBDD') + rad('sun', '#FFE9A0', '#F6A623') + lin('ray', '#FFC93C', '#F08A0B');

// 처마 지붕(낮고 넓게, 처마 끝이 들림 = 한옥 곡선) + 기와 골
const roof = (face, side, ridge, groove) => `
  <path d="M2 27 Q9 28.5 15 23 Q23 14 32 12 Q41 14 49 23 Q55 28.5 62 27 Q60 33.5 53 33 L11 33 Q4 33.5 2 27 Z" transform="translate(0 2.6)" fill="${side}"/>
  <clipPath id="rc"><path d="M2 27 Q9 28.5 15 23 Q23 14 32 12 Q41 14 49 23 Q55 28.5 62 27 Q60 33.5 53 33 L11 33 Q4 33.5 2 27 Z"/></clipPath>
  <path d="M2 27 Q9 28.5 15 23 Q23 14 32 12 Q41 14 49 23 Q55 28.5 62 27 Q60 33.5 53 33 L11 33 Q4 33.5 2 27 Z" fill="url(#${face})"/>
  <g clip-path="url(#rc)" stroke="${groove}" stroke-width="1.3" stroke-linecap="round" opacity=".55">${[9, 14, 19, 24, 29, 35, 40, 45, 50, 55].map(x => `<path d="M${x} 10 L${x} 35"/>`).join('')}</g>
  <rect x="21" y="9.6" width="22" height="4.6" rx="2.3" fill="${ridge}"/>
  ${gloss(22, 19, 7, 2.4, 0.28)}`;

const SEAL_RED = lin('sealR', '#DD5A44', '#A9311F');
const SYM = {
  'A3D-1': { name: 'A3D-1 · 말랑한 해+폴라로이드', bg: '#FFF4DC', scale: 0.7, font: "'Jua',sans-serif",
    defs: COMMON + SHADOW('ds'),
    body: `<g filter="url(#ds)" transform="rotate(-5 32 32)">${polaroid(11, 4, 42, 54, [15, 8, 34, 32], sun(32, 24, 7.2))}${gloss(20, 10, 6, 2, 0.5)}</g>` },
  'B3D-1': { name: 'B3D-1 · 흙빛 처마 아래 사진', bg: '#FFF4DC', scale: 0.72, font: "'Jua',sans-serif",
    defs: COMMON + SHADOW('ds') + lin('rf', '#A8744A', '#6E4526'),
    body: `<g filter="url(#ds)" transform="translate(2.6 0) scale(0.92)">${polaroid(15, 31, 34, 29, [19, 35, 26, 18], sun(32, 44, 5, false))}${roof('rf', '#4E2F14', '#5A3716', '#3E2410')}</g>` },
  'B3D-2': { name: 'B3D-2 · 먹색 기와 처마(한옥)', bg: '#FFF4DC', scale: 0.72, font: "'Jua',sans-serif",
    defs: COMMON + SHADOW('ds') + lin('rf', '#6F7C88', '#3C4752'),
    body: `<g filter="url(#ds)" transform="translate(2.6 0) scale(0.92)"><rect x="12" y="31" width="40" height="4" rx="1.5" fill="#9A6A40"/>${polaroid(15, 33, 34, 27, [19, 37, 26, 16], sun(32, 45, 4.6, false))}${roof('rf', '#2B333B', '#2E3740', '#222A31')}</g>` },
  'C3D-1': { name: 'C3D-1 · 말랑한 붉은 인장', bg: '#FBF6EE', scale: 0.74, font: "'Gowun Batang',serif",
    defs: SHADOW('ds', 0.32, '#5A1A10') + SEAL_RED,
    body: `<g filter="url(#ds)" transform="rotate(-4 32 32)">${slab(8, 7, 48, 48, 12, 'sealR', '#7E2318', 3.4)}
      <rect x="12.5" y="11.5" width="39" height="39" rx="8" fill="none" stroke="#FFF1E4" stroke-width="2"/>${glyph3d(15, 14, 34, '#FFF4E8', '#7E2318')}${gloss(20, 13, 9, 3)}</g>` },
  'C3D-2': { name: 'C3D-2 · 인장 + 뒤 폴라로이드', bg: '#FBF6EE', scale: 0.74, font: "'Gowun Batang',serif",
    defs: COMMON + SHADOW('ds', 0.3, '#5A1A10') + SEAL_RED,
    body: `<g filter="url(#ds)"><g transform="rotate(12 44 26)">${polaroid(26, 4, 32, 40, [29.5, 7.5, 25, 24], sun(42, 17, 4.4, false))}</g>
      <g transform="rotate(-6 26 38)">${slab(5, 17, 42, 42, 11, 'sealR', '#7E2318', 3.2)}
      <rect x="9" y="21" width="34" height="34" rx="7" fill="none" stroke="#FFF1E4" stroke-width="1.8"/>${glyph3d(11, 23, 30, '#FFF4E8', '#7E2318')}${gloss(15, 22, 8, 2.6)}</g></g>` },
  'C3D-3': { name: 'C3D-3 · 살구빛 말랑 인장', bg: '#FFF4E6', scale: 0.74, font: "'Jua',sans-serif",
    defs: SHADOW('ds', 0.3, '#8A3A1E') + lin('sealA', '#FFA477', '#EE6640'),
    body: `<g filter="url(#ds)" transform="rotate(-6 32 32)">${slab(8, 7, 48, 48, 17, 'sealA', '#C44F2E', 3.6)}${glyph3d(14, 13, 36, '#FFFAF3', '#C44F2E')}${gloss(20, 13, 10, 3.2, 0.35)}</g>` },
  'C3D-4': { name: 'C3D-4 · 사진틀 인장(폴라로이드 속 家)', bg: '#FBF6EE', scale: 0.72, font: "'Gowun Batang',serif",
    defs: COMMON + SHADOW('ds') + SEAL_RED,
    body: `<g filter="url(#ds)" transform="rotate(-5 32 32)">
      <rect x="10" y="6.4" width="44" height="54" rx="5" fill="#D9C9B6"/><rect x="10" y="4" width="44" height="54" rx="5" fill="url(#card)"/>
      <rect x="14.5" y="8.5" width="35" height="35" rx="6" fill="url(#sealR)"/><rect x="14.5" y="10" width="35" height="33.5" rx="6" fill="none" stroke="#7E2318" stroke-opacity=".35" stroke-width="1"/>
      ${glyph3d(17.5, 11.5, 29, '#FFF4E8', '#7E2318')}${gloss(21, 12, 6, 2, 0.32)}${gloss(18, 6, 5, 1.4, 0.6)}</g>` },
};

const PAPER = '#F6F3EE', DARK = '#2A211B', INK = '#4E2F14';
const svg = (w, h, defs, body, title) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img"><title>${title}</title><defs>${defs}</defs>${body}</svg>\n`;
const label = (x, y, t, fs, c = '#fff', a = 'middle') => `<text x="${x}" y="${y}" text-anchor="${a}" font-family="'Apple SD Gothic Neo',sans-serif" font-size="${fs}" fill="${c}">${t}</text>`;

for (const [k, m] of Object.entries(SYM)) {
  const symDef = `<symbol id="S" viewBox="0 0 64 64" overflow="visible">${m.body}</symbol>`;
  writeFileSync(`${OUT}/${k}-symbol.svg`, svg(64, 64, m.defs, m.body, `가화만사성 ${m.name} 심볼`));
  const use = (x, y, s) => `<use href="#S" x="${x}" y="${y}" width="${s}" height="${s}"/>`;
  let n = 0;
  const icon = (x, y, s, shape) => {
    const id = `m${n++}`, r = shape === 'circle' ? s / 2 : s * 0.24, sz = s * m.scale;
    return `<clipPath id="${id}"><rect x="${x}" y="${y}" width="${s}" height="${s}" rx="${r}"/></clipPath><g clip-path="url(#${id})"><rect x="${x}" y="${y}" width="${s}" height="${s}" fill="${m.bg}"/>${use(x + (s - sz) / 2, y + (s - sz) / 2 - s * 0.01, sz)}</g>`;
  };
  const wm = (x, y, dark) => `${use(x, y, 120)}<text x="${x + 136}" y="${y + 62}" font-family="${m.font},'Apple SD Gothic Neo',sans-serif" font-weight="700" font-size="34" fill="${dark ? '#F6EBDD' : INK}">가화만사성</text>
    <text x="${x + 138}" y="${y + 90}" font-family="'Apple SD Gothic Neo',sans-serif" font-size="15" fill="${dark ? '#CDB9A3' : '#7A5A3E'}">하루 한 장, 우리 집 앨범</text>`;
  const launch = (x, y, bg, fg) => `<rect x="${x}" y="${y}" width="375" height="200" rx="16" fill="${bg}"/>
    ${label(x + 16, y + 24, '48dp 실제 크기 · 96px', 12, fg, 'start')}
    ${icon(x + 24, y + 48, 48, 'circle')}${icon(x + 88, y + 48, 48, 'square')}
    ${label(x + 48, y + 114, '가화만사성', 11, fg)}${label(x + 112, y + 114, '가화만사성', 11, fg)}
    ${icon(x + 160, y + 40, 96, 'circle')}${icon(x + 268, y + 40, 96, 'square')}
    ${label(x + 16, y + 180, x ? '밝은 배경화면' : '어두운 배경화면(기본 런처)', 11, fg, 'start')}`;
  const body = `<rect width="760" height="420" fill="#fff"/>
    <rect x="0" y="0" width="375" height="200" rx="16" fill="${PAPER}"/>${wm(16, 40, false)}${label(16, 24, '라이트 · 앱 종이색', 12, '#7A5A3E', 'start')}
    <rect x="385" y="0" width="375" height="200" rx="16" fill="${DARK}"/>${wm(401, 40, true)}${label(401, 24, '다크', 12, '#CDB9A3', 'start')}
    ${launch(0, 212, '#2F3B4A', '#E6ECF2')}${launch(385, 212, '#E9E3DA', '#4E2F14')}`;
  writeFileSync(`${OUT}/${k}.svg`, svg(760, 420, m.defs + symDef, body, `가화만사성 ${m.name} · 심볼·런처·워드마크`));
}

// ── 한 장 비교(HTML → PNG): 계열별 한 줄, 왼쪽 평면 원본, 오른쪽 3D ──
const R = '..', DS = '../../../../../design-system/assets';
const cell = (src, title, bg, flat) => `<div class="cell${flat ? ' flat' : ''}"><div class="t">${title}</div><img class="big" src="${src}">
  <div class="home"><div class="ic c" style="background:${bg}"><img src="${src}"></div><div class="ic s" style="background:${bg}"><img src="${src}"></div><span>48dp</span></div></div>`;
const rows = [
  ['A 해+폴라로이드', [[`${DS}/symbol-sun-polaroid.svg`, '현재 원본(평면)', '#FFF4DC', 1], [`${R}/A-symbol.svg`, '패널 A(평면)', '#FFF4DC', 1], ['A3D-1-symbol.svg', SYM['A3D-1'].name, '#FFF4DC']]],
  ['B 처마 아래 앨범', [[`${R}/B-symbol.svg`, '패널 B(평면·패널 추천)', '#FFF4DC', 1], ['B3D-1-symbol.svg', SYM['B3D-1'].name, '#FFF4DC'], ['B3D-2-symbol.svg', SYM['B3D-2'].name, '#FFF4DC']]],
  ['C 붉은 인장 家', [[`${R}/C-symbol.svg`, '원래 C(평면·서체 글자)', '#FBF6EE', 1], ...['C3D-1', 'C3D-2', 'C3D-3', 'C3D-4'].map(k => [`${k}-symbol.svg`, SYM[k].name, SYM[k].bg])]],
];
writeFileSync(`${OUT}/compare-3d.html`, `<!doctype html><meta charset="utf-8"><title>가화만사성 3D 비교</title>
<style>body{margin:0;padding:24px;background:#F6F3EE;font-family:'Apple SD Gothic Neo',sans-serif;color:#4E2F14;width:1100px}
h1{font-size:22px;margin:0 0 4px}p{margin:0 0 16px;color:#7A5A3E;font-size:14px}
.row{display:flex;align-items:stretch;gap:12px;margin-bottom:14px}.rh{width:92px;font-weight:700;font-size:16px;padding-top:8px}
.cell{width:168px;background:#fff;border-radius:14px;padding:10px;display:flex;flex-direction:column;align-items:center;gap:8px}
.cell.flat{background:#EFE9E0}.t{font-size:12px;height:32px;text-align:center;line-height:1.3}.big{width:112px;height:112px}
.home{background:#2F3B4A;border-radius:10px;width:100%;display:flex;gap:10px;justify-content:center;align-items:center;padding:10px 0;color:#C9D3DE;font-size:11px}
.ic{width:48px;height:48px;overflow:hidden;display:flex;align-items:center;justify-content:center}.ic.c{border-radius:24px}.ic.s{border-radius:11.5px}.ic img{width:34px;height:34px}</style>
<h1>가화만사성 · 3D 시안 비교 (같은 크기: 심볼 112px, 런처 48dp 원형·둥근사각)</h1>
<p>회색 칸 = 평면 원본, 흰 칸 = 3D 시안. 모두 손으로 쓴 SVG(AI 생성·시판 서체 없음, 3D 안의 家는 직접 설계한 획). 앱 미반영.</p>
${rows.map(([h, cs]) => `<div class="row"><div class="rh">${h}</div>${cs.map(c => cell(...c)).join('')}</div>`).join('')}`);
console.log('ok');
