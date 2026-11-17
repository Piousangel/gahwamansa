// 가화만사성 브랜드 에셋 생성기 (확정: C3D-2 v2 D안 = 살구 인장 '家' + 뒤 빛바랜 사진, 햇살 없음)
// 손으로 쓴 SVG. AI 생성·시판 서체 없음. '家'는 직접 설계한 획 10개(宀 3 + 豕 7), 배지 'T'도 사각 패스.
// 실행: node gen.mjs && sh render.sh  (PNG는 render.sh가 헤드리스 크롬으로 렌더)
import { writeFileSync, mkdirSync } from 'node:fs';
const B = '/Users/hyunseok/Desktop/bumo-jasik/design-system/assets/brand';
const w = (p, s) => { mkdirSync(p.replace(/\/[^/]+$/, ''), { recursive: true }); writeFileSync(p, s); };

// ── 색 ── (평면판은 앱 토큰 + 새 브랜드 토큰 2개만)
const T = { paper: '#F6F3EE', card: '#FFFFFF', inkTitle: '#4E2F14', sky: '#CFE6F7', sun: '#FFC93C', doneSoft: '#CDEBDD' };
const BRAND = { seal: '#EE6A44', sealDeep: '#C44F2E', sealGlyph: '#FFFAF3', iconBg: '#FBF6EE', stagingNavy: '#1F2A5C' };

// ── 家 획 ──
const GLYPH = ['M50 5 L53 15', 'M18 19 L15 32', 'M18 20 L82 20 Q85 21 81 31', 'M30 39 L70 39', 'M50 39 Q43 50 24 58',
  'M40 52 Q57 55 57 70 Q57 86 49 93 L42 88', 'M50 64 Q40 73 23 79', 'M53 75 Q42 86 22 93', 'M76 54 Q70 61 60 66', 'M58 71 Q70 84 86 93'];
const glyph = (x, y, s, c, sw) => `<g transform="translate(${x} ${y}) scale(${s / 100})" fill="none" stroke="${c}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${GLYPH.map(d => `<path d="${d}"/>`).join('')}</g>`;
const lin = (id, a, b, x2 = 0, y2 = 1) => `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;

const DEFS3D = (small) => `
  <filter id="ds" x="-30%" y="-30%" width="160%" height="170%"><feGaussianBlur in="SourceAlpha" stdDeviation="2"/><feOffset dy="2.6" result="b"/><feFlood flood-color="#4E2F14" flood-opacity=".28"/><feComposite in2="b" operator="in"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <filter id="cast" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="2.4"/></filter>
  ${lin('card', '#FFFDF8', '#EFE5D6')}
  ${small ? lin('sky', '#B9D9EC', '#F3E8D2') : lin('sky', '#F2C58E', '#F9E7C8')}
  ${lin('hillFar', '#C9AE8E', '#B79A7A')}
  ${small ? lin('hillNear', '#9FB36A', '#7C8C48') : lin('hillNear', '#A9A26C', '#87804F')}
  ${lin('seal', '#FFA477', '#EE6640')}
  <radialGradient id="sun" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="#FFF0B8"/><stop offset="1" stop-color="#F59A2A"/></radialGradient>
  <radialGradient id="vig" cx=".5" cy=".45" r=".75"><stop offset=".55" stop-color="#5A3716" stop-opacity="0"/><stop offset="1" stop-color="#5A3716" stop-opacity="${small ? .2 : .35}"/></radialGradient>
  <linearGradient id="sheen" x1="0" y1="0" x2="1" y2="1"><stop offset=".25" stop-color="#fff" stop-opacity="0"/><stop offset=".42" stop-color="#fff" stop-opacity=".35"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/></linearGradient>`;

const sun = (cx, cy, r) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#sun)"/><ellipse cx="${cx - r * .35}" cy="${cy - r * .38}" rx="${r * .36}" ry="${r * .2}" fill="#fff" opacity=".65"/>`;
const scene = (x, y, wd, h, small) => {
  const X = t => (x + wd * t).toFixed(2), Y = t => (y + h * t).toFixed(2);
  let g = `<rect x="${x}" y="${y}" width="${wd}" height="${h}" fill="url(#sky)"/>`;
  if (small) { // 48dp 단순판: 하늘·언덕 하나·큰 해. 인장이 왼쪽 아래를 가리므로 해와 능선을 오른쪽 위에 둔다
    g += sun(+X(.64), +Y(.32), wd * .17);
    g += `<path d="M${X(-.05)} ${Y(.72)} Q${X(.35)} ${Y(.48)} ${X(.66)} ${Y(.62)} Q${X(.86)} ${Y(.55)} ${X(1.05)} ${Y(.6)} L${X(1.05)} ${Y(1.05)} L${X(-.05)} ${Y(1.05)} Z" fill="url(#hillNear)"/>`;
  } else {
    g += sun(+X(.68), +Y(.3), wd * .11);
    g += `<path d="M${X(-.05)} ${Y(.62)} Q${X(.18)} ${Y(.4)} ${X(.36)} ${Y(.55)} Q${X(.55)} ${Y(.38)} ${X(.78)} ${Y(.56)} Q${X(.9)} ${Y(.5)} ${X(1.05)} ${Y(.55)} L${X(1.05)} ${Y(1.05)} L${X(-.05)} ${Y(1.05)} Z" fill="url(#hillFar)"/>`;
    g += `<path d="M${X(-.05)} ${Y(.8)} Q${X(.25)} ${Y(.62)} ${X(.55)} ${Y(.74)} Q${X(.8)} ${Y(.66)} ${X(1.05)} ${Y(.72)} L${X(1.05)} ${Y(1.05)} L${X(-.05)} ${Y(1.05)} Z" fill="url(#hillNear)"/>`;
    const roof = (cx, cy, s) => `<path d="M${cx - s} ${cy} Q${cx - s * .6} ${cy - s * .15} ${cx - s * .45} ${cy - s * .5} L${cx + s * .45} ${cy - s * .5} Q${cx + s * .6} ${cy - s * .15} ${cx + s} ${cy} Z" fill="#6B4A33"/><rect x="${cx - s * .6}" y="${cy}" width="${s * 1.2}" height="${s * .5}" fill="#E9D8BC"/>`;
    g += roof(+X(.58), +Y(.86), wd * .08) + roof(+X(.74), +Y(.9), wd * .1) + roof(+X(.92), +Y(.87), wd * .07);
  }
  g += `<rect x="${x}" y="${y}" width="${wd}" height="${h}" fill="#D9A15C" opacity="${small ? .08 : .14}"/><rect x="${x}" y="${y}" width="${wd}" height="${h}" fill="url(#vig)"/><rect x="${x}" y="${y}" width="${wd}" height="${h}" fill="url(#sheen)"/>`;
  return `<clipPath id="ph"><rect x="${x}" y="${y}" width="${wd}" height="${h}" rx="1.2"/></clipPath><g clip-path="url(#ph)">${g}</g><rect x="${x}" y="${y}" width="${wd}" height="${h}" rx="1.2" fill="none" stroke="#4E2F14" stroke-opacity=".18" stroke-width=".8"/>`;
};

