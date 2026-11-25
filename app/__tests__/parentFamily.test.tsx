// P16 연결된 가족(시안 parent/P16_family, 문구 copy-v3 11-8, 서버 0030 parent_family_list)
import React from 'react';
import {render, screen, waitFor, within} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi} from '../src/features/fakeApi';
import {createRealApi} from '../src/features/realApi';
import {parseParentFamily} from '../src/api/contract/family';
import {press, toHome, toHomeConsented} from '../testUtils/flow';
import {setupWarmAppRoot} from '../testUtils/warm';

// 첫 테스트만 콜드 스타트(첫 로드·첫 렌더)를 떠안지 않게 파일 시작 때 한 번 예열(#245 M2, testUtils/warm)
setupWarmAppRoot();

async function openFamily(api: ReturnType<typeof createFakeApi>) {
  await toHomeConsented(api);
  await press('설정');
  await press('연결된 가족');
  await waitFor(() => screen.getByRole('header', {name: '연결된 가족'}));
}

test('계약 검증: 순번·연결 시각·날짜만, 계약 밖이면 null', () => {
  expect(parseParentFamily({title: '엄마', family: [{seq: 1, connected_at: '2026-11-12T01:00:00Z', connected_date: '2026-11-12'}]})).toEqual({
    title: '엄마',
    family: [{seq: 1, connectedAt: '2026-11-12T01:00:00Z', connectedDate: '2026-11-12'}],
  });
  expect(parseParentFamily({title: null, family: []})).toEqual({title: null, family: []});
  expect(parseParentFamily({title: '사장님', family: []})).toBeNull();
  expect(parseParentFamily({title: '엄마', family: [{seq: 1}]})).toBeNull();
  expect(parseParentFamily(null)).toBeNull();
});

test('realApi: parent_family_list 를 부르고 검증해서 돌려준다', async () => {
  const rpc = jest.fn(() => Promise.resolve({data: {title: '아빠', family: [{seq: 1, connected_at: 'x', connected_date: '2026-11-15'}]}, error: null}));
  const api = createRealApi({rpc} as never);
  expect(await api.parentFamilyList()).toEqual({title: '아빠', family: [{seq: 1, connectedAt: 'x', connectedDate: '2026-11-15'}]});
  expect(rpc).toHaveBeenCalledWith('parent_family_list');
});

test('가족 2명: 인원 요약·행마다 "가족 휴대폰 / {월}월 {일}일에 연결했어요"·더하기 안내·그만두기 행(자녀 이름 없음)', async () => {
  await openFamily(createFakeApi({consented: true, familyDates: ['2026-11-12', '2026-11-15']}));
  expect(screen.getByText('가족 2명과 연결돼 있어요')).toBeTruthy();
  expect(screen.getByLabelText('가족 휴대폰, 11월 12일에 연결했어요')).toBeTruthy();
  expect(screen.getByLabelText('가족 휴대폰, 11월 15일에 연결했어요')).toBeTruthy();
  expect(screen.getByText('다른 가족에게도 번호를 받아 쓰면 연결돼요')).toBeTruthy();
  expect(screen.getByRole('button', {name: '그만두기, 답 보여 주기만 그만두거나, 모두 지울 수 있어요'})).toBeTruthy();
});

