import React from 'react';
import {Linking, StyleSheet} from 'react-native';
import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {copy} from '../src/copy/copy';
import {createFakeApi} from '../src/features/fakeApi';
import {createRealApi} from '../src/features/realApi';
import {OfflineError} from '../src/features/types';
import {confirmDeleteAll, press, pressLast, toHomeConsented} from '../testUtils/flow';
import {warmAppRoot} from '../testUtils/warm';

// 문의 메일 주소(앱 정보 CONTACT_EMAIL): 기본은 없음, 어르신 문의 안내 테스트만 넣는다(contactRow.test 와 같은 방식)
let mockMail: string | null = null;
jest.mock('../src/lib/appInfo', () => {
  const actual = jest.requireActual('../src/lib/appInfo');
  return {...actual, readAppInfo: () => ({...actual.readAppInfo(), contactEmail: mockMail})};
});
afterEach(() => {
  mockMail = null;
});
const MAILTO = `mailto:help@example.test?subject=${encodeURIComponent('[가화만사성] 내 정보 보기·지우기 요청')}`;

// 첫 테스트만 콜드 스타트를 떠안지 않게 파일 시작 때 한 번 그렸다 내린다(PR #101 리뷰, testUtils/warm)
beforeAll(warmAppRoot);

async function openParentDelete(api: ReturnType<typeof createFakeApi>) {
  await toHomeConsented(api);
  await press('설정');
  await press('모두 지우기');
  await waitFor(() => screen.getByText('모두 지울까요?'));
}

test('어르신: 설정의 모두 지우기는 확인 화면만 열고, 확인 화면의 모두 지우기에서 지운다', async () => {
  const api = createFakeApi({consented: true});
  const del = jest.spyOn(api, 'deleteMyAccount');
  await openParentDelete(api);
  expect(del).not.toHaveBeenCalled();
  await confirmDeleteAll(); // P9 → 2단계 확인 상자
  expect(del).toHaveBeenCalledTimes(1);
  await waitFor(() => screen.getByText('모두 지웠어요'));
  // 스택 초기화: 이전 화면이 남아 있지 않다
  expect(screen.queryByTestId('date-line')).toBeNull();
  await pressLast('처음으로');
  await waitFor(() => screen.getByText('가족에게 받은 번호를 써 주세요'));
});

test('N-01: 계정 지우기 뒤로는 ds BackLink(목적지 \'설정으로\', 알약) — 누르면 설정으로', async () => {
  await openParentDelete(createFakeApi({consented: true}));
  const back = screen.getByTestId('back-link');
  expect(back.props.accessibilityLabel).toBe('설정으로');
  await act(async () => {
    fireEvent.press(back);
  });
  await waitFor(() => screen.getByTestId('settings-row-delete'));
});

test('#198 리뷰 M: 지우는 중에는 뒤로 링크·안 지울래요·하드웨어 뒤로가 모두 화면을 떠나지 않는다(떠나도 요청은 돌아 계정이 지워짐)', async () => {
  const {BackHandler} = require('react-native');
  const handlers: (() => boolean)[] = [];
  const add = BackHandler.addEventListener;
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation(((type: string, h: () => boolean) => {
    handlers.push(h);
    return add.call(BackHandler, type, h);
  }) as never);
  const api = createFakeApi({deleteScope: 'child'});
  const del = jest.spyOn(api, 'deleteMyAccount').mockImplementation(() => new Promise(() => {})); // 끝나지 않는 지우기
  await openChildDelete(api, '내 계정만 지워져요. 부모님의 고른 답과 기록은 남아요');
  await press('계정 지우기');
  await press('계정 지우기');
  await waitFor(() => expect(del).toHaveBeenCalledTimes(1));
  // #206 후속: 뒤로 링크는 '사용 안 함'으로 읽히고(비활성 모양), 진행은 위험 버튼 글자 '지우고 있어요'가 보여 준다
  expect(screen.getByTestId('back-link').props.accessibilityState).toMatchObject({disabled: true});
  expect(screen.getByText('지우고 있어요')).toBeTruthy();
  // 1) 뒤로 링크: 눌러도 그대로
  await act(async () => {
    fireEvent.press(screen.getByTestId('back-link'));
  });
  expect(screen.getByText('내 계정 지우기')).toBeTruthy();
  // 2) 안 지울래요: 비활성
  expect(screen.getByRole('button', {name: '안 지울래요'})).toBeDisabled();
  // 3) 하드웨어 뒤로: 이 화면이 삼킨다(true)
  let consumed = false;
  await act(async () => {
    consumed = handlers[handlers.length - 1]() === true; // 가장 나중에 건 것 = 지우기 화면(포커스)
  });
  expect(consumed).toBe(true);
  expect(screen.getByText('내 계정 지우기')).toBeTruthy();
});