// 3D 심볼 본문(64 상자). small: 사진을 키우고 인장을 살짝 줄여 48dp에서도 사진이 보이게
const body3d = (small) => {
  const P = small ? { x: 24, y: 0, w: 37, h: 43 } : { x: 26, y: 1, w: 34, h: 41 };
  const win = small ? { x: 27.5, y: 3.5, w: 30, h: 29 } : { x: 29, y: 4, w: 28, h: 27 };
  const S = small ? { x: 4, y: 21, w: 39, r: 13 } : { x: 4, y: 19, w: 41, r: 14 };
  const pol = `<g transform="rotate(11 ${P.x + P.w / 2} ${P.y + P.h / 2})">
    <rect x="${P.x}" y="${P.y + 2.2}" width="${P.w}" height="${P.h}" rx="2.6" fill="#D2BFA8"/>
    <rect x="${P.x}" y="${P.y}" width="${P.w}" height="${P.h}" rx="2.6" fill="url(#card)"/>
    <rect x="${P.x + .6}" y="${P.y + .6}" width="${P.w - 1.2}" height="${P.h - 1.2}" rx="2.2" fill="none" stroke="#fff" stroke-opacity=".8" stroke-width=".8"/>
    ${scene(win.x, win.y, win.w, win.h, small)}</g>`;
  const seal = `<g transform="rotate(-6 ${S.x + S.w / 2} ${S.y + S.w / 2})">
    <rect x="${S.x + 3}" y="${S.y + 2}" width="${S.w}" height="${S.w}" rx="${S.r}" fill="#3A1A10" opacity=".38" filter="url(#cast)"/>
    <rect x="${S.x}" y="${S.y + 3.2}" width="${S.w}" height="${S.w}" rx="${S.r}" fill="${BRAND.sealDeep}"/>
    <rect x="${S.x}" y="${S.y}" width="${S.w}" height="${S.w}" rx="${S.r}" fill="url(#seal)"/>
    <rect x="${S.x + 1}" y="${S.y + 1}" width="${S.w - 2}" height="${S.w - 2}" rx="${S.r - 1}" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="1.2"/>
    ${glyph(S.x + S.w * .11, S.y + S.w * .11 + 1, S.w * .78, BRAND.sealDeep, small ? 11 : 9.5)}${glyph(S.x + S.w * .11, S.y + S.w * .11, S.w * .78, BRAND.sealGlyph, small ? 11 : 9.5)}
    <ellipse cx="${S.x + 10}" cy="${S.y + 5}" rx="8" ry="2.6" fill="#fff" opacity=".32" transform="rotate(-18 ${S.x + 10} ${S.y + 5})"/></g>`;
  return `<g filter="url(#ds)" transform="translate(4 4.6) scale(0.86)">${pol}${seal}</g>`;
};

