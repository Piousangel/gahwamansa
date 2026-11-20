import React from 'react';
import {fireEvent, render, screen} from '@testing-library/react-native';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {OssScreen} from '../src/app/OssScreen';
import {buildOssRows, ossRows} from '../src/lib/ossLicenses';
import {copy} from '../src/copy/copy';

// AU-06 오픈소스 라이선스: 목록 최신성(의존성을 바꾸고 `npm run oss` 를 안 하면 실패) + 화면
declare const __dirname: string;
const fs: {readFileSync(f: string, e: 'utf8'): string} = require('fs');
const path: {join(...p: string[]): string} = require('path');
const {collectJs, render: renderJson} = require('../scripts/ossLicenses.js');

describe('목록 최신성', () => {
  test('JS 목록 = package-lock 출시 의존성(dev 제외)·LICENSE 전문 — 다르면 npm run oss:js', () => {
    const committed = fs.readFileSync(path.join(__dirname, '../src/oss/js.generated.json'), 'utf8');
    const next = renderJson(collectJs());
    if (next !== committed) {
      // 리뷰 O5: 코드가 아니라 설치 상태 문제일 수 있다
      throw new Error('src/oss/js.generated.json 이 지금 설치된 의존성과 달라요. app 에서 `npm ci`(설치가 lock 과 다를 때) 뒤 `npm run oss:js` 로 다시 만들어 커밋해 주세요.');
    }
  });

  test('JS 목록에 출시 의존성은 다 있고 개발 도구는 없다', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));
    const names = new Set(ossRows().map(r => r.name));
    for (const dep of Object.keys(pkg.dependencies)) {
      expect(names.has(dep)).toBe(true);
    }
    expect(names.has('jest')).toBe(false);
    expect(names.has('eslint')).toBe(false);
    expect(names.has('fb-dotslash')).toBe(false); // 빌드 도구 제외(리뷰 O3)
    const async = ossRows().find(r => r.name === '@react-native-async-storage/async-storage');
    expect(async?.text).toMatch(/Permission is hereby granted/); // 전문 보충(리뷰 O3)
  });

  test('Android 목록: 비어 있지 않고 모든 모듈에 라이선스 이름이 있다(Gradle generateOssAndroid, release 빌드가 최신성 검사)', () => {
    const a = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/oss/android.generated.json'), 'utf8'));
    expect(a.packages.length).toBeGreaterThan(20);
    expect(a.packages.filter((p: {licenses: unknown[]}) => p.licenses.length === 0)).toEqual([]);
    const names = a.packages.map((p: {name: string}) => p.name);
    expect(names).toContain('com.facebook.react:react-android');
    const g = fs.readFileSync(path.join(__dirname, '../android/app/build.gradle'), 'utf8');
    expect(g).toContain('dependsOn("verifyOssLicenses")');
  });
});

test('합치기: 전문은 id 로 찾고, Android 는 라이선스 이름·주소', () => {
  const rows = buildOssRows(
    {packages: [{name: 'b-js', version: '1.0.0', license: 'MIT', text: 'abc'}], texts: {abc: 'MIT 전문'}},
    {packages: [{name: 'a:native', version: '2.0', licenses: [{name: 'Apache-2.0', url: 'https://www.apache.org/licenses/LICENSE-2.0'}]}]},
  );
  expect(rows.map(r => [r.name, r.license, r.text, r.url])).toEqual([
    ['a:native', 'Apache-2.0', null, 'https://www.apache.org/licenses/LICENSE-2.0'],
    ['b-js', 'MIT', 'MIT 전문', null],
  ]);
});

test('번들 글꼴(F-01): OFL 1.1 행이 있고, 전문에 저작권과 라이선스 원문이 들어 있다', () => {
  const fonts = ossRows().filter(r => r.key.startsWith('font:'));
  expect(fonts.map(r => r.name)).toEqual(expect.arrayContaining(['Noto Sans KR (Regular, Bold)', 'Nanum Brush Script']));
  for (const r of fonts) {
    expect(r.license).toBe('SIL OFL 1.1');
    expect(r.text).toMatch(/Copyright|©/);
    expect(r.text).toContain('SIL OPEN FONT LICENSE Version 1.1');
  }
});

test('화면: 안내 한 줄 + 행(이름·라이선스), 누르면 전문을 펼친다', () => {
  const Stack = createNativeStackNavigator();
  render(
    <NavigationContainer>
      <Stack.Navigator screenOptions={{headerShown: false}}>
        <Stack.Screen name="Oss" component={OssScreen} />
      </Stack.Navigator>
    </NavigationContainer>,
  );
  expect(screen.getByText(copy.app_info.oss_intro)).toBeTruthy();
  const first = ossRows().find(r => r.text)!;
  const row = screen.getByRole('button', {name: `${first.name} ${first.version}, ${first.license}`});
  expect(screen.queryByTestId('oss-text')).toBeNull();
  fireEvent.press(row);
  expect(screen.getByTestId('oss-text')).toBeTruthy();
  fireEvent.press(row);
  expect(screen.queryByTestId('oss-text')).toBeNull();
});
