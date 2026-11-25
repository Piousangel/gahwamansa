// 대기열 44: 200% 캡처가 없던 화면의 빈틈(docs/team/qa/evidence/2026-11-25-200-gap, #272)을 순서·배치로 고친다.
// 문턱은 공용 ui/bigText(1.6, #263 리드 결정). 1.5 이하는 예전 배치 그대로인지도 함께 본다.
// jest 에는 레이아웃이 없어 배치는 트리 순서·어느 영역(screen-top·screen-body·screen-dock)에 있는지로, 접힘(R-15)은 onLayout 을 손으로 보내 본다.
import React from 'react';
import {StyleSheet} from 'react-native';
import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi} from '../src/features/fakeApi';
import {finishFlight} from '../src/app/splash';
import {resetFirstScreenMotion} from '../src/features/link/RoleSelect';
import {relationOrder} from '../src/features/child/RelationScreen';
import {BIG_TEXT_SCALE, isBigText} from '../src/ui/bigText';
import {press, typeCode} from '../testUtils/flow';

let mockFontScale = 1;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({width: 320, height: 640, scale: 2.75, fontScale: mockFontScale}),
}));
beforeEach(() => {
  resetFirstScreenMotion();
  finishFlight();
});
afterEach(() => {
  mockFontScale = 1;
  jest.restoreAllMocks();
});

/** 화면에 그려진(호스트) 요소 중 글이 q 인 첫 요소의 트리 순서 */
const orderOf = (...qs: string[]) => {
  const texts = screen.UNSAFE_root.findAll(n => typeof n.type === 'string' && typeof n.props.children === 'string').map(n => n.props.children as string);
  return qs.map(q => texts.findIndex(t => t.includes(q)));
};

test('문턱: 1.6부터 큰 글자 배치(1.59 는 예전 배치) — 1.51·1.75 로 옮기면 아래 경계 시험이 깨진다', () => {
  expect(BIG_TEXT_SCALE).toBe(1.6);
  expect(isBigText(1.59)).toBe(false);
  expect(isBigText(1.6)).toBe(true);
});

describe('M1 FS: 글자 1.6배 이상이면 질문 → 두 버튼 → 워드마크·소개 순서', () => {
  async function fs(scale: number) {
    mockFontScale = scale;
    render(<AppRoot api={createFakeApi()} />);
    // 큰 글씨에서 질문·버튼 영역이 화면에 다 안 들어가면 고정을 풀고 전체 스크롤(기존 동작). 그 상태의 순서를 본다
    await act(async () => {
      fireEvent(screen.getByTestId('first-dock-content'), 'layout', {nativeEvent: {layout: {x: 0, y: 0, width: 272, height: 900}}});
    });
    expect(screen.queryByTestId('screen-dock')).toBeNull();
  }

  test.each([1.6, 2])('글자 %s배: 질문과 두 버튼이 워드마크보다 먼저', async scale => {
    await fs(scale);
    const [q, parent, child, word] = orderOf('이 휴대폰은 누구 거예요?', '부모님 휴대폰이에요', '자녀 휴대폰이에요', '가화만사성');
    expect(q).toBeGreaterThanOrEqual(0);
    expect(q).toBeLessThan(parent);
    expect(parent).toBeLessThan(child);
    expect(child).toBeLessThan(word);
    expect(screen.getByTestId('first-brand-after')).toBeTruthy();
  });

  test.each([1.5, 1.59])('글자 %s배: 예전 그대로 워드마크 → 소개 → 질문', async scale => {
    await fs(scale);
    const [word, q] = orderOf('가화만사성', '이 휴대폰은 누구 거예요?');
    expect(word).toBeLessThan(q);
    expect(screen.queryByTestId('first-brand-after')).toBeNull();
  });
});

