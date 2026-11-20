#!/usr/bin/env python3
"""본문 첫 화면 접힘 경계 검사(RULES-V4 R-15, #163 리뷰 — C0a 200%). fold-check.py(P1 키 전용)의 글줄판.

flow 가 첫 화면에서 멈춘 상태를 호스트에서 본다(run.sh FOLD_CHECK=body 가 부른다, 예: audit/c0-fold.yaml).
- 본문 스크롤 창(testID screen-body) 안의 글·버튼 중 아래 끝이 스크롤 창 아래 끝에 붙은 것을 후보로 잡고,
  본문을 조금 올려 다시 재서 높이가 늘어나면(= 첫 화면에서 잘려 있었다) 실패. 딱 맞게 끝난 요소는 통과.
사용: fold-check-body.py <adb 경로>   (ANDROID_SERIAL 로 기기를 고른다)
"""
import re
import subprocess
import sys
import xml.etree.ElementTree as ET

ADB = sys.argv[1] if len(sys.argv) > 1 else 'adb'


def sh(*args: str) -> str:
    return subprocess.run([ADB, *args], check=True, capture_output=True, text=True).stdout


def bounds(s: str) -> tuple[int, int, int, int]:
    x1, y1, x2, y2 = map(int, re.findall(r'\d+', s))
    return x1, y1, x2, y2


def dump():
    sh('shell', 'uiautomator', 'dump', '/sdcard/fold-check-body.xml')
    root = ET.fromstring(sh('exec-out', 'cat', '/sdcard/fold-check-body.xml'))
    scrolls = [n for n in root.iter('node') if n.get('class') == 'android.widget.ScrollView']
    if not scrolls:
        sys.exit('fold-check-body: 스크롤 창이 없어요')
    # 본문 스크롤 창 = testID 'screen-body'(옛 Screen·DsScreen 공통). 없으면 글을 가장 많이 담은 ScrollView
    named = [n for n in scrolls if n.get('resource-id') == 'screen-body']
    body = named[0] if named else max(scrolls, key=lambda n: sum(1 for c in n.iter('node') if c.get('text')))
    items = {}
    for n in body.iter('node'):
        label = n.get('text') or n.get('content-desc') or ''
        if not label or n is body:
            continue
        _, y1, _, y2 = bounds(n.get('bounds', '0,0,0,0'))
        if y2 > y1:
            items.setdefault(label, (y1, y2))
    return bounds(body.get('bounds')), items


(bx1, top, bx2, bottom), items = dump()
# 아래 끝이 스크롤 창 아래 끝에 붙은 요소 = 잘렸을 수도, 딱 맞게 끝났을 수도 있다(uiautomator 는 보이는 부분만 준다)
cands = {k: v for k, v in items.items() if v[1] >= bottom - 1 and v[0] < bottom - 1}
bad = []
if cands:
    # 조금 올려 다시 재면 잘린 요소는 높이가 늘어난다(딱 맞게 끝난 요소는 그대로). 판정 뒤 화면은 올린 채로 끝난다
    x = (bx1 + bx2) // 2
    sh('shell', 'input', 'swipe', str(x), str(bottom - 40), str(x), str(bottom - 240), '600')
    _, after = dump()
    for label, (y1, y2) in cands.items():
        if label in after and (after[label][1] - after[label][0]) > (y2 - y1) + 2:
            bad.append(f'{label[:30]}: 첫 화면에서 보이는 높이 {y2 - y1}px < 올린 뒤 {after[label][1] - after[label][0]}px(걸침)')
print(f'fold-check-body: 스크롤 창 {top}~{bottom}px, 본문 요소 {len(items)}개, 아래 끝에 붙은 요소 {len(cands)}개')
if bad:
    sys.exit('fold-check-body: 실패\n  ' + '\n  '.join(bad))
print('fold-check-body: 통과(첫 화면 끝에 반쯤 걸친 글·버튼 없음)')