test('#206 후속: 어르신도 지우는 중에는 뒤로 링크가 사용 안 함, 안 지울래요 비활성, 진행 글자 \'지우고 있어요\'', async () => {
  const api = createFakeApi({consented: true});
  jest.spyOn(api, 'deleteMyAccount').mockImplementation(() => new Promise(() => {}));
  await openParentDelete(api);
  expect(screen.getByTestId('back-link').props.accessibilityState).toMatchObject({disabled: false}); // 지우기 전에는 누를 수 있다
  await confirmDeleteAll();
  await waitFor(() => expect(screen.getByTestId('back-link').props.accessibilityState).toMatchObject({disabled: true}));
  expect(screen.getByRole('button', {name: '안 지울래요'})).toBeDisabled();
  expect(screen.getByText('지우고 있어요')).toBeTruthy();
});

describe('#208 리뷰 H1: 지우기 요청에 시간 제한(30초) — 연결이 반쯤 끊겨도 화면에 갇히지 않는다', () => {
  afterEach(() => {
    jest.useRealTimers();
  });
  const expectRestored = () => {
    // M1: 실패 뒤 뒤로 링크·안 지울래요·버튼 글자가 원래대로
    expect(screen.getByTestId('delete-fail')).toBeTruthy();
    expect(screen.getByTestId('back-link').props.accessibilityState).toMatchObject({disabled: false});
    expect(screen.getByRole('button', {name: '안 지울래요'})).not.toBeDisabled();
    expect(screen.queryByText('지우고 있어요')).toBeNull();
    expect(screen.getByRole('button', {name: '다시 하기'})).not.toBeDisabled();
  };
  test('자녀: 응답이 오지 않으면 30초 뒤 끊김으로 보고 다시 하기', async () => {
    const api = createFakeApi({deleteScope: 'child'});
    jest.spyOn(api, 'deleteMyAccount').mockImplementation(() => new Promise(() => {}));
    await openChildDelete(api, '내 계정만 지워져요. 부모님의 고른 답과 기록은 남아요');
    const say = jest.spyOn(require('react-native').AccessibilityInfo, 'announceForAccessibility');
    say.mockClear();
    jest.useFakeTimers();
    await press('계정 지우기');
    await press('계정 지우기');
    expect(screen.getByText('지우고 있어요')).toBeTruthy();
    expect(say.mock.calls.filter(c => c[0] === '지우고 있어요')).toHaveLength(1); // #208 리뷰 L: 화면 읽기에도 한 번
    await act(async () => {
      jest.advanceTimersByTime(29000);
    });
    expect(screen.getByText('지우고 있어요')).toBeTruthy(); // 30초 전에는 그대로
    await act(async () => {
      jest.advanceTimersByTime(1500);
    });
    expectRestored();
  });
  test('#208 재확인 M·H: 시간 초과 뒤 늦게 지워지고 로그아웃까지 됐다면 다시 하기의 no_profile 은 \'못 지웠다\'가 아니다 — 어르신은 done_unsure(지웠어요 + 남았으면 문의)', async () => {
    const {ServerError} = require('../src/features/types');
    const api = createFakeApi({consented: true});
    jest
      .spyOn(api, 'deleteMyAccount')
      .mockImplementationOnce(() => new Promise(() => {}))
      .mockRejectedValueOnce(new ServerError('delete_my_account', 'no_profile', 'P0001'));
    await openParentDelete(api);
    jest.useFakeTimers();
    await confirmDeleteAll();
    await act(async () => {
      jest.advanceTimersByTime(30500);
    });
    jest.useRealTimers();
    await press('다시 하기');
    await waitFor(() => screen.getByText(copy.delete.parent.done_unsure.body));
    expect(screen.queryByText('이 휴대폰에서는 지울 수 없어요')).toBeNull();
    expect(screen.queryByText('모두 지웠어요')).toBeNull(); // 단정하지 않는다
  });
  test('#208 재확인 H ③: 시간 초과 뒤 원래 요청이 늦게 성공하면(다시 하기 전) 결과 화면으로 넘어간다', async () => {
    const api = createFakeApi({consented: true});
    let finish: (v: {scope: 'parent'}) => void = () => {};
    jest.spyOn(api, 'deleteMyAccount').mockImplementationOnce(() => new Promise(r => (finish = r as never)));
    await openParentDelete(api);
    jest.useFakeTimers();
    await confirmDeleteAll();
    await act(async () => {
      jest.advanceTimersByTime(30500);
    });
    expect(screen.getByTestId('delete-fail')).toBeTruthy();
    jest.useRealTimers();
    await act(async () => {
      finish({scope: 'parent'});
    });
    await waitFor(() => screen.getByText('모두 지웠어요'));
  });
  test('#208 재확인 M: 자녀도 같은 경우 \'로그인이 풀려 지워지지 않았어요\'가 아니라 지운 뒤 화면', async () => {
    const {ServerError} = require('../src/features/types');
    const api = createFakeApi({deleteScope: 'child'});
    jest
      .spyOn(api, 'deleteMyAccount')
      .mockImplementationOnce(() => new Promise(() => {}))
      .mockRejectedValueOnce(new ServerError('delete_my_account', 'no_profile', 'P0001'));
    await openChildDelete(api, '내 계정만 지워져요. 부모님의 고른 답과 기록은 남아요');
    jest.useFakeTimers();
    await press('계정 지우기');
    await press('계정 지우기');
    await act(async () => {
      jest.advanceTimersByTime(30500);
    });
    jest.useRealTimers();
    await press('다시 하기');
    await waitFor(() => screen.getByText('내 계정이 지워졌어요'));
    expect(screen.queryByText('로그인이 풀려 지워지지 않았어요')).toBeNull();
  });
  test('어르신: 응답이 오지 않으면 30초 뒤 끊김으로 보고 다시 하기 → 다시 하기 결과 none 은 #156 분기(조회 parent + 끊김 = 모두 지웠어요)', async () => {
    const api = createFakeApi({consented: true});
    jest.spyOn(api, 'deleteMyAccount').mockImplementationOnce(() => new Promise(() => {})).mockResolvedValueOnce({scope: 'none'});
    await openParentDelete(api);
    jest.useFakeTimers();
    await confirmDeleteAll();
    expect(screen.getByText('지우고 있어요')).toBeTruthy();
    await act(async () => {
      jest.advanceTimersByTime(30500);
    });
    expectRestored();
    jest.useRealTimers();
    await press('다시 하기');
    await waitFor(() => screen.getByText('모두 지웠어요'));
  });
});

