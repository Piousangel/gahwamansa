#!/usr/bin/env node
// 디렉터 A 시안 렌더·측정. Chrome headless 를 DevTools 프로토콜로 몰아 360×640(기기 배율 2)로 찍고 DOM 을 잰다.
// (headless=new 는 창 폭 최소가 500이라 --window-size 360 이 먹지 않는다 → Emulation.setDeviceMetricsOverride 로 폭을 맞춤)
// 사용: node docs/team/board/2026-11-19-expert-review/creative/A/tools/render.mjs [a1-ilryeok a2-pyeonji ...]
// 출력: img/<안 2글자>-<화면>-100.png · -200.png(360×640 첫 화면) · -200-full.png(200% 펼침), tools/measure.json
// 측정(common/frame.js): 글자 최소 크기, 글자/면 대비(어르신 7·자녀 4.5), 가로 잘림, 글자 겹침, 접힘 경계에서 반쯤 잘린 줄, 누름 높이, Dock 비율.
// 320×640 · 200%(v4 보드 폭)도 측정만 한다. 스크린샷은 동작 줄이기(reduce)로 찍어 도장 등 마지막 모습을 보인다.
import { spawn } from 'node:child_process';
import { writeFileSync, readFileSync, existsSync, mkdirSync, mkdtempSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(HERE);
const CH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const DIRS = ['a1-ilryeok', 'a2-pyeonji', 'a3-jogakbo'];
const SCREENS = ['p3', 'p4', 'p7', 'c4'];
const PORT = 9300 + Math.floor(Math.random() * 500);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(CH, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${mkdtempSync(join(tmpdir(), 'crA-'))}`, '--no-first-run', 'about:blank'], { stdio: 'ignore' });

async function wsUrl() {
  for (let i = 0; i < 50; i++) {
    try { const r = await fetch(`http://127.0.0.1:${PORT}/json/list`); const j = await r.json(); const p = j.find((t) => t.type === 'page'); if (p) return p.webSocketDebuggerUrl; } catch {}
    await sleep(200);
  }
  throw new Error('chrome not ready');
}

const ws = new WebSocket(await wsUrl());
await new Promise((r) => ws.addEventListener('open', r));
let id = 0; const pend = new Map();
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
const cdp = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pend.set(i, (m) => (m.error ? rej(new Error(method + ' ' + m.error.message)) : res(m.result))); ws.send(JSON.stringify({ id: i, method, params })); });

await cdp('Page.enable'); await cdp('Runtime.enable');

async function load(file, q, w, h, reduce) {
  await cdp('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 2, mobile: true });
  await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: reduce ? 'reduce' : 'no-preference' }] });
  await cdp('Page.navigate', { url: 'file://' + file + q });
  for (let i = 0; i < 150; i++) {
    await sleep(100);
    const r = await cdp('Runtime.evaluate', { expression: 'document.title', returnByValue: true });
    if (r.result.value === 'MEASURED') break;
  }
  const m = await cdp('Runtime.evaluate', { expression: "(document.getElementById('measure')||{}).textContent||'{}'", returnByValue: true });
  return JSON.parse(m.result.value);
}
async function shot(name, w, h) {
  await cdp('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 2, mobile: true });
  await sleep(150);
  const r = await cdp('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: w, height: h, scale: 1 } });
  writeFileSync(join(ROOT, 'img', name), Buffer.from(r.data, 'base64'));
}

const dirs = process.argv.slice(2).filter((a) => DIRS.includes(a));
mkdirSync(join(ROOT, 'img'), { recursive: true });
const mp = join(HERE, 'measure.json');
const all = existsSync(mp) ? JSON.parse(readFileSync(mp, 'utf8')) : {};
const FIELDS = ['small', 'lowContrast', 'clipped', 'overlap', 'foldCut', 'tapShort'];
try {
  for (const d of dirs.length ? dirs : DIRS) for (const sc of SCREENS) {
    const f = join(ROOT, d, sc + '.html'); if (!existsSync(f)) continue;
    const tag = d.slice(0, 2); const res = {};
    res['320-200'] = await load(f, '?s=2', 320, 640, true);
    res['360-200-full'] = await load(f, '?s=2&full=1', 360, 640, true);
    const fh = Math.max(640, res['360-200-full'].docH || 640);
    await shot(`${tag}-${sc}-200-full.png`, 360, fh);
    res['360-200'] = await load(f, '?s=2', 360, 640, true); await shot(`${tag}-${sc}-200.png`, 360, 640);
    res['360-100'] = await load(f, '?s=1', 360, 640, true); await shot(`${tag}-${sc}-100.png`, 360, 640);
    all[`${d}/${sc}`] = res;
    const bad = {};
    for (const [k, v] of Object.entries(res)) { const b = {}; for (const x of FIELDS) if (v[x] && v[x].length) b[x] = v[x]; if (Object.keys(b).length) bad[k] = b; }
    console.log(`${d}/${sc} vw=${res['360-100'].vw} dock=${res['360-100'].dockRatio}/${res['360-200'].dockRatio} more=${res['360-100'].more}/${res['360-200'].more} fullH=${fh}`, Object.keys(bad).length ? 'BAD ' + JSON.stringify(bad) : 'OK');
  }
} finally {
  writeFileSync(mp, JSON.stringify(all, null, 1));
  ws.close(); chrome.kill();
}
