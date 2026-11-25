// C0 로그인 v4(시안 child/C0_login_ds4, 로그인 스택 3화면 분리 Q9). 실기기 S25 버그 11-19(카카오 버튼 잘림)의 재발 방지 포함:
// Dock = 소셜 묶음(카카오·구글) + 보조 '이메일로 시작하기'뿐. 약관·연령은 본문 끝(V4-INDEX C0), 부모님 출구는 제목 바로 아래(P-13).
// 한계: jest 에는 레이아웃 엔진이 없다. 200%에서 이메일 링크가 본문 끝으로 가는 것(DsScreen 넘침 단계)은 dsLayout 테스트·에뮬레이터 캡처(e2e/audit/c0-fit.yaml)가 근거.
import React from 'react';
import {StyleSheet} from 'react-native';
import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi} from '../src/features/fakeApi';
import {SOCIAL_MIN_HEIGHT} from '../src/ui/ds/SocialButton';
import {press} from '../testUtils/flow';
import {setupWarmAppRoot} from '../testUtils/warm';

// 첫 테스트만 콜드 스타트(첫 로드·첫 렌더)를 떠안지 않게 파일 시작 때 한 번 예열(#245 M2, testUtils/warm)
setupWarmAppRoot();

afterEach(() => {
  jest.restoreAllMocks();
});

async function openC0(w: number, h: number, fontScale = 1) {
  jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({width: w, height: h, scale: 2.625, fontScale});
  render(<AppRoot api={createFakeApi()} />);
  await press(/자녀 휴대폰이에요/);
  await waitFor(() => screen.getByTestId('legal-child'));
}

for (const [name, w, h] of [
  ['S25 411×891', 411, 891],
  ['360×640', 360, 640],
] as const) {
  test(`${name} 글자 1.0: Dock 은 카카오·구글 + 이메일 링크, 약관·연령은 본문, 부모님 출구는 제목 바로 아래`, async () => {
    await openC0(w, h);
    const dock = within(screen.getByTestId('screen-dock'));
    expect(dock.getAllByRole('button').map(b => b.props.accessibilityLabel)).toEqual([
      expect.stringMatching(/카카오/),
      expect.stringMatching(/Google/),
      expect.stringMatching(/이메일로 시작하기/),
    ]);
    for (const id of ['legal-child', 'age-notice', 'parent-exit']) {
      expect(dock.queryByTestId(id)).toBeNull();
    }
    const body = within(screen.getByTestId('screen-body'));
    expect(body.getByTestId('legal-child')).toBeTruthy();
    expect(body.getByTestId('age-notice')).toBeTruthy();
    expect(body.getByRole('button', {name: '부모님은 로그인하지 않아요 · 처음으로'})).toBeTruthy();
    expect(body.queryByText('부모님이시면 처음으로')).toBeNull(); // 본문 끝 옛 출구는 없앴다(하나로)
  });
}

test('P-13: 부모님 출구는 제목 바로 다음(안내·약관보다 앞), 어르신 치수(누름 64·글자 20 이상), 누르면 처음 화면', async () => {
  await openC0(360, 640);
  const body = screen.getByTestId('screen-body');
  const order = within(body)
    .getAllByText(/로그인하고 시작해요|부모님은 로그인하지 않아요|가족 연결 번호를 만들 때 필요해요/)
    .map(n => n.props.children);
  expect(order).toEqual(['로그인하고 시작해요', '부모님은 로그인하지 않아요 · 처음으로', '가족 연결 번호를 만들 때 필요해요']);
  const exit = screen.getByTestId('parent-exit');
  expect(exit.props.accessibilityLabel).toBe('부모님은 로그인하지 않아요. 처음으로'); // #163 리뷰 M: '·'는 읽지 않는다
  // #163 재확인 L: 문구(copy)가 바뀌어도 읽기 이름에 가운뎃점이 남지 않는다(copy 값으로 다시 확인)
  expect(require('../src/copy/copy').copy.login.parent_exit_top.split(' · ').join('. ')).not.toMatch(/·/);
  expect(exit.props.accessibilityLabel).not.toMatch(/·/);
  expect(StyleSheet.flatten(within(exit).getByText('부모님은 로그인하지 않아요 · 처음으로').props.style).textAlign).toBe('left'); // 제목·안내와 같은 왼쪽 정렬
  expect(StyleSheet.flatten(exit.props.style).minHeight).toBeGreaterThanOrEqual(64);
  expect(StyleSheet.flatten(within(exit).getByText('부모님은 로그인하지 않아요 · 처음으로').props.style).fontSize).toBeGreaterThanOrEqual(20);
  await act(async () => fireEvent.press(exit));
  await waitFor(() => screen.getByText(/이 휴대폰은 누구 거예요/));
});

test('\'이런 앱이에요\' 카드는 키 760 이상에서만, 심볼·카드는 글자 150% 이상이면 숨김', async () => {
  await openC0(360, 820);
  expect(screen.getByTestId('login-preview')).toBeTruthy();
  expect(screen.getByText('이런 앱이에요')).toBeTruthy();
  expect(screen.getByTestId('brand-symbol', {includeHiddenElements: true})).toBeTruthy();
  screen.unmount();
  await openC0(360, 640);
  expect(screen.queryByTestId('login-preview')).toBeNull();
  expect(screen.getByTestId('brand-symbol', {includeHiddenElements: true})).toBeTruthy();
  screen.unmount();
  await openC0(360, 820, 2);
  expect(screen.queryByTestId('login-preview')).toBeNull();
  expect(screen.queryByTestId('brand-symbol', {includeHiddenElements: true})).toBeNull();
});

