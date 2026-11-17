// C3D-2 다듬기(v2): 인장 + 뒤 '옛날 사진' 폴라로이드. 손으로 쓴 SVG(AI 생성·시판 서체 없음). 家는 _gen3d.mjs와 같은 손그림 획.
// 4안 = 인장색(진홍/살구) × 햇살 선(유/무). 각 안에 상세판(큰 크기)과 단순판(48dp 런처용) 심볼을 따로 낸다.
import { writeFileSync } from 'node:fs';
const OUT = '/Users/hyunseok/Desktop/bumo-jasik/docs/design/v3/brand-rethink/3d';

const GLYPH = ['M50 5 L53 15', 'M18 19 L15 32', 'M18 20 L82 20 Q85 21 81 31', 'M30 39 L70 39', 'M50 39 Q43 50 24 58',
  'M40 52 Q57 55 57 70 Q57 86 49 93 L42 88', 'M50 64 Q40 73 23 79', 'M53 75 Q42 86 22 93', 'M76 54 Q70 61 60 66', 'M58 71 Q70 84 86 93'];
const glyph = (x, y, s, c, w) => `<g transform="translate(${x} ${y}) scale(${s / 100})" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${GLYPH.map(d => `<path d="${d}"/>`).join('')}</g>`;
const glyph3d = (x, y, s, face, shade, w = 9) => glyph(x, y + 1, s, shade, w) + glyph(x, y, s, face, w);
const lin = (id, a, b, x2 = 0, y2 = 1) => `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
const gloss = (cx, cy, rx, ry, op = 0.3) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#fff" opacity="${op}" transform="rotate(-18 ${cx} ${cy})"/>`;

const SEAL = {
  red: { name: '진홍', face: ['#DD5A44', '#A9311F'], side: '#7E2318', glyph: '#FFF4E8', border: true, r: 11 },
  apricot: { name: '살구', face: ['#FFA477', '#EE6640'], side: '#C44F2E', glyph: '#FFFAF3', border: false, r: 14 },
};

const DEFS = (s) => `
  <filter id="ds" x="-30%" y="-30%" width="160%" height="170%"><feGaussianBlur in="SourceAlpha" stdDeviation="2"/><feOffset dy="2.6" result="b"/><feFlood flood-color="#4E2F14" flood-opacity=".28"/><feComposite in2="b" operator="in"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <filter id="cast" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="2.4"/></filter>
  ${lin('card', '#FFFDF8', '#EFE5D6')}
  ${lin('sky', '#F2C58E', '#F9E7C8')}
  ${lin('hillFar', '#C9AE8E', '#B79A7A')}
  ${lin('hillNear', '#A9A26C', '#87804F')}
  ${lin('ray', '#F59E0B', '#E0452B', 1, 1)}
  ${lin('seal', s.face[0], s.face[1])}
  <radialGradient id="sun" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="#FFF0B8"/><stop offset="1" stop-color="#F59A2A"/></radialGradient>
  <radialGradient id="vig" cx=".5" cy=".45" r=".75"><stop offset=".55" stop-color="#5A3716" stop-opacity="0"/><stop offset="1" stop-color="#5A3716" stop-opacity=".35"/></radialGradient>
  <linearGradient id="sheen" x1="0" y1="0" x2="1" y2="1"><stop offset=".25" stop-color="#fff" stop-opacity="0"/><stop offset=".42" stop-color="#fff" stop-opacity=".35"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/></linearGradient>`;

// 해(구슬) + 햇살 선 8개(짧은 둥근 선, 주황→붉은)
const sun = (cx, cy, r, rays, rw) => {
  let d = '';
  if (rays) for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 + Math.PI / 8 * 0, r1 = r + rw * 0.9, r2 = r + rw * 2.1;
    d += `M${(cx + r1 * Math.cos(a)).toFixed(2)} ${(cy + r1 * Math.sin(a)).toFixed(2)}L${(cx + r2 * Math.cos(a)).toFixed(2)} ${(cy + r2 * Math.sin(a)).toFixed(2)}`;
  }
  return (rays ? `<path d="${d}" stroke="url(#ray)" stroke-width="${rw}" stroke-linecap="round"/>` : '') +
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#sun)"/><ellipse cx="${cx - r * .35}" cy="${cy - r * .38}" rx="${r * .36}" ry="${r * .2}" fill="#fff" opacity=".65"/>`;
};

