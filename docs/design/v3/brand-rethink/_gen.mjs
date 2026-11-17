// 브랜드 재검토 3안 SVG 스케치 생성기 (손으로 그린 SVG, 래스터·AI 생성 없음)
import { writeFileSync, mkdirSync } from 'node:fs';
const OUT = '/Users/hyunseok/Desktop/bumo-jasik/docs/design/v3/brand-rethink';
mkdirSync(OUT, { recursive: true });

const INK = '#4E2F14', SUN = '#FFC93C', RAY = '#F59E0B', PHOTO = '#F1E4D4', PAPER = '#F6F2EC', SEAL = '#B23A2B';
const rays = (cx, cy, r1, r2, w) => {
  let d = '';
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    d += `M${(cx + r1 * Math.cos(a)).toFixed(2)} ${(cy + r1 * Math.sin(a)).toFixed(2)}L${(cx + r2 * Math.cos(a)).toFixed(2)} ${(cy + r2 * Math.sin(a)).toFixed(2)}`;
  }
  return `<path d="${d}" fill="none" stroke="${RAY}" stroke-width="${w}" stroke-linecap="round"/>`;
};

// 각 안의 심볼 내부(viewBox 0 0 64 64)
const SYM = {
  // A: 현재 해+폴라로이드 유지, 사진 아래에 처마 지붕선 하나를 더해 "집 위로 뜨는 해"로 이름과 잇는다
  A: `<g transform="rotate(-5 32 32)">
    <rect x="11" y="5" width="42" height="54" rx="3" fill="#fff" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>
    <rect x="15" y="9" width="34" height="31" rx="1" fill="${PHOTO}"/>
    ${rays(32, 21, 10.5, 13.5, 3.2)}
    <circle cx="32" cy="21" r="7" fill="${SUN}" stroke="${INK}" stroke-width="2.8"/>
    <path d="M15 40 L15 35.5 Q23 34.5 32 29.5 Q41 34.5 49 35.5 L49 40 Z" fill="${INK}"/>
  </g>`,
  // B: 처마 지붕 아래 걸린 사진 한 장 = "우리 집 앨범". 사진 속에 작은 해(해님의 흔적)
  B: `<path d="M3 27 Q13 26.5 20 19 L32 8 L44 19 Q51 26.5 61 27 Q52 30 44 27 L20 27 Q12 30 3 27 Z" fill="${INK}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
    <rect x="14" y="27" width="36" height="31" rx="2.5" fill="#fff" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>
    <rect x="18.5" y="31.5" width="27" height="18" rx="1" fill="${PHOTO}"/>
    <circle cx="32" cy="40.5" r="5.5" fill="${SUN}" stroke="${INK}" stroke-width="2.4"/>`,
  // C: 거실 벽 서예 액자의 낙관(인장). 붉은 도장 안에 家 한 글자
  C: `<g transform="rotate(-4 32 32)">
    <rect x="7" y="7" width="50" height="50" rx="7" fill="${SEAL}"/>
    <rect x="11.5" y="11.5" width="41" height="41" rx="4" fill="none" stroke="#FBEFE6" stroke-width="2"/>
    <text x="32" y="45" text-anchor="middle" font-family="AppleMyungjo, 'Noto Serif KR', Batang, serif" font-weight="700" font-size="34" fill="#FBEFE6">家</text>
  </g>`,
};
const META = {
  A: { name: 'A안 · 해 뜨는 우리 집 (유지·보완)', sub: '하루 한 장, 우리 집 앨범', font: "'Jua','Apple SD Gothic Neo',sans-serif", bg: '#FFF4DC' },
  B: { name: 'B안 · 처마 아래 앨범 (추천)', sub: '하루 한 장, 우리 집 앨범', font: "'Jua','Apple SD Gothic Neo',sans-serif", bg: '#FFF4DC' },
  C: { name: 'C안 · 거실 액자 낙관', sub: '하루 한 장, 우리 집 앨범', font: "AppleMyungjo,'Noto Serif KR',serif", bg: '#FBF6EE' },
};

const svg = (w, h, body, title) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img"><title>${title}</title>${body}</svg>\n`;
const place = (k, x, y, size) => `<g transform="translate(${x} ${y}) scale(${size / 64})">${SYM[k]}</g>`;