describe('H1·M2 P1c: 글자 1.5배 이상이면(320×640 150%도 번호가 걸쳐 P1c 만 1.5부터) 다른 번호 쓰기는 본문 끝, 번호 카드 먼저', () => {
  async function p1c(scale: number) {
    mockFontScale = scale;
    render(<AppRoot api={createFakeApi()} role="parent" />);
    await typeCode('123456');
    await waitFor(() => screen.getByRole('button', {name: '이 번호로 연결하기'}));
  }

  test.each([1.5, 1.6, 2])('글자 %s배', async scale => {
    await p1c(scale);
    const dock = within(screen.getByTestId('screen-dock'));
    expect(dock.getByRole('button', {name: '이 번호로 연결하기'})).toBeTruthy();
    expect(dock.queryByText('다른 번호 쓰기')).toBeNull();
    const body = within(screen.getByTestId('screen-body'));
    expect(body.getByTestId('confirm-rest-body')).toBeTruthy();
    expect(body.getByText('다른 번호 쓰기')).toBeTruthy();
    // 본문 순서: 제목 → 카드(번호) → 안심 줄 → 약관 줄 → 다른 번호 쓰기
    const [title, code, other] = orderOf('이 번호가 맞나요?', '123 456', '다른 번호 쓰기');
    expect(title).toBeLessThan(code);
    expect(code).toBeLessThan(other);
  });

  test.each([1, 1.3, 1.49])('글자 %s배: 예전 그대로 Dock 에 셋 다', async scale => {
    await p1c(scale);
    const dock = within(screen.getByTestId('screen-dock'));
    expect(dock.getByRole('button', {name: '이 번호로 연결하기'})).toBeTruthy();
    expect(dock.getByText('다른 번호 쓰기')).toBeTruthy();
    expect(screen.queryByTestId('confirm-rest-body')).toBeNull();
  });

  // #274 QA-2 M1 리드 결정: 누르는 것이 곧 동의 → 모든 배율에서 약관 고지는 Dock 안 [이 번호로 연결하기] 바로 위(본문 스크롤 아래 금지).
  // 1.6 이상은 긴 줄이 Dock 상한을 넘쳐(200% 실측 191dp > 256 중 남는 칸) 짧은 고지 + '약관' 링크, 긴 문장은 본문에 그대로
  const dockOrder = () => {
    const dock = screen.getByTestId('screen-dock');
    const ids = dock.findAll((n: {type: unknown; props: {testID?: string}}) => typeof n.type === 'string' && ['confirm-legal-dock', 'big-button'].includes(n.props?.testID ?? '')).map((n: {props: {testID?: string}}) => n.props.testID);
    return [...new Set(ids)];
  };
  test.each([1, 1.3, 1.49, 1.5, 1.59])('M1 글자 %s배: 긴 약관 줄이 Dock 안 버튼 바로 위', async scale => {
    await p1c(scale);
    expect(dockOrder()).toEqual(['confirm-legal-dock', 'big-button']);
    const legalDock = within(screen.getByTestId('confirm-legal-dock'));
    expect(legalDock.getByText('연결하면 이용약관에 동의하고 개인정보 처리방침을 확인해요')).toBeTruthy();
    expect(screen.queryByTestId('legal-short')).toBeNull();
    expect(within(screen.getByTestId('screen-body')).queryByText('연결하면 이용약관에 동의하고 개인정보 처리방침을 확인해요')).toBeNull();
  });
  test.each([1.6, 2])('M1 글자 %s배: 짧은 고지가 Dock 안 버튼 바로 위, 긴 문장은 본문', async scale => {
    await p1c(scale);
    expect(dockOrder()).toEqual(['confirm-legal-dock', 'big-button']);
    expect(within(screen.getByTestId('confirm-legal-dock')).getByText('연결하면 약관에 동의하게 돼요')).toBeTruthy();
    expect(within(screen.getByTestId('confirm-rest-body')).getByText('연결하면 이용약관에 동의하고 개인정보 처리방침을 확인해요')).toBeTruthy();
  });
});

