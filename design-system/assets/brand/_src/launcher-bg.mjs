// 런처 아이콘 배경색 후보 비교 → launcher-bg-compare.html (render: 헤드리스 크롬, 2배 해상도)
// 아이콘 = 적응형 아이콘 흉내: 108dp 캔버스 중 보이는 72dp를 48px로. 전경은 symbol-3d-small(현재 56dp) / -compact(꽉 채움 64dp)
import { writeFileSync } from 'node:fs';
const B = '/Users/hyunseok/Desktop/bumo-jasik/design-system/assets/brand';
const BGS = [
  ['1 크림(현재)', '#FBF6EE'],
  ['2 진한 종이색', 'linear-gradient(#F1E4CF,#E4D0B2)'],
  ['3 짙은 갈색(브랜드 잉크)', 'linear-gradient(#6A4424,#4E2F14)'],
  ['4 연한 살구 그라디언트', 'linear-gradient(#FFEFE4,#FFCFB5)'],
  ['5 하늘→크림 그라디언트', 'linear-gradient(#BFDDF2,#FBF3E4)'],
];
const MASKS = [['원', '50%'], ['스쿼클(삼성 기본)', '32%'], ['둥근 사각', '18%']];
const FG = [['현재 전경 56dp', '../symbol-3d-small.svg', 56, -1], ['꽉 채움 64dp', '../symbol-3d-small-compact.svg', 64, -0.5]];
const S = 48, k = S / 72; // 1dp → px (보이는 72dp = 48px)
const icon = (bg, r, [, src, dp, dy]) => {
  const px = dp * k, off = (S - px) / 2;
  return `<div class="ic" style="background:${bg};border-radius:${r}"><img src="${src}" style="width:${px}px;height:${px}px;left:${off}px;top:${off + dy * k}px"></div>`;
};
const other = (name, bg, fg, r = '32%') => `<div class="app"><div class="ic" style="background:${bg};border-radius:${r};display:flex;align-items:center;justify-content:center;color:${fg};font-weight:800;font-size:15px">${name[0]}</div><span>${name}</span></div>`;
const strip = (bg, home) => `<div class="home ${home}">${other('카카오톡', '#FEE500', '#3C1E1E')}
  ${FG.map(f => `<div class="grp">${MASKS.map(([, r]) => `<div class="app">${icon(bg, r, f)}<span>가화만사성</span></div>`).join('')}</div>`).join('')}
  ${other('토스', '#0064FF', '#fff')}${other('갤러리', '#F5F5F5', '#E53935')}</div>`;
const rows = BGS.map(([name, bg]) => `<div class="row"><div class="rh">${name}</div>${strip(bg, 'dark')}${strip(bg, 'light')}</div>`).join('');
writeFileSync(`${B}/_src/launcher-bg-compare.html`, `<!doctype html><meta charset="utf-8"><title>런처 배경 비교</title>
<style>body{margin:0;padding:20px;width:1500px;background:#F6F3EE;font-family:'Apple SD Gothic Neo',sans-serif;color:#4E2F14}
h1{font-size:20px;margin:0 0 4px}p{margin:0 0 12px;font-size:12px;color:#7A5A3E}
.row{display:flex;gap:10px;align-items:center;margin-bottom:10px}.rh{width:110px;font-size:13px;font-weight:700}
.home{display:flex;gap:12px;padding:12px 14px;border-radius:14px;align-items:flex-start}.dark{background:#1F2730;color:#E6ECF2}.light{background:#E9E3DA;color:#3A2A1C}
.grp{display:flex;gap:10px;padding:0 8px;border-left:1px dashed #8889;}.app{display:flex;flex-direction:column;align-items:center;gap:4px;font-size:9.5px;width:54px}
.ic{position:relative;width:${S}px;height:${S}px;overflow:hidden;box-shadow:0 1px 2px #0003}.ic img{position:absolute}
.hd{display:flex;gap:10px;margin-left:120px;font-size:11px;color:#7A5A3E}.hd span{width:676px}</style>
<h1>런처 아이콘 배경색 후보 · 48dp 실제 크기</h1>
<p>각 줄: 어두운 홈 | 밝은 홈. 점선 왼쪽 묶음 = 현재 전경(56dp), 오른쪽 묶음 = 꽉 채움 전경(64dp, 사진·인장 겹침 키움, 안전 원 66dp 안). 마스크 모양(원·스쿼클·둥근 사각)은 런처·제조사가 정함. 이웃 아이콘은 색만 흉내 낸 자리 표시.</p>
<div class="hd"><span>어두운 배경화면</span><span>밝은 배경화면</span></div>${rows}`);
console.log('ok');