// 옛날 사진 장면(사진 창 좌표계 x,y,w,h). simple=48dp용: 하늘·언덕 하나·큰 해만
const scene = (x, y, w, h, rays, simple) => {
  const X = (t) => (x + w * t).toFixed(2), Y = (t) => (y + h * t).toFixed(2);
  const clip = `<clipPath id="ph"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.2"/></clipPath>`;
  let g = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#sky)"/>`;
  if (simple) {
    g += sun(+X(.62), +Y(.36), w * .15, rays, 2.1);
    g += `<path d="M${X(-.05)} ${Y(.78)} Q${X(.3)} ${Y(.5)} ${X(.62)} ${Y(.68)} Q${X(.85)} ${Y(.6)} ${X(1.05)} ${Y(.66)} L${X(1.05)} ${Y(1.05)} L${X(-.05)} ${Y(1.05)} Z" fill="url(#hillNear)"/>`;
  } else {
    g += sun(+X(.68), +Y(.3), w * .11, rays, 1.5);
    g += `<path d="M${X(-.05)} ${Y(.62)} Q${X(.18)} ${Y(.4)} ${X(.36)} ${Y(.55)} Q${X(.55)} ${Y(.38)} ${X(.78)} ${Y(.56)} Q${X(.9)} ${Y(.5)} ${X(1.05)} ${Y(.55)} L${X(1.05)} ${Y(1.05)} L${X(-.05)} ${Y(1.05)} Z" fill="url(#hillFar)"/>`;
    g += `<path d="M${X(-.05)} ${Y(.8)} Q${X(.25)} ${Y(.62)} ${X(.55)} ${Y(.74)} Q${X(.8)} ${Y(.66)} ${X(1.05)} ${Y(.72)} L${X(1.05)} ${Y(1.05)} L${X(-.05)} ${Y(1.05)} Z" fill="url(#hillNear)"/>`;
    // 마을 지붕 실루엣(처마 셋)
    const roofAt = (cx, cy, s) => `<path d="M${cx - s} ${cy} Q${cx - s * .6} ${cy - s * .15} ${cx - s * .45} ${cy - s * .5} L${cx + s * .45} ${cy - s * .5} Q${cx + s * .6} ${cy - s * .15} ${cx + s} ${cy} Z" fill="#6B4A33"/><rect x="${cx - s * .6}" y="${cy}" width="${s * 1.2}" height="${s * .5}" fill="#E9D8BC"/>`;
    g += roofAt(+X(.58), +Y(.86), w * .08) + roofAt(+X(.74), +Y(.9), w * .1) + roofAt(+X(.92), +Y(.87), w * .07);
  }
  // 빛바램: 세피아 한 겹 + 가장자리 어둡게 + 대각선 은은한 광택
  g += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#D9A15C" opacity=".14"/><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#vig)"/><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#sheen)"/>`;
  return `${clip}<g clip-path="url(#ph)">${g}</g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.2" fill="none" stroke="#4E2F14" stroke-opacity=".18" stroke-width=".8"/>`;
};

const symbol = (sealKey, rays, simple) => {
  const s = SEAL[sealKey];
  // 폴라로이드: 오른쪽 위로 비켜 나오고 +11° 기울기. 아래 흰 여백이 두껍게(진짜 폴라로이드 비율)
  const P = { x: 26, y: 1, w: 34, h: 41 }, win = { x: 29, y: 4, w: 28, h: 27 };
  const pol = `<g transform="rotate(11 ${P.x + P.w / 2} ${P.y + P.h / 2})">
    <rect x="${P.x}" y="${P.y + 2.2}" width="${P.w}" height="${P.h}" rx="2.6" fill="#D2BFA8"/>
    <rect x="${P.x}" y="${P.y}" width="${P.w}" height="${P.h}" rx="2.6" fill="url(#card)"/>
    <rect x="${P.x + .6}" y="${P.y + .6}" width="${P.w - 1.2}" height="${P.h - 1.2}" rx="2.2" fill="none" stroke="#fff" stroke-opacity=".8" stroke-width=".8"/>
    ${scene(win.x, win.y, win.w, win.h, rays, simple)}</g>`;
  // 인장: 왼쪽 아래 앞, -6°. 사진 위에 떨어지는 그림자(블러)로 앞뒤 구분
  const S = { x: 4, y: 19, w: 41 };
  const seal = `<g transform="rotate(-6 ${S.x + S.w / 2} ${S.y + S.w / 2})">
    <rect x="${S.x + 3}" y="${S.y + 2}" width="${S.w}" height="${S.w}" rx="${s.r}" fill="#3A1A10" opacity=".38" filter="url(#cast)"/>
    <rect x="${S.x}" y="${S.y + 3.2}" width="${S.w}" height="${S.w}" rx="${s.r}" fill="${s.side}"/>
    <rect x="${S.x}" y="${S.y}" width="${S.w}" height="${S.w}" rx="${s.r}" fill="url(#seal)"/>
    <rect x="${S.x + 1}" y="${S.y + 1}" width="${S.w - 2}" height="${S.w - 2}" rx="${s.r - 1}" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="1.2"/>
    ${s.border ? `<rect x="${S.x + 4}" y="${S.y + 4}" width="${S.w - 8}" height="${S.w - 8}" rx="${s.r - 4}" fill="none" stroke="#FFF1E4" stroke-width="1.8"/>` : ''}
    ${s.border ? glyph3d(S.x + 6, S.y + 6, 29, s.glyph, s.side, simple ? 10.5 : 9) : glyph3d(S.x + 4.5, S.y + 4.5, 32, s.glyph, s.side, simple ? 11 : 9.5)}
    ${gloss(S.x + 10, S.y + 5, 8, 2.6, .32)}</g>`;
  return `<g filter="url(#ds)" transform="translate(3.5 3.2) scale(0.89)">${pol}${seal}</g>`;
};

