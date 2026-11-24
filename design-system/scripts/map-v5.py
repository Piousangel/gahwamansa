#!/usr/bin/env python3
"""tokens-v4.json 의 역할×면 체계는 그대로 두고, 색 값·반경·선·그림자를 B2 v2(장날 팻말) 값으로 바꿔 tokens-v5.json 을 만든다.
오너 결정 11-20: O-1 팻말에는 고른 쪽, O-2 B2 v2 채택, O-6 도장 7칸 삭제, O-8 장식 폐기.
사용: python3 design-system/scripts/map-v5.py && python3 design-system/scripts/contrast-v4.py design-system/tokens-v5.json
값이 바뀌면 이 파일의 MAP 만 고치고 다시 돌린다."""
import json, os
HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '..', 'tokens-v4.json')
DST = os.path.join(HERE, '..', 'tokens-v5.json')
d = json.load(open(SRC, encoding='utf-8'))
c = d['color']
# 팔레트: 회백·먹·시멘트·차일 파랑·팻말 노랑·흰 (B2 v2) + 파생 옅은 면(톤 고정, 중성에 가까운 색상만 이동)
MAP = {
    'paper': '#F4F5F2', 'card': '#FFFFFF', 'paperSoft': '#E9EBE6', 'paperEdge': '#DADDD6', 'noticeSoft': '#ECEEE9',
    'inkTitle': '#151515', 'inkBody': '#151515', 'inkSub': '#484B50', 'inkSubChild': '#5A5E64',
    'action': '#1A4C99', 'actionPressed': '#123A78', 'actionSoft': '#E4EAF4', 'onAction': '#FFFFFF',
    'accent': '#151515',                      # '지금 할 차례' Tag(accent): 먹 면 + 흰 글자(색이 아니라 모양·글자로 구분)
    'info': '#484B50', 'infoSoft': '#E6E8E3',  # info 남색 폐지 → 시멘트 회 + ⓘ 아이콘 + 옅은 회 면(누름 파랑과 겹치지 않음)
    'line': '#7A7E84', 'lineSoft': '#D2D5CF', 'lineGhost': '#E0E2DC',
    'sky': '#E4EAF4', 'disabledBg': '#E4E6E1', 'disabledInk': '#5F6368',
}
for k, v in MAP.items():
    if k in c:
        c[k]['value'] = v
        c[k].pop('v2From', None)
# 폐기(장식 폐기 O-8): 해님·인장·테이프·폴라로이드 마운트. 값은 지우고 v4 이름은 v3Aliases 로만 남긴다
DEPRECATED = ['sun', 'sunRay', 'blush', 'accentSun', 'accentPeach', 'brandSealDeep', 'brandSeal', 'brandSealGlyph', 'tape']
for k in DEPRECATED:
    c.pop(k, None)
# 팻말(sign): 노랑은 이 역할 하나뿐
c['sign'] = {'value': '#FFD43B', 'role': "팻말 면 — **부모님이 고르신 쪽**(P5 선택) 전용. 다른 면·글자·버튼에 쓰지 않는다. 바탕(회백)과 1.3이라 경계는 signEdge가 맡는다"}
c['signInk'] = {'value': '#151515', 'role': '팻말 위 글자(먹). 손글씨(≥48dp)·고딕 700(<48dp) 모두'}
c['signEdge'] = {'value': '#151515', 'role': '팻말 테두리 2·끈·못. 테두리 없는 노랑 금지'}
# 날짜 도장(D-2, 11-24 팀 결정): 새 색 없이 먹(inkTitle)의 별칭. 역할 이름만 나눠 두어 잉크를 바꿀 때 화면 코드를 건드리지 않는다
c['stampInk'] = {'value': c['inkTitle']['value'], 'aliasOf': 'inkTitle',
                 'role': "P3 '했어요' 옆 날짜 도장(두 겹 원 + '24일') 선·글자. 값은 먹(inkTitle) 그대로 — 팔레트를 늘리지 않는다(docs/design/2026-11-24-d2-d3-c4)"}
