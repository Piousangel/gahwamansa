import React from 'react';
import {StatusBar} from 'react-native';
import {render} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi} from '../src/features/fakeApi';
import {setupWarmAppRoot} from '../testUtils/warm';

// 첫 테스트만 콜드 스타트(첫 로드·첫 렌더)를 떠안지 않게 파일 시작 때 한 번 예열(#245 M2, testUtils/warm)
setupWarmAppRoot();

declare const __dirname: string;
const fs: {readFileSync(f: string, e: 'utf8'): string} = require('fs');
const res = (p: string) => fs.readFileSync(`${__dirname}/../android/app/src/main/res/${p}`, 'utf8');

test('상태 표시줄 아이콘은 어둡게(종이색 배경 위에서 보이게)', () => {
  const r = render(<AppRoot api={createFakeApi()} />);
  const bar = r.UNSAFE_getByType(StatusBar);
  expect(bar.props.barStyle).toBe('dark-content');
});

test('테마는 라이트 고정(DayNight 아님), 상태 표시줄 아이콘 어둡게', () => {
  for (const f of ['values/styles.xml', 'values-v29/styles.xml']) {
    const xml = res(f);
    expect(xml).toContain('parent="Theme.AppCompat.Light.NoActionBar"');
    expect(xml).not.toContain('DayNight');
    expect(xml).toContain('<item name="android:windowLightStatusBar">true</item>');
  }
});
