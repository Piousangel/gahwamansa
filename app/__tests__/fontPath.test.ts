// F-01 글꼴 경로: 원본 font → 생성물 → roleText(fontStyle) → Android 굵기별 묶음 / iOS 굵기별 이름. Jua 폐기(A2)
import {fontStyle, roleText} from '../src/ui/ds/roles';
import {tokensV4 as t} from '../src/ui/tokensV4';

const fs: {readFileSync(p: string, e: string): string} = require('fs');
const path: {join(...p: string[]): string} = require('path');
const SRC = JSON.parse(fs.readFileSync(path.join(__dirname, '../../design-system/tokens-v4.json'), 'utf8'));

const font = t.font as unknown as NonNullable<Parameters<typeof fontStyle>[3]>;
const bundled = {...font, bundled: true};
const unbundled = {...font, bundled: false};

test('Jua 는 어느 역할의 글꼴도 아니다(answer·answerRow 포함, A2 8/8)', () => {
  const faces = Object.entries(SRC.typeRoles).filter(([, d]) => (d as {fontFace?: string}).fontFace === 'Jua');
  expect(faces).toEqual([]);
  expect(Object.values(t.font.roleFace)).not.toContain('Jua');
  expect(t.font.roleFace.answer).toBe('body');
});

test('본문 글꼴은 Noto Sans KR 400·700, 숫자 tabular, 손글씨(붓)는 48dp 이상', () => {
  expect(t.font.body.family).toBe('Noto Sans KR');
  expect(Object.keys(t.font.body.faces).sort()).toEqual(['400', '700']);
  expect(t.font.body.numerals).toBe('tabular-nums');
  expect(t.font.hand.minSize).toBe(48);
});

test('번들 전(bundled=false)이면 글꼴을 넣지 않는다(시스템 글꼴)', () => {
  expect(fontStyle('body', 700, 'android', unbundled)).toEqual({});
});

test('지금은 번들됨: roleText 가 글꼴을 싣는다(테스트 환경 Platform = ios → 굵기별 이름)', () => {
  expect(t.font.bundled).toBe(true);
  expect(roleText('body', 'elder').style.fontFamily).toBe('NotoSansKR-Regular');
  expect(roleText('title', 'elder').style.fontFamily).toBe('NotoSansKR-Bold');
  expect(roleText('answer', 'child').style.fontFamily).toBe(t.font.body.faces[String(roleText('answer', 'child').style.fontWeight) as '400' | '700']);
});

test('Android 글꼴 묶음 XML·파일·등록이 토큰과 같은 이름', () => {
  const res = path.join(__dirname, '../android/app/src/main/res/font');
  for (const f of ['notosanskr.xml', 'notosanskr_regular.otf', 'notosanskr_bold.otf', 'nanumbrushscript.xml', 'nanumbrushscript_regular.ttf']) {
    expect([f, fs.readFileSync(path.join(res, f), 'latin1').length > 0]).toEqual([f, true]);
  }
  const app = fs.readFileSync(path.join(__dirname, '../android/app/src/main/java/com/bumojasik/app/MainApplication.kt'), 'utf8');
  expect(app).toContain(`addCustomFont(this, "${t.font.body.android}", R.font.${t.font.body.android})`);
  expect(app).toContain(`addCustomFont(this, "${t.font.hand.android}", R.font.${t.font.hand.android})`);
});

test('번들 뒤 Android: XML 묶음 하나 + fontWeight 로 굵기 파일(가짜 굵게 없음), 숫자 tabular', () => {
  expect(fontStyle('body', 400, 'android', bundled)).toEqual({fontFamily: 'notosanskr', fontVariant: ['tabular-nums']});
  expect(fontStyle('body', 700, 'android', bundled)).toEqual({fontFamily: 'notosanskr', fontVariant: ['tabular-nums']});
});

test('번들 뒤 iOS: 굵기별 PostScript 이름', () => {
  expect(fontStyle('body', 400, 'ios', bundled).fontFamily).toBe('NotoSansKR-Regular');
  expect(fontStyle('body', 700, 'ios', bundled).fontFamily).toBe('NotoSansKR-Bold');
  expect(fontStyle('hand', 700, 'ios', bundled).fontFamily).toBe('NanumBrush'); // PostScript 이름(fc-scan) // 굵기가 하나면 400 파일
  expect(fontStyle('hand', 400, 'ios', bundled).fontVariant).toBeUndefined();
});