test('그만두기 시트: 그만 보여 주기는 확인 없이 바로 실행 + 되돌리는 길 안내, 연결은 그대로', async () => {
  const api = createFakeApi({consented: true, familyDates: ['2026-11-12']});
  const withdraw = jest.spyOn(api, 'withdrawConsent');
  await openFamily(api);
  await press('그만두기, 답 보여 주기만 그만두거나, 모두 지울 수 있어요');
  const sheet = screen.getByTestId('family-stop-sheet');
  expect(within(sheet).getByText('무엇을 할까요?')).toBeTruthy();
  expect(within(sheet).getByText('둘 중 하나를 골라 주세요')).toBeTruthy();
  expect(within(sheet).getAllByRole('button', {name: '닫기'})).toHaveLength(2); // 아래 안전한 쪽(밑줄 링크) + 위 X, 둘 다 상태를 바꾸지 않으므로 '닫기'(A5)
  await press('그만 보여 주기, 지난 답은 지워져요. 연결은 그대로예요');
  expect(withdraw).toHaveBeenCalledTimes(1);
  await waitFor(() => screen.getByText('이제 고르신 답은 가족에게 안 보여요. 설정에서 다시 보여 줄 수 있어요'));
  expect(screen.queryByTestId('family-stop-sheet')).toBeNull();
  expect(screen.getByText('가족 1명과 연결돼 있어요')).toBeTruthy(); // 연결은 그대로
});

test('그만두기 시트: 모두 지우기는 P9 두 단계 확인으로 이어진다(여기서 지우지 않음)', async () => {
  const api = createFakeApi({consented: true, familyDates: ['2026-11-12']});
  const del = jest.spyOn(api, 'deleteMyAccount');
  await openFamily(api);
  await press('그만두기, 답 보여 주기만 그만두거나, 모두 지울 수 있어요');
  await press('모두 지우기, 고르신 답과 도장이 지워지고 연결도 끊겨요');
  await waitFor(() => screen.getByText('모두 지울까요?'));
  expect(del).not.toHaveBeenCalled();
});

test('이미 보여 주지 않는 중이면 시트에 그만 보여 주기 갈래가 없다', async () => {
  const api = createFakeApi({familyDates: ['2026-11-12']});
  await toHome(api, false);
  await press('설정');
  await press('연결된 가족');
  await waitFor(() => screen.getByRole('header', {name: '연결된 가족'}));
  await press('그만두기, 답 보여 주기만 그만두거나, 모두 지울 수 있어요');
  expect(screen.queryByRole('button', {name: /그만 보여 주기/})).toBeNull();
  expect(screen.getByText('지금은 가족에게 답을 보여 주지 않는 중이에요')).toBeTruthy(); // N4 갈래 하나일 때 안내
  expect(screen.queryByText('둘 중 하나를 골라 주세요')).toBeNull();
  expect(screen.getByRole('button', {name: /모두 지우기/})).toBeTruthy();
});

test('빈 상태(가족 0명): 언제 보이는지 + 번호 쓰기 → P1', async () => {
  await openFamily(createFakeApi({consented: true, familyDates: []}));
  expect(screen.getByText('번호를 받으면 여기에 가족이 보여요')).toBeTruthy();
  expect(screen.getByText('가족에게 받은 번호를 써 주세요')).toBeTruthy();
  await press('번호 쓰기');
  await waitFor(() => screen.getByText('가족에게 받은 번호를 써 주세요'));
  expect(screen.getByLabelText('연결 번호 6자리 쓰는 칸')).toBeTruthy();
});

test('불러오기 실패는 오류와 다시 하기', async () => {
  const api = createFakeApi({consented: true, familyDates: ['2026-11-12']});
  jest.spyOn(api, 'parentFamilyList').mockRejectedValueOnce(new (require('../src/features/types').OfflineError)('x'));
  await toHomeConsented(api);
  await press('설정');
  await press('연결된 가족');
  await waitFor(() => screen.getByText('인터넷이 잠깐 끊겼어요'));
  await press('다시 하기');
  await waitFor(() => screen.getByText('가족 1명과 연결돼 있어요'));
});

test('설정 화면에 연결된 가족 행이 있다(연결된 기기만)', async () => {
  await toHomeConsented(createFakeApi({consented: true}));
  await press('설정');
  expect(screen.getByRole('button', {name: '연결된 가족'})).toBeTruthy();
});

test('자녀 앱에는 P16 이 없다', () => {
  render(<AppRoot api={createFakeApi()} role="child" />);
  expect(screen.queryByText('연결된 가족')).toBeNull();
});
