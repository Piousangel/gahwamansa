import React from 'react';
import {fireEvent, render, screen, waitFor} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi} from '../src/features/fakeApi';
import {press, toHomeConsented, pressCourseNext} from '../testUtils/flow';
import {setupWarmAppRoot} from '../testUtils/warm';

// 첫 테스트만 콜드 스타트(첫 로드·첫 렌더)를 떠안지 않게 파일 시작 때 한 번 예열(#245 M2, testUtils/warm)
setupWarmAppRoot();

// @types/node 가 없어 필요한 부분만 선언한다(jest 는 node 에서 돈다)
declare const __dirname: string;
type Dirent = {name: string; isDirectory(): boolean};
const fs: {readdirSync(d: string, o: {withFileTypes: true}): Dirent[]; readFileSync(f: string, e: 'utf8'): string} = require('fs');
const path: {join(...p: string[]): string; relative(a: string, b: string): string; sep: string} = require('path');

function files(dir: string): string[] {
  return fs.readdirSync(dir, {withFileTypes: true}).flatMap((d: Dirent) => {
    const p = path.join(dir, d.name);
    return d.isDirectory() ? files(p) : /\.tsx?$/.test(d.name) ? [p] : [];
  });
}

test('화면 코드에서 개발용 자리표시(AssetPlaceholder)를 쓰지 않는다', () => {
  const src = path.join(__dirname, '../src');
  const users = files(src).filter(f => !f.includes(`${path.sep}ui${path.sep}assets${path.sep}`) && fs.readFileSync(f, 'utf8').includes('AssetPlaceholder'));
  expect(users.map(f => path.relative(src, f))).toEqual([]);
});

test('화면 코드가 쓰는 등록 에셋은 모두 실제 파일이 있다(null 아님)', () => {
  const {assetRegistry} = require('../src/ui/assets/registry');
  const src = path.join(__dirname, '../src');
  const used = new Set<string>();
  for (const f of files(src)) {
    for (const m of fs.readFileSync(f, 'utf8').matchAll(/assetRegistry\['([^']+)'\]/g)) {
      used.add(m[1]);
    }
  }
  for (const n of used) {
    expect([n, assetRegistry[n]]).not.toEqual([n, null]);
  }
});

const noDevBox = () => {
  expect(screen.queryAllByTestId('asset-placeholder', {includeHiddenElements: true})).toHaveLength(0);
  expect(screen.queryAllByText(/\[아이콘:/, {includeHiddenElements: true})).toHaveLength(0);
};

test('주요 화면을 돌아도 개발용 자리표시 상자가 없다', async () => {
  render(<AppRoot api={createFakeApi()} />);
  noDevBox();
  await press(/부모님 휴대폰이에요/);
  await waitFor(() => screen.getByText('가족에게 받은 번호를 써 주세요'));
  noDevBox();
  expect(screen.queryByText('안녕하세요, 해님이에요')).toBeNull(); // 해님 말은 첫 만남·완료·오류에만
});

test('코스 단계(사진 준비 중·한글)에도 개발용 자리표시가 없다', async () => {
  await toHomeConsented(createFakeApi({consented: true}));
  noDevBox();
  await pressCourseNext();
  await waitFor(() => screen.getByText('사진을 준비하고 있어요'));
  noDevBox();
  await press('다 봤어요');
  await waitFor(() => screen.getByTestId('date-line'));
  await pressCourseNext();
  await waitFor(() => screen.getByText('봄'));
  fireEvent.press(screen.getByText('봄'));
  await press('정했어요');
  await pressCourseNext();
  await waitFor(() => screen.getByLabelText('따라 쓸 낱말, 나무'));
  noDevBox();
});
