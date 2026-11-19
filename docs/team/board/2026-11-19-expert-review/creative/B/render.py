#!/usr/bin/env python3
"""디렉터 B 시안 렌더·측정. Chrome headless 로 안×화면×(폭·배율) PNG 를 img/ 에 찍고, --dump-dom 으로 frame.js 측정 JSON 을 모은다.
사용: python3 docs/team/board/2026-11-19-expert-review/creative/B/render.py [안 파일 이름 …]
  v1 3안: 360×640 100%·200%,  v2(b2v2-market): 360×640 100%·200% + 320×640 200%
결과: img/<안>-<화면>-<100|200>.png (320 폭은 -320-200), measure.json. 키는 '<안>/<화면>/<배율>' 또는 '<안>/<화면>/320-200'."""
import json, os, re, subprocess, sys, html

HERE = os.path.dirname(os.path.abspath(__file__))
CH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
V1 = ['P3', 'P4', 'P7', 'C4']
CONF = {
    'b1-broadcast': (V1, [(360, 1), (360, 2)]),
    'b2-market': (V1, [(360, 1), (360, 2)]),
    'b3-familyroom': (V1, [(360, 1), (360, 2)]),
    'b2v2-market': (['P1', 'P3', 'P4', 'P5', 'P6', 'P7', 'P3D', 'H', 'C4'], [(360, 1), (360, 2), (320, 2)]),
    'b2v2-market~T': (['T0', 'T1', 'T2', 'T3'], [(360, 1)]),  # P6→P7 정지 프레임
}
FONTS = ['brush', 'eastsea', 'dokdo', 'bhs']  # 'fonts' 인자: 팻말 글꼴 비교(P7·H·C4, 360·100%) → img/font-<글꼴>-<화면>.png
DO_FONTS = 'fonts' in sys.argv
PLANS = [a for a in sys.argv[1:] if a != 'fonts'] or ([] if DO_FONTS else list(CONF))
mpath = os.path.join(HERE, 'measure.json')
res = json.load(open(mpath)) if os.path.exists(mpath) else {}


def shot(url, png, w):
    common = ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files',
              f'--window-size={w},640', '--virtual-time-budget=8000', '--run-all-compositor-stages-before-draw']
    subprocess.run([CH, *common, '--force-device-scale-factor=2', f'--screenshot={png}', url],
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=90)
    return subprocess.run([CH, *common, '--dump-dom', url], capture_output=True, text=True, timeout=90).stdout


for p in PLANS:
    screens, sizes = CONF[p]
    for s in screens:
        for w, f in sizes:
            tag = f'{f*100}' if w == 360 else f'{w}-{f*100}'
            fn = p.split('~')[0]
            url = f'file://{HERE}/{fn}.html?s={s}&f={f}&w={w}'
            dom = shot(url, os.path.join(HERE, 'img', f'{fn}-{s}-{tag}.png'), w)
            m = re.search(r'<pre id="m" hidden="">(.*?)</pre>', dom, re.S)
            key = f'{fn}/{s}/{tag}'
            res[key] = json.loads(html.unescape(m.group(1))) if m else {'error': 'no measure'}
            r = res[key]
            print(key, 'OK' if r.get('ok') else 'CHECK', {k: v for k, v in r.items() if k in ('straddle', 'overlap', 'overflowX', 'smallText', 'smallTap', 'dockRatio', 'moreBand', 'error') and v})
if DO_FONTS:
    for mk in FONTS:
        for s in ['P7', 'H', 'C4']:
            shot(f'file://{HERE}/b2v2-market.html?s={s}&f=1&w=360&mk={mk}', os.path.join(HERE, 'img', f'font-{mk}-{s}.png'), 360)
            print('font', mk, s)
json.dump(res, open(mpath, 'w'), ensure_ascii=False, indent=1, sort_keys=True)
