#!/usr/bin/env python3
"""P1 첫 화면 접힘 경계 검사(재확인 6 L28·7 M10, RULES-V4 R-15).

Maestro 는 요소 좌표를 단언하지 못해, 첫 화면에서 멈춘 기기를 호스트에서 본다(run.sh FOLD_CHECK=1 이 audit/p1-fold.yaml 뒤에 부른다).
- 보이는 키는 통째로 보여야 한다(스크롤 창에 잘려 키 높이보다 낮으면 실패 = 줄을 반쯤 가름).
- 보이는 키의 아래 끝은 시스템 내비게이션 바(3버튼은 불투명 버튼) 위여야 한다(M10: 그 밑을 누르면 시스템 버튼이 눌린다).
사용: fold-check.py <adb 경로>   (ANDROID_SERIAL 로 기기를 고른다)
"""
import re
import subprocess
import sys
import xml.etree.ElementTree as ET

ADB = sys.argv[1] if len(sys.argv) > 1 else 'adb'
KEY = re.compile(r'^(숫자 \d|한 칸 지우기)$')


def sh(*args: str) -> str:
    return subprocess.run([ADB, *args], check=True, capture_output=True, text=True).stdout


def bounds(s: str) -> tuple[int, int, int, int]:
    x1, y1, x2, y2 = map(int, re.findall(r'\d+', s))
    return x1, y1, x2, y2


sh('shell', 'uiautomator', 'dump', '/sdcard/fold-check.xml')
root = ET.fromstring(sh('exec-out', 'cat', '/sdcard/fold-check.xml'))
keys = []
# 스크롤 창 아래 끝(px): 키를 담은 가장 안쪽 ScrollView. 여기에 딱 붙어 끝나는 키는 잘린 것(uiautomator 는 보이는 부분만 준다)
scroll_bottom = min([bounds(n.get('bounds'))[3] for n in root.iter('node') if n.get('class') == 'android.widget.ScrollView'] or [10**9])
for n in root.iter('node'):
    desc = n.get('content-desc', '')
    if KEY.match(desc):
        x1, y1, x2, y2 = bounds(n.get('bounds', '0,0,0,0'))
        if y2 > y1:
            keys.append((desc, y1, y2))
if not keys:
    sys.exit('fold-check: 첫 화면에 키가 하나도 없어요(번호 화면이 맞는지 확인)')

# 시스템 내비게이션 바 위 끝(px). dumpsys 의 navigationBars 영역, 없으면 화면 아래 끝
win = sh('shell', 'dumpsys', 'window')
nav = [int(m.group(1)) for m in re.finditer(r'type=navigationBars frame=\[\d+,(\d+)\]\[\d+,\d+\]', win)]
size = re.findall(r'(\d+)x(\d+)', sh('shell', 'wm', 'size'))[-1]
screen_h = int(size[1])
nav_top = min([t for t in nav if t > 0] or [screen_h])
mode = sh('shell', 'settings', 'get', 'secure', 'navigation_mode').strip()  # 0 = 3버튼, 2 = 제스처

# 키 높이 기준 = 가장 흔한 높이(fill 단계에서는 마지막 줄이 더 높을 수 있어 최댓값을 쓰지 않는다)
hs = [y2 - y1 for _, y1, y2 in keys]
full = max(set(hs), key=hs.count)
bad = []
for desc, y1, y2 in keys:
    if y2 - y1 < full - 2 or y2 >= scroll_bottom - 1:
        bad.append(f'{desc}: 잘림(보이는 {y1}~{y2}, 키 높이 {full}, 스크롤 창 아래 끝 {scroll_bottom})')
    if y2 > nav_top:
        bad.append(f'{desc}: 아래 끝 {y2} > 내비 바 위 끝 {nav_top}')
rows = sorted({y1 for _, y1, _ in keys})
print(f'fold-check: 내비 모드 {mode}, 내비 바 위 끝 {nav_top}px, 스크롤 창 아래 끝 {scroll_bottom}px, 키 {len(keys)}개(줄 위 끝 {rows}), 키 높이 {full}px')
if bad:
    sys.exit('fold-check: 실패\n  ' + '\n  '.join(bad))
print('fold-check: 통과(보이는 키는 모두 통째로, 내비 바 위)')