// 평면판(앱 안): 그라디언트·필터 없음. 인장 두께는 같은 색 진한 판 한 겹으로만
const bodyFlat = () => `<g transform="translate(4 4.6) scale(0.86)">
  <g transform="rotate(11 42.5 21.5)"><rect x="24" y="0" width="37" height="43" rx="2.6" fill="${T.card}" stroke="${T.inkTitle}" stroke-width="2"/>
    <rect x="27.5" y="3.5" width="30" height="29" rx="1.2" fill="${T.sky}"/><circle cx="46.7" cy="12.8" r="5" fill="${T.sun}"/>
    <path d="M27.5 24.4 Q38 17.4 47.3 21.5 Q53.3 19.4 57.5 20.9 L57.5 32.5 L27.5 32.5 Z" fill="${T.doneSoft}"/></g>
  <g transform="rotate(-6 23.5 40.5)"><rect x="4" y="23.6" width="39" height="39" rx="13" fill="${BRAND.sealDeep}"/><rect x="4" y="21" width="39" height="39" rx="13" fill="${BRAND.seal}"/>
    ${glyph(8.3, 25.3, 30.4, BRAND.sealGlyph, 11)}</g></g>`;

// 단색(테마 아이콘): 인장 실루엣에서 家를 뚫고, 사진은 테두리만
const bodyMono = (c = '#000') => `<defs><mask id="mk"><rect x="-10" y="-10" width="90" height="90" fill="#fff"/>${glyph(8.3, 25.3, 30.4, '#000', 12)}</mask></defs>
  <g transform="translate(4 4.6) scale(0.86)"><g transform="rotate(11 42.5 21.5)" fill="none" stroke="${c}" stroke-width="3.4" stroke-linejoin="round"><rect x="25.7" y="1.7" width="33.6" height="39.6" rx="2.6"/><circle cx="46.7" cy="12.8" r="4.4" fill="${c}" stroke="none"/></g>
  <g transform="rotate(-6 23.5 40.5)"><rect x="1.5" y="18.5" width="44" height="44" rx="15" fill="#fff" opacity="0"/><rect x="4" y="21" width="39" height="39" rx="13" fill="${c}" mask="url(#mk)"/></g></g>`;

const svg = (vb, size, inner, title, defs = '') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${size}" height="${size}" role="img"><title>${title}</title>${defs ? `<defs>${defs}</defs>` : ''}${inner}</svg>\n`;
const SYM = {
  '3d': [DEFS3D(false), body3d(false)], small: [DEFS3D(true), body3d(true)], flat: ['', bodyFlat()], mono: ['', bodyMono()],
};
w(`${B}/symbol-3d.svg`, svg('0 0 64 64', 64, SYM['3d'][1], '가화만사성 심볼 3D 상세판(96px 이상)', SYM['3d'][0]));
w(`${B}/symbol-3d-small.svg`, svg('0 0 64 64', 64, SYM.small[1], '가화만사성 심볼 3D 단순판(런처 48dp·72px 이하)', SYM.small[0]));
w(`${B}/symbol-flat.svg`, svg('0 0 64 64', 64, SYM.flat[1], '가화만사성 심볼 평면판(앱 안)'));
w(`${B}/symbol-mono.svg`, svg('0 0 64 64', 64, SYM.mono[1], '가화만사성 심볼 단색'));

// ── Android 적응형 아이콘(108dp 캔버스). 심볼 64상자를 60dp로 놓으면 내용이 안전 원(지름 66) 안에 든다 ──
const place = (k, x, y, s) => `<g transform="translate(${x} ${y}) scale(${s / 64})">${SYM[k][1]}</g>`;
const SYM_DP = 56, OFF = (108 - SYM_DP) / 2;
// 배지 T(스테이징): 남색 원 + 흰 T(사각 두 개). 안전 원 안 오른쪽 위
const badgeT = (cx, cy, r) => `<circle cx="${cx}" cy="${cy}" r="${r + 1.4}" fill="#fff"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="${BRAND.stagingNavy}"/>
  <rect x="${cx - r * .5}" y="${cy - r * .52}" width="${r}" height="${r * .26}" rx="${r * .06}" fill="#fff"/><rect x="${cx - r * .13}" y="${cy - r * .52}" width="${r * .26}" height="${r * 1.06}" rx="${r * .06}" fill="#fff"/>`;