describe('M3 C1: 1열(1.5 이상)이면 기본값 부모님을 맨 위로, 1.6 이상이면 머리·안내 줄도 본문으로', () => {
  async function c1(scale: number) {
    mockFontScale = scale;
    render(<AppRoot api={createFakeApi({who: 'child'})} restore />);
    await waitFor(() => screen.getByTestId('title-group'));
  }

  test('순서 함수: 큰 글자면 부모님 먼저, 나머지는 시안 순서', () => {
    expect(relationOrder(true)).toEqual(['부모님', '엄마', '아빠', '어머니', '아버지', '할머니', '할아버지']);
    expect(relationOrder(false)).toEqual(['엄마', '아빠', '어머니', '아버지', '할머니', '할아버지', '부모님']);
  });

  test.each([1.6, 2])('글자 %s배: 위 고정에는 처음으로만, 제목·설명은 본문, 안내 줄은 본문 끝, 첫 칸은 골라진 부모님', async scale => {
    await c1(scale);
    const top = within(screen.getByTestId('screen-top'));
    expect(top.getByRole('link', {name: '처음으로'})).toBeTruthy();
    expect(top.queryByText('부모님을 어떻게 부르세요?')).toBeNull();
    const body = within(screen.getByTestId('screen-body'));
    expect(body.getByTestId('ds-header-in-body')).toBeTruthy();
    await waitFor(() => expect(body.getByText('지금은 부모님 폰이 안드로이드일 때만 연결돼요')).toBeTruthy());
    expect(within(screen.getByTestId('screen-dock')).queryByText('지금은 부모님 폰이 안드로이드일 때만 연결돼요')).toBeNull();
    const radios = screen.getAllByRole('radio');
    expect(radios[0].props.accessibilityLabel ?? '').toContain('부모님');
    expect(radios[0].props.accessibilityState.checked).toBe(true);
  });

  test.each([1, 1.49])('글자 %s배(2열): 예전 그대로 머리는 위 고정, 첫 칸은 엄마', async scale => {
    await c1(scale);
    expect(within(screen.getByTestId('screen-top')).getByText('부모님을 어떻게 부르세요?')).toBeTruthy();
    expect(screen.queryByTestId('ds-header-in-body')).toBeNull();
    expect(screen.getAllByRole('radio')[0].props.accessibilityLabel ?? '').toContain('엄마');
  });

  test.each([1.5, 1.59])('글자 %s배(1열, 1.6 미만): 머리는 위 고정 그대로, 첫 칸만 부모님(150%도 7번째가 첫 화면 밖이었다)', async scale => {
    await c1(scale);
    expect(within(screen.getByTestId('screen-top')).getByText('부모님을 어떻게 부르세요?')).toBeTruthy();
    expect(screen.queryByTestId('ds-header-in-body')).toBeNull();
    expect(screen.getAllByRole('radio')[0].props.accessibilityLabel ?? '').toContain('부모님');
  });
});