c['info']['rule'] = '정보 띠: 시멘트 회 글자 + ⓘ 아이콘 + infoSoft 면. 파랑(action)은 누르는 것 전용이라 info에 쓰지 않는다(패널 5 겹침 해결)'
c['accent']['rule'] = "'지금 할 차례' Tag 한 곳. 먹 면 + 흰 글자 + 글자('지금 할 차례')로 구분. 위험색과 같은 화면에서도 색이 겹치지 않는다"
c['action']['note'] = '누를 수 있는 것 전용(차일 파랑). v4 갈색 #744821에서 교체'
# 글꼴: Jua 폐기, 본문·제목 한 벌(Noto Sans KR 1순위), 팻말 손글씨는 나눔손글씨 붓(≥48dp)
d['fontCandidate'] = {'status': 'v5(11-20): Jua 폐기. 본문·제목 한 벌 번들 = Noto Sans KR(2순위 Pretendard, 숫자 tabular). 팻말 손글씨만 나눔손글씨 붓',
                      'body': 'Noto Sans KR', 'hand': 'Nanum Brush Script (팻말 48dp 이상에서만, 작으면 Noto Sans KR 700)', 'numeralFeature': 'tabular-nums',
                      'compare': 'docs/design/font-compare/FONT-COMPARE.png'}
for r in ('answer', 'answerRow'):
    d['typeRoles'][r].pop('fontFace', None)
    d['typeRoles'][r]['weight'] = 700   # Jua 폐기: 답은 Noto Sans KR 700(R-21 굵기 집계 갱신)
d['typeRoles']['answer']['note'] = "자녀 화면에서 '어르신이 고른 답' 대표 한 개. 화면당 1개. Noto Sans KR 700. 확대 상한 1.3(200%에서 40→52). 팻말이 있는 화면에서는 팻말 글자가 이 역할을 대신한다(Sign)"
d['typeRoles']['signLabel'] = {'child': {'size': 52, 'lineHeight': 64}, 'elder': {'size': 60, 'lineHeight': 72}, 'weight': 400, 'tone': 'signInk', 'maxFontScale': 1.3,
    'note': '팻말 글자(손글씨 나눔손글씨 붓). 어르신 60×1.18 보정, 자녀 52. **48dp 이상에서만 손글씨**, 그보다 작으면 signSmall(Noto Sans KR 700)'}
d['typeRoles']['signSmall'] = {'child': {'size': 20, 'lineHeight': 28}, 'elder': {'size': 26, 'lineHeight': 36}, 'weight': 700, 'tone': 'signInk', 'maxFontScale': 1.5,
    'note': '지난 날 작은 팻말·48dp 미만 팻말 글자(고딕 700)'}
# 날짜 도장 글자(D-2, 11-24): '24일' 20/700, 확대 상한 1.3(도장 지름 64 도 같은 배율로 커져 200%에서 83 — 11-25 리드: 글자 20 유지, 여백 4dp 위해 56→64). 도장 컴포넌트(ui/ds/DateStamp) 안에서만
d['typeRoles']['stampLabel'] = {'child': {'size': 20, 'lineHeight': 24}, 'elder': {'size': 20, 'lineHeight': 24}, 'weight': 700, 'tone': 'stampInk', 'maxFontScale': 1.3,
    'note': "P3 '했어요' 옆 날짜 도장 안 글자. 줄 높이 24는 원 안 한 줄(지름 64 − 선·안쪽 원). 화면 Text role 로 고를 수 없다"}
# 반경 4단, 그림자 2단(패널 5 권고) — B2 v2 값
d['radius'] = {'sign': 3, 'row': 6, 'button': 8, 'sheet': 12,
    'note': '4단: 팻말·입력칸 3 / 행·선택지·칩 6 / 버튼 8 / 시트·대화상자 12. 알약(36)·반경 16~28 폐기. keypadKey·codeCell 은 row(6)',
    'keypadKey': 6, 'codeCell': 6}
d['shadow'] = {'none': '기본(그림자 없음). 단단한 판 느낌', 'sheet': {'css': '0 -4px 12px rgba(21,21,21,.18)', 'use': '시트'},
    'dialog': {'css': '0 8px 24px rgba(21,21,21,.24)', 'use': '대화상자'}, 'scrim': 'rgba(21,21,21,.58)',
    'rule': '2단만. 팻말·카드·버튼에는 그림자 없음(테두리로 구분)'}
d['line'] = {'border': 1.5, 'now': 3, 'sign': 2, 'selected': 5, 'focus': 4,
    'note': '조작 요소 테두리 1.5(line 색, 3:1), 지금 행 3(먹), 팻말 2(먹), 고른 쪽 5(파랑 + ✓ + 골랐어요), 포커스 4'}
