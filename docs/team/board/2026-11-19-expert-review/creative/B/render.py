#!/usr/bin/env python3
"""디렉터 B 시안 렌더·측정. Chrome headless 로 안×화면×배율 PNG 를 img/ 에 찍고, --dump-dom 으로 frame.js 측정 JSON 을 모은다.
사용: python3 docs/team/board/2026-11-19-expert-review/creative/B/render.py [안 파일 이름 …]
결과: img/<안>-<화면>-<100|200>.png, measure.json"""
import json, os, re, subprocess, sys, html

HERE = os.path.dirname(os.path.abspath(__file__))
CH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
PLANS = sys.argv[1:] or ['b1-broadcast', 'b2-market', 'b3-familyroom']
SCREENS = ['P3', 'P4', 'P7', 'C4']
COMMON = ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files',
          '--window-size=360,640', '--virtual-time-budget=8000', '--run-all-compositor-stages-before-draw']
mpath = os.path.join(HERE, 'measure.json')
res = json.load(open(mpath)) if os.path.exists(mpath) else {}
for p in PLANS:
    for s in SCREENS:
        for f in (1, 2):
            url = f'file://{HERE}/{p}.html?s={s}&f={f}'
            png = os.path.join(HERE, 'img', f'{p}-{s}-{f*100}.png')
            subprocess.run([CH, *COMMON, '--force-device-scale-factor=2', f'--screenshot={png}', url],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=90)
            dom = subprocess.run([CH, *COMMON, '--dump-dom', url], capture_output=True, text=True, timeout=90).stdout
            m = re.search(r'<pre id="m" hidden="">(.*?)</pre>', dom, re.S)
            key = f'{p}/{s}/{f*100}'
            res[key] = json.loads(html.unescape(m.group(1))) if m else {'error': 'no measure'}
            r = res[key]
            print(key, 'OK' if r.get('ok') else 'CHECK', {k: v for k, v in r.items() if k in ('straddle', 'overlap', 'overflowX', 'smallText', 'smallTap', 'dockRatio', 'moreBand') and v})
json.dump(res, open(mpath, 'w'), ensure_ascii=False, indent=1, sort_keys=True)
