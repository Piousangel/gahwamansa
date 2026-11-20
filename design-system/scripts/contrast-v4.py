#!/usr/bin/env python3
"""tokens-v4.json 의 색 값으로 역할×면 대비를 전수 계산해 contrast·allowed 를 다시 쓴다.
사용: python3 design-system/scripts/contrast-v4.py [tokens.json]          (다시 쓰기, 기본 tokens-v4.json, v5는 design-system/tokens-v5.json)
      python3 design-system/scripts/contrast-v4.py --check  (파일과 계산이 다르면 exit 1)
기준: 어르신 글자 7:1, 자녀 글자 4.5:1, 비텍스트(테두리·아이콘) 3:1. 토큰 테스트는 allowed 표만 본다."""
import json, sys, os
ARGS = [a for a in sys.argv[1:] if not a.startswith('--')]
P = os.path.abspath(ARGS[0]) if ARGS else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'tokens-v4.json')
d = json.load(open(P))
col = {k: v['value'] for k, v in d['color'].items() if isinstance(v, dict) and 'value' in v}

def L(h):
    h = h.lstrip('#'); c = [int(h[i:i+2], 16)/255 for i in (0, 2, 4)]
    c = [x/12.92 if x <= .03928 else ((x+.055)/1.055)**2.4 for x in c]
    return .2126*c[0] + .7152*c[1] + .0722*c[2]

def cr(a, b):
    x, y = L(a), L(b); x, y = max(x, y), min(x, y); return round((x+.05)/(y+.05), 2)

TEXT_ROLES = ['inkTitle', 'inkBody', 'inkSub', 'inkSubChild', 'action', 'accent', 'info', 'doneInk', 'dangerInk', 'onAction', 'disabledInk']
SURFACES = ['paper', 'card', 'paperSoft', 'noticeSoft', 'actionSoft', 'infoSoft', 'sky', 'doneSoft', 'dangerSoft', 'action', 'disabledBg']
NONTEXT_ROLES = ['line', 'action', 'dangerInk', 'doneInk', 'info', 'accent']
NONTEXT_SURFACES = ['paper', 'card', 'paperSoft', 'noticeSoft', 'actionSoft', 'infoSoft']
# 의미상 제외: 흰 글자는 action 면 위에서만, 비활성 글자는 비활성 면 위에서만, 면 action·disabledBg 위에는 다른 글자를 쓰지 않음
SEMANTIC = {'onAction': ['action'], 'disabledInk': ['disabledBg']}
# v5: 팻말 노랑(sign)은 signInk(먹) 글자만 허용하는 전용 면. 다른 글자색을 sign 위에 쓰지 않는다
if 'sign' in col:
    SURFACES = SURFACES + ['sign']
    TEXT_ROLES = TEXT_ROLES + ['signInk']
    SEMANTIC['signInk'] = ['sign']
    NONTEXT_ROLES = NONTEXT_ROLES + ['signEdge']
    # v5 토스트(#199 디자인 리뷰 M): 안내 토스트 = 먹(inkTitle) 면 위 흰 글자, 오류 토스트 = dangerSoft 면 위 danger 테두리
    SURFACES = SURFACES + ['inkTitle', 'dangerInk']
    SEMANTIC['onAction'] = ['action', 'inkTitle', 'dangerInk']  # dangerInk 면 = Tag danger(대화상자 위험 띠, #217)
    NONTEXT_ROLES = NONTEXT_ROLES + ['danger']
    NONTEXT_SURFACES = NONTEXT_SURFACES + ['dangerSoft']

matrix = []; elder = {}; child = {}
for r in TEXT_ROLES:
    for s in SURFACES:
        if r in SEMANTIC and s not in SEMANTIC[r]:
            continue
        if r not in SEMANTIC and s in ('action', 'disabledBg', 'sign', 'inkTitle', 'dangerInk'):
            continue
        x = cr(col[r], col[s]); matrix.append({'role': r, 'surface': s, 'ratio': x})
        if r == 'disabledInk':
            continue
        if x >= 7: elder.setdefault(r, []).append(s)
        if x >= 4.5: child.setdefault(r, []).append(s)
nt = {}; ntm = []
for r in NONTEXT_ROLES:
    for s in NONTEXT_SURFACES:
        x = cr(col[r], col[s]); ntm.append({'role': r, 'surface': s, 'ratio': x})
        if x >= 3: nt.setdefault(r, []).append(s)

out = {
    'method': 'WCAG 2.x 상대휘도 (L1+0.05)/(L2+0.05), design-system/scripts/contrast-v4.py 로 계산',
    'thresholds': {'elderText': 7, 'childText': 4.5, 'nonText': 3},
    'textMatrix': matrix, 'nonTextMatrix': ntm,
    'note': '표는 전수 계산값. 화면·컴포넌트가 쓸 수 있는 조합은 allowed 만. disabledInk 는 WCAG 비활성 면제로 4.5 이상만 유지(ratio 5.29).'}
allowed = {
    'elderText': elder, 'childText': child, 'nonText': nt,
    'rules': 'allowed 에 없는 role×surface 조합은 토큰 테스트가 실패시킨다(금지 목록이 아니라 허용 목록). intent 는 allowed 위에 얹는 의미 규칙.',
    'intent': {'accent': '화면당 1곳, dangerInk와 같은 화면 금지(대비 1.02)',
               'info': '글자는 infoSoft 띠 위에서 쓰는 것이 기본(7.35). 단독 글자색 금지(면 + 아이콘과 함께)',
               'onAction': 'action 면 위 흰 글자 전용' + (', v5 는 먹(inkTitle) 면의 토스트·Tag 글자와 위험(dangerInk) 면의 Tag danger 글자도' if 'sign' in col else '')}}

if '--check' in sys.argv:
    ok = d.get('contrast') == out and d.get('allowed') == allowed
    print('OK' if ok else 'MISMATCH: 값이 바뀌었으면 인자 없이 다시 실행')
    sys.exit(0 if ok else 1)

d['contrast'] = out; d['allowed'] = allowed
with open(P, 'w') as f:
    json.dump(d, f, ensure_ascii=False, indent=2); f.write('\n')
print('elder text allowed:', {k: len(v) for k, v in elder.items()})
print('child text allowed:', {k: len(v) for k, v in child.items()})
print('nonText allowed:', {k: len(v) for k, v in nt.items()})