test('어르신: 그만둘래요를 누르면 지우지 않는다', async () => {
  const api = createFakeApi({consented: true});
  const del = jest.spyOn(api, 'deleteMyAccount');
  await openParentDelete(api);
  await press('안 지울래요');
  await waitFor(() => screen.getAllByRole('button', {name: '오늘 코스로'}));
  expect(del).not.toHaveBeenCalled();
});

test('삭제 실패는 지워지지 않았음을 알리고 다시 할 수 있다', async () => {
  const api = createFakeApi({consented: true, failDelete: 1});
  await openParentDelete(api);
  await confirmDeleteAll(); // P9 → 2단계 확인 상자
  await waitFor(() => screen.getByText('지우는 중에 문제가 생겼어요'));
  expect(screen.queryByText('모두 지웠어요')).toBeNull();
  await press('다시 하기');
  await waitFor(() => screen.getByText('모두 지웠어요'));
});

test('어르신 삭제 화면의 버튼은 64 이상, 글자는 20 이상', async () => {
  await openParentDelete(createFakeApi({consented: true}));
  for (const b of screen.getAllByRole('button')) {
    const s = StyleSheet.flatten(b.props.style);
    if (s?.minHeight !== undefined) {
      expect(s.minHeight).toBeGreaterThanOrEqual(64);
    }
  }
  const t = StyleSheet.flatten(screen.getByText('모두 지울까요?').props.style);
  expect(t.fontSize).toBeGreaterThanOrEqual(20);
});

