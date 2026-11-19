#!/usr/bin/env node
/* eslint-env node */
// 토큰 v4 생성기(디자인 시스템 v4, SUMMARY Q11): 원본 design-system/tokens-v4.json → 앱 생성물 app/src/ui/tokensV4.ts.
// 원본(디자인 레인)만 손으로 고치고, 생성물은 이 스크립트로만 덮어쓴다. 값이 바뀌면 원본을 고친 뒤 다시 돌리면 된다.
//   node scripts/gen-tokens-v4.js          # 생성물을 원본과 같게
//   node scripts/gen-tokens-v4.js --check  # 다르면 실패(exit 1), 파일은 바꾸지 않음
// 같은지는 app/__tests__/tokensV4.test.ts 가 npm test 에서도 검사한다(이 파일의 render 를 불러 비교).
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'design-system/tokens-v4.json');
const DST = path.join(ROOT, 'app/src/ui/tokensV4.ts');

const AUDIENCES = ['elder', 'child'];
const QUALIFIER = {어르신: 'elder', 자녀: 'child', 주: 'primary', 보조: 'secondary'};

/** 원본 필수 값. 없으면 기본값으로 채우지 않고 멈춘다(원본이 이긴다, PR #21 리뷰 L1) */
function need(v, where) {
  if (v === undefined || v === null || (typeof v === 'number' && Number.isNaN(v))) {
    throw new Error(`gen-tokens-v4: 원본에 값이 없어요: ${where}`);
  }
  return v;
}

/** {size, lineHeight} · '52/68' · '22/30 + 아이콘 24' → {size, lineHeight, icon?} */
function parseSize(s, where) {
  if (s && typeof s === 'object' && typeof s.size === 'number') {
    return {size: s.size, lineHeight: s.lineHeight};
  }
  const m = /^(\d+)\/(\d+)(?:\s*\+\s*\D*(\d+))?/.exec(String(s).trim());
  if (!m) {
    throw new Error(`gen-tokens-v4: 크기/줄높이를 읽지 못했어요(${where}): ${s}`);
  }
  const out = {size: Number(m[1]), lineHeight: Number(m[2])};
  if (m[3]) {
    out.icon = Number(m[3]);
  }
  return out;
}

/** 'inkSub(어르신)/inkSubChild(자녀)' · 'onAction(주, 흰)/action(보조)' · 'inkTitle' → {default?|elder?|primary?...: tone} */
function parseTone(s, colors, where) {
  const out = {};
  for (const part of String(s).split('/')) {
    const m = /^\s*([A-Za-z]+)\s*(?:\(([^)]*)\))?/.exec(part);
    if (!m) {
      throw new Error(`gen-tokens-v4: tone 을 읽지 못했어요(${where}): ${s}`);
    }
    if (!(m[1] in colors)) {
      throw new Error(`gen-tokens-v4: tone 색이 color 에 없어요(${where}): ${m[1]}`);
    }
    const q = m[2] ? QUALIFIER[m[2].split(',')[0].trim()] : undefined;
    out[q ?? 'default'] = m[1];
  }
  return out;
}

function buildRoles(src, colors) {
  const roles = {};
  for (const [name, def] of Object.entries(src.typeRoles)) {
    if (name === 'unit') {
      continue;
    }
    const tone = parseTone(need(def.tone, `typeRoles.${name}.tone`), colors, name);
    const role = {weight: need(def.weight, `typeRoles.${name}.weight`), maxFontScale: need(def.maxFontScale, `typeRoles.${name}.maxFontScale`)};
    for (const a of AUDIENCES) {
      const v = need(def[a], `typeRoles.${name}.${a}`);
      const t = tone[a] ?? tone.default;
      const icon = def[`icon${a === 'elder' ? 'Elder' : 'Child'}`];
      if (typeof v === 'object' && typeof v.size !== 'number') {
        // button 어르신: {primary, secondary}
        role[a] = Object.fromEntries(
          Object.entries(v).map(([k, s]) => [k, {...parseSize(s, `${name}.${a}.${k}`), tone: tone[k] ?? t ?? tone.primary}]),
        );
      } else {
        const size = parseSize(v, `${name}.${a}`);
        if (tone.primary) {
          // button 자녀: 한 크기, 주·보조 tone 은 따로
          role[a] = {primary: {...size, tone: tone.primary}, secondary: {...size, tone: tone.secondary ?? tone.primary}};
        } else {
          role[a] = {...size, ...(icon ? {icon} : {}), tone: t};
        }
      }
    }
    roles[name] = role;
  }
  return roles;
}

