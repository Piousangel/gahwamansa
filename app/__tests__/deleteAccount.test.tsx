import React from 'react';
import {StyleSheet} from 'react-native';
import {fireEvent, render, screen, waitFor} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi} from '../src/features/fakeApi';
import {createRealApi} from '../src/features/realApi';
import {OfflineError} from '../src/features/types';
import {press, toHomeConsented} from '../testUtils/flow';

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
  await press('모두 지우기');
  expect(del).toHaveBeenCalledTimes(1);
  await waitFor(() => screen.getByText('모두 지웠어요'));
  // 스택 초기화: 이전 화면이 남아 있지 않다
  expect(screen.queryByTestId('date-line')).toBeNull();
  await press('처음으로');
  await waitFor(() => screen.getByText('가족에게 받은 번호를 써 주세요'));
});

test('어르신: 그만둘래요를 누르면 지우지 않는다', async () => {
  const api = createFakeApi({consented: true});
  const del = jest.spyOn(api, 'deleteMyAccount');
  await openParentDelete(api);
  await press('그만둘래요');
  await waitFor(() => screen.getByRole('button', {name: '돌아가기'}));
  expect(del).not.toHaveBeenCalled();
});

test('삭제 실패는 지워지지 않았음을 알리고 다시 할 수 있다', async () => {
  const api = createFakeApi({consented: true, failDelete: 1});
  await openParentDelete(api);
  await press('모두 지우기');
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
  fireEvent.changeText(screen.getByLabelText('확인 글자 입력'), '지우기');
  await press('계정 지우기');
  expect(del).toHaveBeenCalledTimes(1);
  await waitFor(() => screen.getByText('계정과 부모님의 기록이 모두 지워졌어요'));
});

test('자녀: 내 계정만 삭제된 경우 결과 문구', async () => {
  const api = createFakeApi({deleteScope: 'child'});
  await openChildDelete(api, '내 계정만 지워져요. 부모님의 고른 답과 기록은 남아요. 되돌릴 수 없어요');
  expect(screen.queryByText('부모님의 기록도 함께 지워져요')).toBeNull();
  await press('계정 지우기');
  await press('계정 지우기');
  await waitFor(() => screen.getByText('내 계정이 지워졌어요'));
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
  await press('모두 지우기');
  await waitFor(() => expect(clear).toHaveBeenCalledWith(expect.anything(), 'acc-del'));
  expect(order).toEqual(['tag', 'delete']);
  clear.mockRestore();
});

test('재검토 R2: 삭제(또는 그 뒤 로그아웃)가 실패해도 계정별 기억값 정리는 실행', async () => {
  const accountStore = require('../src/lib/accountStore');
  const clear = jest.spyOn(accountStore, 'clearAccountKeys');
  const api = createFakeApi({consented: true, accountTag: 'acc-del2'});
  jest.spyOn(api, 'deleteMyAccount').mockRejectedValue(new Error('signOut failed'));
  await openParentDelete(api);
  await press('모두 지우기');
  await waitFor(() => expect(clear).toHaveBeenCalledWith(expect.anything(), 'acc-del2'));
  clear.mockRestore();
});