d['states']['selected'] = {'bg': 'actionSoft', 'border': '5px action', 'plus': '채운 체크 + 글자 "골랐어요"'}
# 팻말(Sign) 컴포넌트 명세
d['sign'] = {
    'what': '부모님이 P5에서 고르신 쪽을 싣는 판(노랑). 낱말(P6)은 싣지 않는다(O-1). 위치: P3 빈 팻말 자리·P7·P3D 홈 맨 위·지난 날·C4(자녀)',
    'props': {'label': '고르신 쪽 글자', 'size': "'hero'(P7·P3D·C4, 화면 너비) | 'row'(지난 날 목록)", 'state': "'empty'(점선, 흰 면) | 'filled'(노랑)"},
    'size': {'hero': {'width': '화면 너비 − 좌우 20(어르신 24)', 'minHeight': 120, 'padding': '12 16'}, 'row': {'minHeight': 56, 'padding': '8 12'}},
    'rope': {'present': 'hero만', 'nail': '지름 8 먹', 'string': '길이 24 선 2 먹', 'note': '끈·못은 움직이지 않고 판만 끈 끝에 매달린다. 목록(row)에는 끈 없음'},
    'tilt': {'hero': '-2°', 'row': '0°(목록은 기울이지 않음)', 'motion': '처음 볼 때 3°→-2° 한 번 600ms ease-out(동작 줄이기에서는 정지)'},
    'edge': {'hero': '먹 2 테두리(바탕과 1.3이라 필수)', 'row': '먹 2', 'empty': '점선 시멘트 1.5, 흰 면'},
    'radius': 3,
    'type': {'handwriting': '글자 48dp 이상일 때만(나눔손글씨 붓, 어르신 60×1.18·자녀 52)', 'small': '48dp 미만은 Noto Sans KR 700(signSmall)'},
    'color': {'face': 'sign #FFD43B', 'ink': 'signInk 먹(12.81)', 'rule': "노랑은 'sign' 역할(부모님 답 전용)로만 허용"},
    'a11y': {'role': 'text', 'label': "'부모님이 고르신 쪽, {글자}'(자녀) / '오늘 고르신 쪽, {글자}'(어르신)", 'decorative': '끈·못은 읽지 않음'},
    'maxFontScale': 1.3,
}
d['_meta'] = {'name': '토큰 v5 (B2 v2 장날 팻말 값 매핑)', 'date': '2026-11-20',
    'status': '오너 결정 11-20: O-1(팻말 = 고른 쪽)·O-2(B2 v2 채택)·O-6(도장 7칸 삭제)·O-8(장식 폐기). tokens-v4.json의 역할×면 체계는 그대로, 값만 교체',
    'basis': 'design-system/scripts/map-v5.py 가 tokens-v4.json 에서 생성, 대비는 contrast-v4.py tokens-v5.json 으로 계산',
    'rule': '화면은 역할만 고른다. 노랑은 sign 전용. 갈색(v4 action)은 폐기, 누르는 것은 차일 파랑'}
d['brand'] = {'symbol': {'value': '#FFD43B', 'status': '후보(오너 확인 전)', 'use': '런처 아이콘·스플래시·스토어 그래픽에만. sign과 이름·사용처 분리(앱 화면 안 사용 금지)', 'ink': '#151515'},
    'note': '노랑 팻말 윤곽 + 家 한 글자. 스토어 설명에서 家의 뜻(가화만사성)을 연결'}
d['v3Aliases'] = d.get('v3Aliases', {})
d['v3Aliases']['v4Deprecated'] = '해님(sun·sunRay·blush)·家 인장(brandSeal*)·테이프(tape)·accentSun·accentPeach 는 v5에서 삭제(O-8 장식 폐기)'
d.pop('candidates', None)   # accentSun 후보(팻말 면)는 sign 으로 대체
d['colorRules'] = [
    '파랑(action)은 누르는 것에만. 읽는 글은 먹(inkBody), 제목도 먹(inkTitle, 위계는 크기·굵기)',
    '노랑(sign)은 부모님이 고르신 쪽 팻말 전용. 다른 면·글자·버튼·장식에 쓰지 않는다. 팻말에는 먹 테두리 2를 항상 붙인다',
    '글자 대비 어르신 7:1·자녀 4.5:1, 경계·아이콘 3:1. 허용 조합은 allowed 표만',
    'info는 시멘트 회 + ⓘ 아이콘 + 옅은 회 면. 파랑을 쓰지 않는다',
    '색만으로 상태를 구분하지 않음: 지금 행은 테두리 3 + 글자 + ›, 고른 쪽은 테두리 5 + ✓ + 글자',
    '완료 초록(doneInk)·위험 빨강(dangerInk)은 기능 색으로 유지(팔레트 6색 밖, 의미 전용)',
    '장식 폐기: 해님·스티치·테이프·폴라로이드 마운트·家 인장은 쓰지 않는다. 사진은 둘레 장식 없이 사진 그대로',
]
json.dump(d, open(DST, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
print('tokens-v5.json 생성')