async function openChildDelete(api: ReturnType<typeof createFakeApi>, expectText = '부모님의 기록도 함께 지워져요') {
  render(<AppRoot api={api} role="child" />);
  await waitFor(() => screen.getByRole('button', {name: '설정'}));
  await press('설정'); // C7 v2: 내 계정 지우기는 설정에
  await press('내 계정 지우기');
  await waitFor(() => screen.getByText(expectText));
}

test('자녀: 항상 가장 강한 경고, 확인 입력 후에만 삭제, 결과로 범위를 알린다', async () => {
  const api = createFakeApi({deleteScope: 'family'});
  const del = jest.spyOn(api, 'deleteMyAccount');
  await openChildDelete(api);
  expect(screen.getByText('되돌릴 수 없어요')).toBeTruthy();
  await press('계정 지우기');
  expect(del).not.toHaveBeenCalled();
  const confirm = screen.getByRole('button', {name: '계정 지우기'});
  expect(confirm).toBeDisabled();
  fireEvent.changeText(screen.getByLabelText('아래 칸에 지우기 두 글자를 써 주세요'), '지우기');
  await press('계정 지우기');
  expect(del).toHaveBeenCalledTimes(1);
  await waitFor(() => screen.getByText('계정과 부모님의 기록이 모두 지워졌어요'));
});

test('자녀: 내 계정만 삭제된 경우 결과 문구', async () => {
  const api = createFakeApi({deleteScope: 'child'});
  await openChildDelete(api, '내 계정만 지워져요. 부모님의 고른 답과 기록은 남아요');
  expect(screen.queryByText('부모님의 기록도 함께 지워져요')).toBeNull();
  expect(screen.getByText('되돌릴 수 없어요')).toBeTruthy(); // #197: 본문에서 뺀 경고는 빨간 머리글(warn_label)이 한 번 맡는다
  await press('계정 지우기');
  await press('계정 지우기');
  await waitFor(() => screen.getByText('내 계정이 지워졌어요'));
});

test('0049: 가족과 연결하기 전 자녀 계정(scope none)은 호칭 기록 안내 대신 로그인·약관 동의 기록만 지워진다고 알린다', async () => {
  const api = createFakeApi({deleteScope: 'none'});
  await openChildDelete(api, '가족과 연결하기 전이라 지울 가족 기록은 없어요. 로그인 정보, 약관 동의 기록, 알림 받기 정보가 지워져요');
  expect(screen.queryByText(/기록은 남아요/)).toBeNull(); // 틀린 안내 없음
  expect(screen.queryByText(/함께 지워져요/)).toBeNull();
  expect(screen.getByText('되돌릴 수 없어요')).toBeTruthy(); // #197: 가족 연결 전에도 빨간 머리글은 그려진다
  await press('계정 지우기');
  await press('계정 지우기'); // 마지막 자녀용 '지우기' 입력 없이
  await waitFor(() => screen.getByText('내 계정이 지워졌어요'));
});

test('PR1 리뷰 M2: scope none 이면 호칭(가족 요약)을 묻지 않는다, 가족이 있으면 묻는다', async () => {
  const none = createFakeApi({deleteScope: 'none'});
  const sumNone = jest.spyOn(none, 'fetchChildSummary');
  await openChildDelete(none, '가족과 연결하기 전이라 지울 가족 기록은 없어요. 로그인 정보, 약관 동의 기록, 알림 받기 정보가 지워져요');
  const before = sumNone.mock.calls.length; // 설정·홈이 부른 것
  await act(async () => {});
  expect(sumNone.mock.calls.length).toBe(before);
  screen.unmount();
  const fam = createFakeApi({deleteScope: 'child'});
  const sumFam = jest.spyOn(fam, 'fetchChildSummary');
  await openChildDelete(fam, '내 계정만 지워져요. 부모님의 고른 답과 기록은 남아요');
  expect(sumFam).toHaveBeenCalled();
});