const navyBand = `<rect x="0" y="76" width="108" height="32" fill="${BRAND.stagingNavy}"/>`;
const AD = {
  fg: [SYM.small[0], place('small', OFF, OFF - 1, SYM_DP)],
  bg: ['', `<rect width="108" height="108" fill="${BRAND.iconBg}"/>`],
  mono: ['', `<g>${bodyMono().replace('<defs>', '<defs>').replace(/<g transform="translate\(4 4.6\) scale\(0.86\)">/, `<g transform="translate(${OFF} ${OFF - 1}) scale(${SYM_DP / 64}) translate(4 4.6) scale(0.86)">`)}</g>`],
  'fg-staging': [SYM.small[0], place('small', OFF, OFF - 4, SYM_DP) + badgeT(69, 37, 8)],
  'bg-staging': ['', `<rect width="108" height="108" fill="${BRAND.iconBg}"/>${navyBand}`],
};
const A = `${B}/android`;
const names = { fg: 'ic_launcher_foreground', bg: 'ic_launcher_background', mono: 'ic_launcher_monochrome' };
for (const [k, [d, inner]] of Object.entries(AD)) {
  const dir = k.endsWith('staging') ? `${A}/staging/src` : `${A}/src`;
  w(`${dir}/${names[k.replace('-staging', '')]}.svg`, svg('0 0 108 108', 108, inner, `적응형 아이콘 ${k} (108dp 캔버스, 안전 원 66dp)`, d));
}
// 레거시(7.x 이하)·Play: 바탕 + 심볼 합성. square=둥근사각, round=원, play=꽉 찬 정사각(Play가 모서리를 깎음)
const legacy = (shape, staging) => {
  const s = staging ? 'fg-staging' : 'fg', bgk = staging ? 'bg-staging' : 'bg';
  const clip = shape === 'round' ? `<clipPath id="lc"><circle cx="54" cy="54" r="54"/></clipPath>` : shape === 'square' ? `<clipPath id="lc"><rect width="108" height="108" rx="20"/></clipPath>` : `<clipPath id="lc"><rect width="108" height="108"/></clipPath>`;
  // 레거시 아이콘은 마스크가 없어 72dp 보이는 영역 기준으로 확대: 108→ 보이는 72를 꽉 채우게 1.5배 중심 확대
  return svg('18 18 72 72', 72, `<g clip-path="url(#lc2)">${AD[bgk][1]}${AD[s][1]}</g>`, `레거시 런처 ${shape}${staging ? ' 스테이징' : ''}`, AD[s][0] + clip.replace('id="lc"', 'id="lc2"').replace(/cx="54" cy="54" r="54"/, 'cx="54" cy="54" r="36"').replace('<rect width="108" height="108" rx="20"/>', '<rect x="18" y="18" width="72" height="72" rx="15"/>').replace('<rect width="108" height="108"/>', '<rect x="18" y="18" width="72" height="72"/>'));
};
w(`${A}/src/ic_launcher.svg`, legacy('square', false));
w(`${A}/src/ic_launcher_round.svg`, legacy('round', false));
w(`${A}/src/play_store_512.svg`, legacy('play', false));
w(`${A}/staging/src/ic_launcher.svg`, legacy('square', true));
w(`${A}/staging/src/ic_launcher_round.svg`, legacy('round', true));

// 스플래시(Android 12, 배경 없는 아이콘): 288dp 캔버스, 내용은 지름 192dp 원 안 → 심볼 64상자를 176dp로
w(`${A}/src/splash_icon.svg`, svg('0 0 288 288', 288, place("3d", 62, 60, 164), '스플래시 아이콘(288dp 캔버스, 안전 원 192dp)', SYM['3d'][0]));
w(`${A}/staging/src/splash_icon.svg`, svg('0 0 288 288', 288, place("3d", 62, 60, 164) + badgeT(196, 92, 20), '스플래시 아이콘 스테이징', SYM['3d'][0]));

// XML 견본(앱에 넣을 때 그대로 복사). PNG 레이어 사용(그림자 블러는 VectorDrawable로 옮길 수 없음)
const adaptive = `<?xml version="1.0" encoding="utf-8"?>
<!-- 가화만사성 적응형 아이콘: 종이색 바탕 + 살구 인장 '家' + 뒤 사진(3D 단순판 PNG). 출처 design-system/assets/brand -->
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_background" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
    <monochrome android:drawable="@mipmap/ic_launcher_monochrome" />
</adaptive-icon>
`;
for (const v of ['', 'staging/']) for (const n of ['ic_launcher', 'ic_launcher_round']) w(`${A}/${v}res/mipmap-anydpi-v26/${n}.xml`, adaptive);
console.log('ok');