test('약관 링크는 400 + 밑줄, 문장은 sub 보조색(700 은 제목·버튼만, V4-INDEX C0)', async () => {
  // 화면의 약관 주소는 빌드 설정에 따라 비어 있을 수 있어(그때는 일반 글자) 주소를 준 LegalText 로 본다
  const {LegalText} = require('../src/ui/LegalText');
  const {toneColor} = require('../src/ui/ds/roles');
  render(<LegalText testID="lt" audience="child" text="로그인하면 이용약관과 개인정보 처리방침에 동의하게 돼요" links={[{label: '이용약관', url: 'https://x/t'}, {label: '개인정보 처리방침', url: 'https://x/p'}]} />);
  expect(StyleSheet.flatten(screen.getByTestId('lt').props.style).color).toBe(toneColor('sub', 'muted', 'child'));
  const links = screen.getAllByRole('link');
  expect(links).toHaveLength(2);
  for (const l of links) {
    const st = StyleSheet.flatten(l.props.style);
    expect(st.fontWeight).toBe('400');
    expect(st.textDecorationLine).toBe('underline');
  }
});

test('소셜 버튼은 최소 높이만(고정 높이 없음), 카카오·구글 같은 최소 높이(GUIDELINES: 같은 높이·같은 폭)', async () => {
  await openC0(411, 891);
  const [kakao, google] = within(screen.getByTestId('dock-social')).getAllByRole('button');
  const st = (n: typeof kakao) => StyleSheet.flatten(typeof n.props.style === 'function' ? n.props.style({pressed: false}) : n.props.style);
  for (const b of [kakao, google]) {
    expect(st(b).minHeight).toBe(SOCIAL_MIN_HEIGHT);
    expect(st(b).height).toBeUndefined();
    expect(st(b).alignSelf).toBe('stretch');
  }
  expect(st(kakao).backgroundColor).toBe('#FEE500'); // 카카오 컨테이너 색 규정
});

test('C0-b 이메일: BackLink \'로그인으로\', Field \'이메일 주소\'(placeholder 없음), Dock 은 인증번호 받기만', async () => {
  await openC0(360, 640);
  await press('이메일로 시작하기');
  await waitFor(() => screen.getByText('이메일로 시작해요'));
  expect(screen.getByRole('link', {name: '로그인으로'})).toBeTruthy();
  const field = screen.getByLabelText('이메일 주소');
  expect(field.props.placeholder).toBeUndefined();
  const dock = within(screen.getByTestId('screen-dock'));
  expect(dock.getAllByRole('button').map(b => b.props.accessibilityLabel)).toEqual([expect.stringMatching(/인증번호 받기/)]);
});

test('C0-c 인증번호: BackLink \'이메일 주소로\', 보이는 라벨 \'인증번호\'·읽기 이름 \'인증번호 6자리\', Dock 없음', async () => {
  await openC0(360, 640);
  await press('이메일로 시작하기');
  await waitFor(() => screen.getByText('이메일로 시작해요'));
  const {fireEvent} = require('@testing-library/react-native');
  fireEvent.changeText(screen.getByLabelText('이메일 주소'), 'kid@example.test');
  await press('인증번호 받기');
  await waitFor(() => screen.getByText('메일로 받은 인증번호 6자리를 써 주세요'));
  expect(screen.getByRole('link', {name: '이메일 주소로'})).toBeTruthy();
  expect(screen.getByText('인증번호', {includeHiddenElements: true})).toBeTruthy(); // 보이는 라벨(읽기에서는 칸 이름으로만 — D-18 B4)
  expect(screen.getByLabelText('인증번호 6자리')).toBeTruthy();
  expect(screen.queryByTestId('screen-dock')).toBeNull();
});

test('#163 리뷰(R-15): 첫 화면 끝이 안내 줄 묶음을 가르면 그 묶음을 통째로 접힘 밖으로, 약관 묶음만 걸치면 약관 묶음을 민다', async () => {
  await openC0(360, 640, 2);
  const lay = (id: string, y: number, h: number) => fireEvent(screen.getByTestId(id), 'layout', {nativeEvent: {layout: {x: 0, y, width: 312, height: h}}});
  const mt = (id: string) => StyleSheet.flatten(screen.getByTestId(id).props.style)?.marginTop;
  await act(async () => {
    lay('screen-body-area', 0, 324); // 접힘 = 324 − 띠 24 = 300
    lay('login-fold', 260, 400); // 묶음 위 끝 260(제목·출구 아래)
    lay('login-fold-0', 0, 80); // 260~340 → 300 에 걸림
    lay('login-fold-1', 0, 200);
  });
  expect(mt('login-fold-0')).toBe(300 - 260 + 1);
  expect(mt('login-fold-1')).toBeUndefined();
  await act(async () => {
    lay('screen-body-area', 0, 424); // 접힘 400: 안내 묶음은 들어가고 약관 묶음(356~556)이 걸림
  });
  expect(mt('login-fold-0')).toBeUndefined();
  expect(mt('login-fold-1')).toBe(400 - 356 + 1);
});