test('realApi: 삭제 RPC 성공 후 로그아웃한다', async () => {
  const signOut = jest.fn().mockResolvedValue({error: null});
  const rpc = jest.fn().mockResolvedValue({data: {scope: 'parent'}, error: null});
  const api = createRealApi({rpc, auth: {signOut}} as never);
  await expect(api.deleteMyAccount()).resolves.toEqual({scope: 'parent'});
  expect(rpc).toHaveBeenCalledWith('delete_my_account');
  expect(signOut).toHaveBeenCalled();
});

test('realApi: 삭제 RPC 실패면 로그아웃하지 않는다', async () => {
  const signOut = jest.fn();
  const rpc = jest.fn().mockResolvedValue({data: null, error: {message: 'Failed to fetch'}});
  const api = createRealApi({rpc, auth: {signOut}} as never);
  await expect(api.deleteMyAccount()).rejects.toBeInstanceOf(OfflineError);
  expect(signOut).not.toHaveBeenCalled();
});

test('자녀: 사전 조회가 실패하면 가장 강한 경고로 대체한다', async () => {
  await openChildDelete(createFakeApi({failPreview: true, deleteScope: 'child'}));
  await press('계정 지우기');
  expect(screen.getByRole('button', {name: '계정 지우기'})).toBeDisabled();
});

test('리뷰 M4 후속: 계정 삭제도 지우기 전에 계정 가명값을 받아 두고, 지운 뒤 그 계정의 기기 기억값을 정리', async () => {
  const accountStore = require('../src/lib/accountStore');
  const clear = jest.spyOn(accountStore, 'clearAccountKeys');
  const api = createFakeApi({consented: true, accountTag: 'acc-del'});
  const order: string[] = [];
  jest.spyOn(api, 'accountTag').mockImplementation(async () => {
    order.push('tag');
    return 'acc-del';
  });
  const del = api.deleteMyAccount.bind(api);
  jest.spyOn(api, 'deleteMyAccount').mockImplementation(async () => {
    order.push('delete');
    return del();
  });
  await openParentDelete(api);
  order.length = 0; // 앱 시작 때의 다른 가명값 읽기(푸시 N1 기억 확인, AU-04)는 세지 않는다 — 지우기 누른 뒤 순서만
  await confirmDeleteAll(); // P9 → 2단계 확인 상자
  await waitFor(() => expect(clear).toHaveBeenCalledWith(expect.anything(), 'acc-del'));
  expect(order.slice(0, 2)).toEqual(['tag', 'delete']); // 지운 뒤 새 시작의 읽기는 상관없음
  clear.mockRestore();
});

test('재검토 R2: 삭제(또는 그 뒤 로그아웃)가 실패해도 계정별 기억값 정리는 실행', async () => {
  const accountStore = require('../src/lib/accountStore');
  const clear = jest.spyOn(accountStore, 'clearAccountKeys');
  const api = createFakeApi({consented: true, accountTag: 'acc-del2'});
  jest.spyOn(api, 'deleteMyAccount').mockRejectedValue(new Error('signOut failed'));
  await openParentDelete(api);
  await confirmDeleteAll(); // P9 → 2단계 확인 상자
  await waitFor(() => expect(clear).toHaveBeenCalledWith(expect.anything(), 'acc-del2'));
  clear.mockRestore();
});

test('감사 H1 회귀: P9 모두 지우기를 한 번 누르면 지우지 않고 "정말 모두 지울까요? / 되돌릴 수 없어요" 상자, 그만둘래요면 그대로', async () => {
  const api = createFakeApi({consented: true});
  const del = jest.spyOn(api, 'deleteMyAccount');
  await openParentDelete(api);
  expect(screen.queryByText(/되돌릴 수 없어요/)).toBeNull(); // 1단계에는 없음(마지막 상자에서 한 번만)
  await press('모두 지우기');
  const box = await waitFor(() => screen.getByTestId('delete-confirm2'));
  expect(within(box).getByText('정말 모두 지울까요?')).toBeTruthy();
  expect(within(box).getByText('되돌릴 수 없어요')).toBeTruthy();
  expect(del).not.toHaveBeenCalled();
  await act(async () => {
    fireEvent.press(within(box).getByRole('button', {name: '안 지울래요'}));
  });
  await waitFor(() => expect(screen.queryByTestId('delete-confirm2')).toBeNull());
  expect(del).not.toHaveBeenCalled();
  expect(screen.getByText('모두 지울까요?')).toBeTruthy();
});