/**
 * 글자 tone×면 허용 목록(화이트리스트, 원본 allowed — design-system/scripts/contrast-v4.py 가 계산).
 * allowed.elderText / childText = {tone: [면...]} → [{fg, bg, audience: ['elder'|'child'...]}].
 * 원본 구조가 바뀌면 이 함수만 고친다. 화면·컴포넌트는 tone 이름만 쓰므로 값이 바뀌어도 다시 짤 일이 없다.
 */
function buildTextPairs(src, colors) {
  const allowed = src.allowed;
  if (!allowed || !allowed.elderText || !allowed.childText) {
    throw new Error('gen-tokens-v4: 원본에 allowed.elderText·childText(허용 목록)가 없어요');
  }
  const out = [];
  for (const [aud, key] of [['elder', 'elderText'], ['child', 'childText']]) {
    for (const [fg, bgs] of Object.entries(allowed[key])) {
      for (const bg of bgs) {
        if (!(fg in colors) || !(bg in colors)) {
          throw new Error(`gen-tokens-v4: 허용 목록의 색 이름이 color 에 없어요: ${fg} on ${bg}`);
        }
        const same = out.find(o => o.fg === fg && o.bg === bg);
        if (same) {
          same.audience.push(aud);
        } else {
          out.push({fg, bg, audience: [aud]});
        }
      }
    }
  }
  return out;
}

function buildNonText(src) {
  return Object.entries(src.allowed.nonText ?? {}).flatMap(([fg, bgs]) => bgs.map(bg => ({fg, bg})));
}

