#!/usr/bin/env node
/* eslint-env node */
// 오픈소스 라이선스 목록(JS) 생성·검사(AU-06). 근원: package-lock.json 의 출시 의존성(dev·optional 제외) + node_modules 의 LICENSE 파일.
//   node scripts/ossLicenses.js          # src/oss/js.generated.json 다시 쓰기(의존성을 바꾼 뒤)
//   node scripts/ossLicenses.js --check  # 다르면 실패(release 빌드·jest 가 부른다)
// Android 네이티브 목록은 Gradle 'generateOssAndroid'(src/oss/android.generated.json). 화면: app/OssScreen.
// 새 의존성 없음(node 표준 모듈만).
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const APP = path.join(__dirname, '..');
const OUT = path.join(APP, 'src/oss/js.generated.json');
// 리뷰 O3: 배포본에 전문 파일이 없는 런타임 패키지는 저장소 원문(2026-11-18 GitHub 기본 브랜치 LICENSE)을 scripts/oss-supplement 에 고정해 쓴다
const SUPPLEMENT = {
  '@react-native-async-storage/async-storage': 'async-storage.LICENSE.txt',
  'fast-base64-decode': 'fast-base64-decode.LICENSE.txt',
  boolbase: 'boolbase.LICENSE.txt',
};
// 앱에 들어가지 않는 개발·빌드 도구(lock 에 dev 표시가 없어 출시 의존성으로 잡히는 것)는 목록에서 뺀다
const EXCLUDE = new Set(['@react-native/debugger-frontend', 'fb-dotslash']);
const META_FAMILY = /^(@react-native\/|metro($|-)|hermes-|flow-|ob1$|react-devtools-core$|fb-dotslash$)/;
const LICENSE_FILE =/^(licen[sc]e|copying|notice)([.-].*)?(\.(md|txt|markdown))?$/i;

function readLicenseText(dir) {
  let names;
  try {
    names = fs.readdirSync(dir);
  } catch {
    return null;
  }
  const hits = names.filter(n => LICENSE_FILE.test(n)).sort();
  const texts = hits
    .map(n => {
      try {
        return fs.readFileSync(path.join(dir, n), 'utf8').replace(/\r\n/g, '\n').trim();
      } catch {
        return '';
      }
    })
    .filter(Boolean);
  return texts.length ? texts.join('\n\n') : null;
}

/** lock + node_modules → {packages:[{name,version,license,text}], texts:{id:text}} (같은 전문은 한 번만) */
function collectJs(appDir = APP) {
  const lock = JSON.parse(fs.readFileSync(path.join(appDir, 'package-lock.json'), 'utf8'));
  const seen = new Map();
  const texts = {};
  for (const [key, v] of Object.entries(lock.packages || {})) {
    if (!key || v.dev || v.devOptional || v.optional || v.link) {
      continue;
    }
    const name = v.name || key.slice(key.lastIndexOf('node_modules/') + 'node_modules/'.length);
    const id = `${name}@${v.version}`;
    if (seen.has(id) || EXCLUDE.has(name)) {
      continue;
    }
    let license = v.license;
    if (!license) {
      try {
        license = JSON.parse(fs.readFileSync(path.join(appDir, key, 'package.json'), 'utf8')).license;
      } catch {
        license = undefined;
      }
    }
    // 전문 파일이 없는 Meta 패키지(react-native 묶음·metro·hermes·flow)는 같은 저작권자·같은 MIT 인 react-native 의 LICENSE 로
    const supplement = SUPPLEMENT[name] ? path.join(__dirname, 'oss-supplement', SUPPLEMENT[name]) : null;
    const text =
      readLicenseText(path.join(appDir, key)) ??
      (supplement ? fs.readFileSync(supplement, 'utf8').replace(/\r\n/g, '\n').trim() : null) ??
      (license === 'MIT' && META_FAMILY.test(name) ? readLicenseText(path.join(appDir, 'node_modules/react-native')) : null);
    let textId = null;
    if (text) {
      textId = crypto.createHash('sha256').update(text).digest('hex').slice(0, 12);
      texts[textId] = text;
    }
    seen.set(id, {name, version: v.version, license: typeof license === 'string' ? license : 'UNKNOWN', text: textId});
  }
  const packages = [...seen.values()].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : a.version < b.version ? -1 : 1));
  const sortedTexts = Object.fromEntries(Object.keys(texts).sort().map(k => [k, texts[k]]));
  return {packages, texts: sortedTexts};
}

const render = data => JSON.stringify(data, null, 1) + '\n';

function main(argv) {
  const next = render(collectJs());
  if (argv.includes('--check')) {
    const cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
    if (cur !== next) {
      console.error('오픈소스 라이선스 목록(JS)이 의존성과 달라요. app 에서 `npm run oss:js` 로 다시 만들어 커밋해 주세요(설치가 lock 과 다르면 먼저 `npm ci`).');
      process.exit(1);
    }
    console.log('오픈소스 라이선스 목록(JS): 최신');
    return;
  }
  fs.mkdirSync(path.dirname(OUT), {recursive: true});
  fs.writeFileSync(OUT, next);
  const d = JSON.parse(next);
  console.log(`오픈소스 라이선스 목록(JS): ${d.packages.length}개, 전문 ${Object.keys(d.texts).length}종 → ${path.relative(APP, OUT)}`);
}

module.exports = {collectJs, render, OUT};
if (require.main === module) {
  main(process.argv.slice(2));
}