describe('v4 계정 지우기(ui/ds, 리드 결정 11-20)', () => {
  const dockButtons = () => {
    const {within: w} = require('@testing-library/react-native');
    return w(screen.getByTestId('screen-dock')).getAllByRole('button');
  };
  test('어르신 P9: Dock 주 = 안 지울래요(#134 닫기 말), 보조 = 위험 외곽선 모두 지우기 — 안전한 쪽이 먼저', async () => {
    await openParentDelete(createFakeApi({consented: true}));
    const [first, second] = dockButtons();
    expect(within(first).getByText('안 지울래요')).toBeTruthy();
    expect(within(second).getByText('모두 지우기')).toBeTruthy();
    const st = StyleSheet.flatten(typeof second.props.style === 'function' ? second.props.style({pressed: false}) : second.props.style);
    expect(st).toMatchObject({borderColor: '#991B1B', borderWidth: 3});
    expect(screen.getByRole('header', {name: '모두 지울까요?'})).toBeTruthy();
  });
  test('실패 상자: 위험 면 + 머리글 문구(색만으로 알리지 않음), 보조가 다시 하기로', async () => {
    await openParentDelete(createFakeApi({consented: true, failDelete: 1}));
    await confirmDeleteAll();
    const box = await waitFor(() => screen.getByTestId('delete-fail'));
    expect(StyleSheet.flatten(box.props.style)).toMatchObject({backgroundColor: '#FEE2E2', borderColor: '#991B1B'});
    expect(within(dockButtons()[1]).getByText('다시 하기')).toBeTruthy();
  });
});

