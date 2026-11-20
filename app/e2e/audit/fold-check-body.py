#!/usr/bin/env python3
"""본문 첫 화면 접힘 경계 검사(RULES-V4 R-15, #163 리뷰 — C0a 200%). fold-check.py(P1 키 전용)의 글줄판.

flow 가 첫 화면에서 멈춘 상태를 호스트에서 본다(run.sh FOLD_CHECK=body 가 부른다, 예: audit/c0-fold.yaml).
- 본문 스크롤 창(가장 안쪽 ScrollView) 안의 글·버튼 중, 아래 끝이 스크롤 창 아래 끝에 붙어 있고(보이는 부분만 잡힘)
  위 끝은 그보다 위인 것 = 접힘에 반쯤 걸친 요소 → 실패.
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


sh('shell', 'uiautomator', 'dump', '/sdcard/fold-check-body.xml')
root = ET.fromstring(sh('exec-out', 'cat', '/sdcard/fold-check-body.xml'))
scrolls = [n for n in root.iter('node') if n.get('class') == 'android.widget.ScrollView']
if not scrolls:
    sys.exit('fold-check-body: 스크롤 창이 없어요')
# 본문 스크롤 창 = 가장 큰(높이) ScrollView
body = max(scrolls, key=lambda n: bounds(n.get('bounds'))[3] - bounds(n.get('bounds'))[1])
_, top, _, bottom = bounds(body.get('bounds'))
bad = []
seen = 0
for n in body.iter('node'):
    label = n.get('text') or n.get('content-desc') or ''
    if not label or n is body:
        continue
    _, y1, _, y2 = bounds(n.get('bounds', '0,0,0,0'))
    if y2 <= y1:
        continue
    seen += 1
    if y2 >= bottom - 1 and y1 < bottom - 1:
        bad.append(f'{label[:30]}: 보이는 {y1}~{y2}, 스크롤 창 아래 끝 {bottom}(걸침)')
print(f'fold-check-body: 스크롤 창 {top}~{bottom}px, 본문 요소 {seen}개')
if bad:
    sys.exit('fold-check-body: 실패\n  ' + '\n  '.join(bad))
print('fold-check-body: 통과(첫 화면 끝에 반쯤 걸친 글·버튼 없음)')