for (const k of Object.keys(SYM)) {
  const m = META[k];
  // 1) 심볼
  writeFileSync(`${OUT}/${k}-symbol.svg`, svg(64, 64, SYM[k], `가화만사성 ${m.name} 심볼`));

  // 2) 런처 아이콘 미리보기: 적응형 아이콘(108 캔버스, 안전 영역 66) 원형·둥근사각 마스크, 48dp 실제 크기 + 2배
  const icon = (x, y, s, shape) => {
    const r = shape === 'circle' ? s / 2 : s * 0.24;
    const id = `${k}${shape}${s}${x}`;
    return `<clipPath id="${id}"><rect x="${x}" y="${y}" width="${s}" height="${s}" rx="${r}"/></clipPath>
      <g clip-path="url(#${id})"><rect x="${x}" y="${y}" width="${s}" height="${s}" fill="${m.bg}"/>${place(k, x + s * 0.17, y + s * 0.17, s * 0.66)}</g>`;
  };
  const label = (x, y, t, fs) => `<text x="${x}" y="${y}" text-anchor="middle" font-family="'Apple SD Gothic Neo',sans-serif" font-size="${fs}" fill="#fff">${t}</text>`;
  let lb = `<rect width="360" height="160" rx="16" fill="#2F3B4A"/>`;
  lb += `<text x="16" y="24" font-family="'Apple SD Gothic Neo',sans-serif" font-size="12" fill="#C9D3DE">홈 화면 48dp(실제 크기)</text>`;
  const smalls = [['circle', 30], ['square', 100]];
  for (const [sh, x] of smalls) { lb += icon(x, 40, 48, sh); lb += label(x + 24, 104, '가화만사성', 11); }
  // 이웃 앱 더미(구분감 확인용)
  lb += `<rect x="170" y="40" width="48" height="48" rx="11.5" fill="#FEE500"/><rect x="240" y="40" width="48" height="48" rx="24" fill="#0064FF"/>`;
  lb += label(194, 104, '카카오톡', 11) + label(264, 104, '토스', 11);
  lb += `<text x="16" y="140" font-family="'Apple SD Gothic Neo',sans-serif" font-size="11" fill="#9FB0C2">흰 글자 라벨 = 런처 실제 표시 이름</text>`;
  // 2배(96px)는 아래 패널에 따로 그린다
  const big = `<rect y="168" width="360" height="130" rx="16" fill="#2F3B4A"/>${icon(30, 185, 96, 'circle')}${icon(150, 185, 96, 'square')}
    <text x="262" y="225" font-family="'Apple SD Gothic Neo',sans-serif" font-size="12" fill="#C9D3DE">96px</text><text x="262" y="243" font-family="'Apple SD Gothic Neo',sans-serif" font-size="12" fill="#C9D3DE">원형·둥근사각</text>`;
  writeFileSync(`${OUT}/${k}-launcher.svg`, svg(360, 298, lb + big, `${m.name} 런처 아이콘 미리보기`));

  // 3) 워드마크 조합(첫 화면 머리 기준: 심볼 + 이름 + 한 줄 설명)
  const wm = `<rect width="420" height="120" rx="16" fill="${PAPER}"/>${place(k, 20, 20, 80)}
    <text x="116" y="66" font-family="${m.font}" font-weight="700" font-size="40" fill="${INK}">가화만사성</text>
    <text x="118" y="96" font-family="'Apple SD Gothic Neo',sans-serif" font-size="17" fill="#7A5A3E">${m.sub}</text>`;
  writeFileSync(`${OUT}/${k}-wordmark.svg`, svg(420, 120, wm, `${m.name} 워드마크`));
}

// 4) 한 장 비교(HTML → PNG). 현재 심볼(design-system 원본)도 기준으로 함께 놓는다
const cols = ['A', 'B', 'C'].map(k => `<section><h2>${META[k].name}</h2>
  <img src="${k}-symbol.svg" width="128" height="128"><img src="${k}-launcher.svg" width="360"><img src="${k}-wordmark.svg" width="360"></section>`).join('');
writeFileSync(`${OUT}/compare.html`, `<!doctype html><meta charset="utf-8"><title>브랜드 재검토 비교</title>
<link href="https://fonts.googleapis.com/css2?family=Jua&display=swap" rel="stylesheet">
<style>body{margin:0;padding:24px;background:${PAPER};font-family:'Apple SD Gothic Neo',sans-serif;color:${INK}}
h1{font-size:22px;margin:0 0 4px}p{margin:0 0 16px;color:#7A5A3E}main{display:flex;gap:20px}
section{background:#fff;border-radius:16px;padding:16px;display:flex;flex-direction:column;gap:12px;align-items:center;width:380px}
h2{font-size:17px;margin:0}.ref{display:flex;align-items:center;gap:12px;margin-bottom:16px}</style>
<h1>가화만사성 브랜드 재검토 · 3안 손그림 SVG 스케치</h1>
<div class="ref"><img src="../../../../design-system/assets/symbol-sun-polaroid.svg" width="48"><p style="margin:0">현재 적용본(해+폴라로이드). 아래는 비교안이며 앱에는 반영하지 않음</p></div>
<main>${cols}</main>`);
console.log('ok');