describe('#146 리뷰 H1: no_profile 은 지우지 못한 것(로그인 정보 없음, 0049)', () => {
  test('끊김(응답만 실패) → 다시 하기 → 서버가 {scope:none} 성공 → 지운 뒤 화면은 서버 scope 문구', async () => {
    const api = createFakeApi({consented: true});
    const real = api.deleteMyAccount.bind(api);
    jest
      .spyOn(api, 'deleteMyAccount')
      .mockRejectedValueOnce(new OfflineError('응답 끊김'))
      .mockImplementationOnce(async () => {
        await real().catch(() => {});
        return {scope: 'none'};
      });
    await openParentDelete(api);
    await confirmDeleteAll();
    await waitFor(() => screen.getByTestId('delete-fail'));
    await press('다시 하기');
    await waitFor(() => screen.getByText('모두 지웠어요'));
  });
  test('#153 어르신 no_profile: 지웠다고 하지 않고 "이 휴대폰에서는 지울 수 없어요" + 문의하기(메일), 세션·화면은 그대로', async () => {
    mockMail = 'help@example.test';
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined as never);
    const {ServerError} = require('../src/features/types');
    const api = createFakeApi({consented: true});
    jest.spyOn(api, 'deleteMyAccount').mockRejectedValue(new ServerError('delete_my_account', 'no_profile', 'P0001'));
    await openParentDelete(api);
    await confirmDeleteAll();
    await waitFor(() => screen.getByText('이 휴대폰에서는 지울 수 없어요'));
    expect(screen.getByText('문의하기로 알려 주시면 가족 확인 뒤 지워 드려요. 가족이 대신 문의해도 돼요')).toBeTruthy();
    expect(screen.queryByText('모두 지웠어요')).toBeNull();
    expect(screen.queryByText(/로그인/)).toBeNull(); // 어르신 화면 낱말이 아니다(writer 1-2)
    expect(screen.queryByRole('button', {name: '다시 로그인하기'})).toBeNull();
    await act(async () => {
      fireEvent.press(screen.getByRole('button', {name: '문의하기'}));
    });
    expect(open).toHaveBeenCalledWith(MAILTO);
    // 번호 입력으로 보내지 않는다(새 익명 계정이 생기면 안 됨) — 계정 지우기 화면 그대로
    expect(screen.queryByText('가족에게 받은 번호를 써 주세요')).toBeNull();
    expect(screen.getByText('이 휴대폰에서는 지울 수 없어요')).toBeTruthy();
    open.mockRestore();
  });
  test('#153 어르신 no_profile + 문의 주소 없음: 문의하기 버튼 없이 "준비하고 있어요" 한 줄', async () => {
    const {ServerError} = require('../src/features/types');
    const api = createFakeApi({consented: true});
    jest.spyOn(api, 'deleteMyAccount').mockRejectedValue(new ServerError('delete_my_account', 'no_profile', 'P0001'));
    await openParentDelete(api);
    await confirmDeleteAll();
    await waitFor(() => screen.getByText('이 휴대폰에서는 지울 수 없어요'));
    expect(screen.getByTestId('delete-contact-pending')).toBeTruthy();
    expect(screen.getByText('문의 메일 주소를 준비하고 있어요')).toBeTruthy();
    expect(screen.queryByRole('button', {name: '문의하기'})).toBeNull();
    expect(screen.queryByRole('button', {name: '다시 로그인하기'})).toBeNull();
  });
  test('자녀 no_profile: "로그인이 풀려 지워지지 않았어요" + 다시 로그인하기(로그인 화면으로)', async () => {
    const {ServerError} = require('../src/features/types');
    const api = createFakeApi({deleteScope: 'child'});
    jest.spyOn(api, 'deleteMyAccount').mockRejectedValue(new ServerError('delete_my_account', 'no_profile', 'P0001'));
    await openChildDelete(api, '내 계정만 지워져요. 부모님의 고른 답과 기록은 남아요');
    await press('계정 지우기');
    await press('계정 지우기');
    await waitFor(() => screen.getByText('로그인이 풀려 지워지지 않았어요'));
    expect(screen.getByText('다시 로그인한 뒤 해 주세요')).toBeTruthy();
    await press('다시 로그인하기');
    await waitFor(() => screen.getByText('로그인하고 시작해요'));
  });
});