describe('M4 C7: 묶음(제목 + 카드) 단위 접힘', () => {
  test('200%: 첫 화면 끝이 계정 묶음(제목 + 가족 연결 카드)을 가르면 묶음째 접힘 아래로, 첫 묶음은 그대로', async () => {
    mockFontScale = 2;
    render(<AppRoot api={createFakeApi({consented: true, parentTitle: '엄마', childFamily: true, childLinked: true})} role="child" />);
    await waitFor(() => screen.getByRole('button', {name: '설정'}));
    await press('설정');
    await waitFor(() => screen.getByTestId('c7-item-account'));
    const ids = screen.UNSAFE_root.findAll(n => typeof n.type === 'string' && /^c7-item-/.test(n.props?.testID ?? '')).map(n => n.props.testID as string);
    // 큰 글자: 계정 묶음(접힘 창보다 길다)을 '가족 연결' 카드 묶음과 나머지 카드로 나눠 각각 접힘 단위
    expect(ids.slice(-4)).toEqual(['c7-item-account', 'c7-item-account-rest', 'c7-item-app', 'c7-item-foot']);
    const lay = (id: string, y: number, h: number) => fireEvent(screen.getByTestId(id), 'layout', {nativeEvent: {layout: {x: 0, y, width: 272, height: h}}});
    const mt = (id: string) => StyleSheet.flatten(screen.getByTestId(id).props.style)?.marginTop ?? 0;
    // 접힘 = 본문 영역 470 − 띠 24 = 446, 계정 묶음 253~468 이 446 에 걸림
    await act(async () => {
      lay('screen-body-area', 0, 470);
      lay('c7-block', 0, 0);
      ids.forEach(id => lay(id, 0, id === ids[0] ? 237 : id === 'c7-item-account' ? 215 : 100)); // 에뮬레이터 실측(첫 묶음 237 · 계정 215)
    });
    expect(mt(ids[0])).toBe(0);
    expect(mt('c7-item-account')).toBeGreaterThan(0);
  });

  test('L2: 알림 스위치 읽기 이름에 무엇을 켜는지까지', async () => {
    const RN = require('react-native');
    Object.defineProperty(RN.Platform, 'Version', {value: 34, configurable: true, writable: true});
    const prevOS = RN.Platform.OS;
    Object.defineProperty(RN.Platform, 'OS', {value: 'android', configurable: true, writable: true});
    jest.spyOn(RN.PermissionsAndroid, 'check').mockResolvedValue(true);
    try {
      render(<AppRoot api={createFakeApi({consented: true, parentTitle: '엄마', childFamily: true})} role="child" />);
      await waitFor(() => screen.getByRole('button', {name: '설정'}));
      await press('설정');
      await waitFor(() => screen.getByRole('switch', {name: '가족 연결, 가족 휴대폰과 연결되면 알려 드려요'}));
    } finally {
      Object.defineProperty(RN.Platform, 'OS', {value: prevOS, configurable: true, writable: true});
    }
  });
});

test('C7 100%: 계정 묶음은 예전처럼 한 카드(나누지 않음)', async () => {
  render(<AppRoot api={createFakeApi({consented: true, parentTitle: '엄마', childFamily: true, childLinked: true})} role="child" />);
  await waitFor(() => screen.getByRole('button', {name: '설정'}));
  await press('설정');
  await waitFor(() => screen.getByTestId('c7-item-account'));
  expect(screen.queryByTestId('c7-item-account-rest')).toBeNull();
});

test('C7 100%: 첫 화면 끝이 계정 묶음을 갈라도 밀지 않는다(통째로 밀면 첫 화면 절반이 빈다, 에뮬레이터 실측)', async () => {
  render(<AppRoot api={createFakeApi({consented: true, parentTitle: '엄마', childFamily: true, childLinked: true})} role="child" />);
  await waitFor(() => screen.getByRole('button', {name: '설정'}));
  await press('설정');
  await waitFor(() => screen.getByTestId('c7-item-account'));
  const ids = screen.UNSAFE_root.findAll(n => typeof n.type === 'string' && /^c7-item-/.test(n.props?.testID ?? '')).map(n => n.props.testID as string);
  const lay = (id: string, y: number, h: number) => fireEvent(screen.getByTestId(id), 'layout', {nativeEvent: {layout: {x: 0, y, width: 312, height: h}}});
  // 100%에서는 접힘 창을 넘기지 않는다(본문 영역에 onLayout 이 없음) → 접힘 계산 자체가 돌지 않는다
  expect(screen.getByTestId('screen-body-area').props.onLayout).toBeUndefined();
  await act(async () => {
    lay('c7-block', 0, 0);
    ids.forEach(id => lay(id, 0, id === ids[0] ? 166 : id === 'c7-item-account' ? 318 : 100)); // 에뮬레이터 실측 360×640 100%
  });
  ids.forEach(id => expect(StyleSheet.flatten(screen.getByTestId(id).props.style)?.marginTop ?? 0).toBe(0));
});