/** v3Aliases 의 색 별칭: 'action(색) 또는 inkBody(글)…' → {ink: 'action'}(값이 같은 첫 이름). 생성물에서 색 별칭은 이 표로만 만든다 */
function buildColorAliases(src, colors) {
  const out = {};
  for (const [name, desc] of Object.entries(src.v3Aliases ?? {})) {
    if (name === 'note' || typeof desc !== 'string') {
      continue;
    }
    const targets = [...desc.matchAll(/([A-Za-z]+)\(/g)].map(m => m[1]).filter(n => n in colors);
    if (targets.length) {
      out[name] = targets[0];
    }
  }
  return out;
}

/** 'max(28, insets.bottom)' → 28 */
function parseMaxMin(s, where) {
  if (typeof s === 'number') {
    return s;
  }
  return Number(need((/max\(\s*(\d+)/.exec(String(s)) ?? [])[1], `${where}(max(숫자, …))`));
}

/** 'card(흰) + line 테두리 1.5, 알약' → 'card'. 첫 색 이름이 color 에 없으면 멈춘다 */
function parseSurface(s, colors) {
  const name = (/([A-Za-z]+)/.exec(String(s)) ?? [])[1];
  if (!name || !(name in colors)) {
    throw new Error(`gen-tokens-v4: backLink.surface 의 면 색을 읽지 못했어요: ${s}`);
  }
  return name;
}

function build(src) {
  // contrast-v4.py 와 같은 기준: {value} 가 있는 항목만 색
  const colors = Object.fromEntries(
    Object.entries(src.color)
      .filter(([, v]) => typeof v === 'string' || (v && typeof v.value === 'string'))
      .map(([k, v]) => [k, typeof v === 'string' ? v : v.value]),
  );
  return {
    meta: {name: src._meta.name, date: src._meta.date, status: src._meta.status},
    color: colors,
    v3ColorAlias: buildColorAliases(src, colors),
    type: buildRoles(src, colors),
    contrastMin: {elder: src.contrast.thresholds.elderText, child: src.contrast.thresholds.childText, nonText: src.contrast.thresholds.nonText},
    textOnSurface: buildTextPairs(src, colors),
    nonText: buildNonText(src),
    space: {
      grid: src.space.grid, group: src.space.group, between: src.space.between, section: src.space.section,
      screenX: {elder: src.space.screenX, child: src.space.screenXChild}, topSafeMin: src.space.topSafeMin, bottom: src.space.bottom,
    },
    radius: Object.fromEntries(Object.entries(src.radius).filter(([k]) => k !== 'note')),
    touch: {elder: src.touch.elder, child: src.touch.child},
    fontScaleCap: {body: src.touch.fontScaleCap.body, fixed: src.touch.fontScaleCap.titleDockNumeral},
    minFont: {elder: src.typeScaleV3.elder.min, child: src.typeScaleV3.child.min},
    dock: {
      maxHeightRatio: src.dock.maxHeightRatio,
      padding: {top: need(src.dock.padding.top, 'dock.padding.top'), bottomMin: parseMaxMin(src.dock.padding.bottom, 'dock.padding.bottom'), x: need(src.dock.padding.x, 'dock.padding.x')},
      socialGroupMax: need(src.dock.socialGroup?.maxItems, 'dock.socialGroup.maxItems'),
    },
    // R-05·R-20: 1.2 미만이어도 되는 인접 쌍(이름으로 둔 것만). [audience, 큰 역할, 작은 역할]
    ratioCompensatedPairs: src.tests?.ratioCompensatedPairs ?? [],
    backLink: {
      icon: {elder: src.backLink.icon.sizeElder, child: src.backLink.icon.sizeChild, stroke: src.backLink.icon.stroke},
      height: src.backLink.height,
      minWidthElder: src.backLink.minWidthElder,
      tone: src.backLink.color,
      surface: parseSurface(src.backLink.surface, colors),
      borderWidth: Number(need((/테두리\s*([\d.]+)/.exec(src.backLink.surface) ?? [])[1], 'backLink.surface 테두리 두께')),
    },
    screenVariants: Object.keys(src.screenVariants).filter(k => !['count', 'overlays', 'variantControls', 'sections', 'oneScreenOnePurpose', 'build1'].includes(k)),
    v3Aliases: src.v3Aliases,
  };
}

// prettier 규칙(작은따옴표·끝 쉼표)에 맞춘 직렬화. 줄 길이 대신 한 단계 객체마다 줄을 나눈다.
function ser(v, ind) {
  const pad = '  '.repeat(ind + 1);
  if (Array.isArray(v)) {
    if (v.every(x => typeof x !== 'object' || x === null) || v.length === 0) {
      return `[${v.map(x => ser(x, ind)).join(', ')}]`;
    }
    return `[\n${v.map(x => `${pad}${ser(x, ind + 1)},`).join('\n')}\n${'  '.repeat(ind)}]`;
  }
  if (v && typeof v === 'object') {
    const entries = Object.entries(v).filter(([, x]) => x !== undefined);
    const key = k => (/^[A-Za-z_$][\w$]*$/.test(k) ? k : `'${k}'`);
    const prim = x => typeof x !== 'object' || x === null;
    const flat = entries.every(([, x]) => prim(x) || (Array.isArray(x) && x.every(prim)));
    if (flat && entries.length <= 6) {
      return `{${entries.map(([k, x]) => `${key(k)}: ${ser(x, ind)}`).join(', ')}}`;
    }
    return `{\n${entries.map(([k, x]) => `${pad}${key(k)}: ${ser(x, ind + 1)},`).join('\n')}\n${'  '.repeat(ind)}}`;
  }
  if (typeof v === 'string') {
    return `'${v.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  }
  return String(v);
}

/** 원본 JSON 객체 → 생성물 TS 문자열(테스트가 같은 함수로 비교한다) */
function render(src) {
  const t = build(src);
  return [
    '// 생성물 — 손으로 고치지 마세요. 원본 design-system/tokens-v4.json, 생성 node scripts/gen-tokens-v4.js',
    '// 동기화는 __tests__/tokensV4.test.ts 가 지킨다. v3 이름(tokens.ts)은 한 릴리스 별칭으로 병행(Q11).',
    '',
    `export const tokensV4 = ${ser(t, 0)} as const;`,
    '',
    'export type ColorV4 = keyof typeof tokensV4.color;',
    'export type Audience = \'elder\' | \'child\';',
    'export type TypeRoleV4 = keyof typeof tokensV4.type;',
    '',
  ].join('\n');
}

function main() {
  if (!fs.existsSync(SRC)) {
    console.error(`gen-tokens-v4: 원본이 없어요: ${SRC}`);
    process.exit(1);
  }
  const out = render(JSON.parse(fs.readFileSync(SRC, 'utf8')));
  const cur = fs.existsSync(DST) ? fs.readFileSync(DST, 'utf8') : '';
  if (process.argv.includes('--check')) {
    if (cur === out) {
      console.log('gen-tokens-v4: 같음');
      return;
    }
    console.error('gen-tokens-v4: 생성물이 원본과 달라요. node scripts/gen-tokens-v4.js 를 실행하세요.');
    process.exit(1);
  }
  if (cur === out) {
    console.log('gen-tokens-v4: 이미 같음(바꾸지 않음)');
    return;
  }
  fs.writeFileSync(DST, out);
  console.log('gen-tokens-v4: 생성물 갱신 → app/src/ui/tokensV4.ts');
}

if (require.main === module) {
  main();
}
module.exports = {render, build, SRC, DST};