describe('법률 확인 11-20: 어르신 scope none(다시 설치한 새 익명 계정만 지워짐)', () => {
  const noneApi = () => {
    const api = createFakeApi({consented: true});
    jest.spyOn(api, 'deleteMyAccount').mockResolvedValue({scope: 'none'});
    return api;
  };
  test('"모두 지웠어요" 대신 사실 문구 + 문의하기(메일)', async () => {
    mockMail = 'help@example.test';
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined as never);
    await openParentDelete(noneApi());
    await confirmDeleteAll();
    await waitFor(() => screen.getByText('이 휴대폰의 정보를 지웠어요'));
    expect(screen.queryByText('모두 지웠어요')).toBeNull();
    expect(screen.getByText(copy.delete.parent.done_none.body)).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByRole('button', {name: '문의하기'}));
    });
    expect(open).toHaveBeenCalledWith(MAILTO);
    open.mockRestore();
    await pressLast('처음으로');
    await waitFor(() => screen.getByText('가족에게 받은 번호를 써 주세요'));
  });
  test('문의 주소가 없으면 버튼 없이 "준비하고 있어요" 한 줄', async () => {
    await openParentDelete(noneApi());
    await confirmDeleteAll();
    await waitFor(() => screen.getByText('이 휴대폰의 정보를 지웠어요'));
    expect(screen.getByTestId('delete-done-contact-pending')).toBeTruthy();
    expect(screen.queryByRole('button', {name: '문의하기'})).toBeNull();
  });
  test('#156 리뷰 H(재현 고정): 사전 조회 실패 + 첫 시도 끊김 + 다시 하기 none → done_unsure(단정하지 않음) + 문의하기', async () => {
    mockMail = 'help@example.test';
    const api = createFakeApi({consented: true, failPreview: true});
    const preview = jest.spyOn(api, 'deleteScopePreview');
    jest.spyOn(api, 'deleteMyAccount').mockRejectedValueOnce(new OfflineError('응답 끊김')).mockResolvedValueOnce({scope: 'none'});
    await openParentDelete(api);
    await confirmDeleteAll();
    await waitFor(() => screen.getByTestId('delete-fail'));
    await press('다시 하기');
    await waitFor(() => screen.getByText(copy.delete.parent.done_unsure.body));
    expect(screen.getByText(copy.delete.parent.done_unsure.title)).toBeTruthy();
    expect(screen.queryByText('모두 지웠어요')).toBeNull();
    expect(screen.queryByText(copy.delete.parent.done_none.body)).toBeNull(); // '가족과 나눈 기록은 없었어요'도 단정하지 않는다
    expect(screen.getByRole('button', {name: '문의하기'})).toBeTruthy();
    expect(preview).toHaveBeenCalledTimes(2); // 처음 + 첫 시도 전 다시 묻기(끊긴 뒤에는 묻지 않음)
  });
  test('#156 리뷰 H: 사전 조회가 처음엔 실패해도 지우기 전에 다시 물어 parent 를 알면, 끊김 뒤 none 은 "모두 지웠어요"(#146 H1)', async () => {
    const api = createFakeApi({consented: true});
    const real = api.deleteScopePreview.bind(api);
    jest.spyOn(api, 'deleteScopePreview').mockRejectedValueOnce(new OfflineError('x')).mockImplementation(real);
    jest.spyOn(api, 'deleteMyAccount').mockRejectedValueOnce(new OfflineError('응답 끊김')).mockResolvedValueOnce({scope: 'none'});
    await openParentDelete(api);
    await confirmDeleteAll();
    await waitFor(() => screen.getByTestId('delete-fail'));
    await press('다시 하기');
    await waitFor(() => screen.getByText('모두 지웠어요'));
  });
  test('#156 재확인 M: 조회 두 번 실패 → 첫 시도가 서버에서 지우고 응답만 끊김 → 다시 하기 때는 다시 묻지 않고 done_unsure(\'가족 기록 없었음\'을 말하지 않음)', async () => {
    const api = createFakeApi({consented: true});
    const preview = jest
      .spyOn(api, 'deleteScopePreview')
      .mockRejectedValueOnce(new OfflineError('x'))
      .mockRejectedValueOnce(new OfflineError('x'))
      .mockResolvedValue({scope: 'none'}); // 이미 지워진 뒤라면 none 이 온다
    jest.spyOn(api, 'deleteMyAccount').mockRejectedValueOnce(new OfflineError('응답 끊김')).mockResolvedValueOnce({scope: 'none'});
    await openParentDelete(api);
    await confirmDeleteAll();
    await waitFor(() => screen.getByTestId('delete-fail'));
    await press('다시 하기');
    await waitFor(() => screen.getByText(copy.delete.parent.done_unsure.body));
    expect(screen.queryByText(copy.delete.parent.done_none.body)).toBeNull();
    expect(screen.queryByText('모두 지웠어요')).toBeNull();
    expect(preview).toHaveBeenCalledTimes(2); // 처음 + 첫 시도 전. 끊긴 뒤에는 묻지 않음
  });
  test('사전 조회를 몰라도 앞선 끊김이 없으면 결과 none 은 이 계정에 가족 기록이 없었다는 뜻 → done_none', async () => {
    const api = createFakeApi({consented: true, failPreview: true});
    jest.spyOn(api, 'deleteMyAccount').mockResolvedValue({scope: 'none'});
    await openParentDelete(api);
    await confirmDeleteAll();
    await waitFor(() => screen.getByText(copy.delete.parent.done_none.body));
  });
  test('어르신 scope parent 는 그대로 "모두 지웠어요"(문의 줄 없음)', async () => {
    mockMail = 'help@example.test';
    await openParentDelete(createFakeApi({consented: true}));
    await confirmDeleteAll();
    await waitFor(() => screen.getByText('모두 지웠어요'));
    expect(screen.queryByRole('button', {name: '문의하기'})).toBeNull();
  });
});