const VARIANTS = [
  ['C3D-2v2-a', 'red', true], ['C3D-2v2-b', 'red', false], ['C3D-2v2-c', 'apricot', true], ['C3D-2v2-d', 'apricot', false],
];
const NAME = (k, seal, rays) => `${k.slice(-1).toUpperCase()} · ${SEAL[seal].name} 인장 · 햇살 ${rays ? '있음' : '없음'}`;
const svg = (defs, body, title) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" overflow="visible" role="img"><title>${title}</title><defs>${defs}</defs>${body}</svg>\n`;
for (const [k, seal, rays] of VARIANTS) {
  writeFileSync(`${OUT}/${k}-symbol.svg`, svg(DEFS(SEAL[seal]), symbol(seal, rays, false), `가화만사성 ${NAME(k, seal, rays)} 심볼(상세판)`));
  writeFileSync(`${OUT}/${k}-symbol-small.svg`, svg(DEFS(SEAL[seal]), symbol(seal, rays, true), `가화만사성 ${NAME(k, seal, rays)} 심볼(48dp 단순판)`));
}

// 비교 한 장: 안마다 한 줄 = 큰 심볼(상세) · 48dp 원형/둥근사각(단순판, 어두운·밝은 배경화면) · 96px · 스플래시
const bgIcon = '#FBF6EE';
const ic = (src, shape, size = 48) => `<div class="ic ${shape}" style="width:${size}px;height:${size}px;border-radius:${shape === 'c' ? size / 2 : size * .24}px"><img src="${src}" style="width:${size * .76}px;height:${size * .76}px"></div>`;
const row = ([k, seal, rays]) => `<div class="row"><div class="rh"><b>${k.slice(-1).toUpperCase()}</b><br>${SEAL[seal].name} 인장<br>햇살 ${rays ? '있음' : '없음'}</div>
  <div class="cell"><img src="${k}-symbol.svg" class="big"><span>상세판 160px</span></div>
  <div class="cell"><div class="home dark">${ic(`${k}-symbol-small.svg`, 'c')}${ic(`${k}-symbol-small.svg`, 's')}</div><div class="home light">${ic(`${k}-symbol-small.svg`, 'c')}${ic(`${k}-symbol-small.svg`, 's')}</div><span>48dp 단순판 (어두운·밝은 배경)</span></div>
  <div class="cell"><div class="home dark">${ic(`${k}-symbol-small.svg`, 's', 96)}</div><span>96px</span></div>
  <div class="cell"><div class="splash"><img src="${k}-symbol.svg"><b>가화만사성</b><small>하루 한 장, 우리 집 앨범</small></div><span>스플래시</span></div>
  <div class="cell"><div class="home dark">${ic(`${k}-symbol.svg`, 's')}</div><span>참고: 상세판을<br>48dp로 줄이면</span></div></div>`;
writeFileSync(`${OUT}/compare-3d-v2.html`, `<!doctype html><meta charset="utf-8"><title>가화만사성 C3D-2 다듬기</title>
<style>body{margin:0;padding:24px;background:#F6F3EE;font-family:'Apple SD Gothic Neo',sans-serif;color:#4E2F14;width:1000px}
h1{font-size:21px;margin:0 0 4px}p{margin:0 0 14px;color:#7A5A3E;font-size:13px}
.row{display:flex;gap:10px;margin-bottom:12px;align-items:stretch}.rh{width:86px;font-size:13px;line-height:1.5;padding-top:6px}.rh b{font-size:22px}
.cell{background:#fff;border-radius:14px;padding:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;font-size:11px;color:#7A5A3E;text-align:center}
.big{width:160px;height:160px}.home{border-radius:10px;padding:10px 12px;display:flex;gap:10px}.dark{background:#2F3B4A}.light{background:#E9E3DA}
.ic{background:${bgIcon};overflow:hidden;display:flex;align-items:center;justify-content:center}
.splash{width:96px;height:180px;border-radius:14px;background:#F6F3EE;border:1px solid #E6DCD0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px}
.splash img{width:64px;height:64px}.splash b{font-size:13px}.splash small{font-size:7px;color:#7A5A3E}</style>
<h1>가화만사성 · C3D-2 다듬기 (인장 + 뒤 옛날 사진) 4안</h1>
<p>인장색(진홍/살구) × 햇살 선(유/무). 큰 크기는 상세판(언덕 둘·마을 지붕·빛바램), 48dp는 단순판(하늘·언덕 하나·큰 해). 손으로 쓴 SVG, AI 생성·시판 서체 없음. 앱 미반영.</p>
${VARIANTS.map(row).join('')}`);
console.log('ok');
