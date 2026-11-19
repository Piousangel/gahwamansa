#!/usr/bin/env python3
"""디렉터 A 안별 팔레트 대비 계산. 공식은 design-system/scripts/contrast-v4.py 와 같다(WCAG 2.x 상대휘도).
사용: python3 docs/team/board/2026-11-19-expert-review/creative/A/tools/contrast.py [--md]
PAIRS 는 화면에서 실제로 쓰는 글자/면 짝만 적는다. who: elder(7:1) · child(4.5:1) · nontext(3:1)."""
import sys


def L(h):
    h = h.lstrip('#'); c = [int(h[i:i+2], 16)/255 for i in (0, 2, 4)]
    c = [x/12.92 if x <= .03928 else ((x+.055)/1.055)**2.4 for x in c]
    return .2126*c[0] + .7152*c[1] + .0722*c[2]


def cr(a, b):
    x, y = L(a), L(b); x, y = max(x, y), min(x, y); return round((x+.05)/(y+.05), 2)


PAL = {
    'A1': {'회벽': '#DEDDD6', '일력지': '#FAFAF6', '먹': '#1F1E1C', '연필': '#45433E', '청': '#1F3C88', '주일빨강': '#A31F1A', '흰': '#FFFFFF', '뜯는선': '#8E8C84'},
    'A2': {'항공지': '#E6EDF3', '편지지': '#FFFFFF', '블루블랙': '#1B2840', '소인먹': '#3A465A', '남청': '#22427A', '우표빨강': '#9E2A2B', '괘선': '#B9C8DA', '흰': '#FFFFFF'},
    'A3': {'모시': '#E7E7E0', '먹': '#22201C', '숯': '#4D4A43', '쪽': '#253E69', '치자': '#E2B23A', '쑥': '#3E5530', '흰': '#FFFFFF', '바늘땀': '#77736A'},
}
TH = {'elder': 7, 'child': 4.5, 'nontext': 3, 'decor': 0}
PAIRS = {
    'A1': [('먹', '일력지', 'elder'), ('먹', '회벽', 'elder'), ('연필', '일력지', 'elder'), ('연필', '회벽', 'elder'),
           ('청', '일력지', 'elder'), ('흰', '청', 'elder'), ('주일빨강', '일력지', 'elder'), ('먹', '흰', 'child'),
           ('연필', '흰', 'child'), ('청', '흰', 'child'), ('뜯는선', '일력지', 'nontext'), ('청', '회벽', 'nontext')],
    'A2': [('블루블랙', '편지지', 'elder'), ('블루블랙', '항공지', 'elder'), ('소인먹', '편지지', 'elder'), ('소인먹', '항공지', 'elder'),
           ('남청', '편지지', 'elder'), ('남청', '항공지', 'elder'), ('흰', '남청', 'elder'), ('우표빨강', '편지지', 'elder'),
           ('소인먹', '편지지', 'child'), ('괘선', '편지지', 'decor'), ('우표빨강', '항공지', 'nontext')],
    'A3': [('먹', '모시', 'elder'), ('숯', '모시', 'elder'), ('먹', '흰', 'elder'), ('흰', '쪽', 'elder'), ('먹', '치자', 'elder'),
           ('흰', '쑥', 'elder'), ('쪽', '모시', 'elder'), ('쪽', '흰', 'elder'), ('숯', '흰', 'child'),
           ('바늘땀', '모시', 'nontext'), ('치자', '모시', 'decor'), ('쪽', '모시', 'nontext')],
}

bad = 0
md = '--md' in sys.argv
for k, pairs in PAIRS.items():
    p = PAL[k]
    if md:
        print(f'\n{k}\n| 글자(또는 선) | 면 | 대비 | 기준 | 판정 |\n|---|---|---|---|---|')
    else:
        print(k)
    for fg, bg, who in pairs:
        x = cr(p[fg], p[bg]); ok = x >= TH[who]; bad += (not ok)
        if md:
            print(f'| {fg} `{p[fg]}` | {bg} `{p[bg]}` | {x} | {who} {TH[who]} | {"통과" if ok else "미달"} |')
        else:
            print(f'  {fg:6} on {bg:6} {x:6}  {who} {"OK" if ok else "FAIL"}')
print('\nFAIL', bad) if bad else print('\nALL OK')
sys.exit(1 if bad else 0)
