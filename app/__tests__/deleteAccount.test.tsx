import React from 'react';
import {StyleSheet} from 'react-native';
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi} from '../src/features/fakeApi';
import {createRealApi} from '../src/features/realApi';
import {OfflineError} from '../src/features/types';
import {press, toHomeConsented} from '../testUtils/flow';

async function openParentDelete(api: ReturnType<typeof createFakeApi>) {
  await toHomeConsented(api);
  await press('설정');
  await press('데이터 지우기');
  await waitFor(() => screen.getByText('지금까지 고른 답과 기록이 지워져요'));
}

test('어르신: 첫 확인만으로는 삭제하지 않고 두 번째 확인에서 지운다', async () => {
  const api = createFakeApi({consented: true});
  const del = jest.spyOn(api, 'deleteMyAccount');
  await openParentDelete(api);
  await press('지우기');
  expect(del).not.toHaveBeenCalled();
  await waitFor(() => screen.getByText('정말 지울까요?'));
  await press('네, 지울게요');
  expect(del).toHaveBeenCalledTimes(1);
  await waitFor(() => screen.getByText('내 기록이 지워졌어요'));
  // 스택 초기화: 이전 화면이 남아 있지 않다
  expect(screen.queryByText('오늘의 코스')).toBeNull();
  await press('처음으로');
  await waitFor(() => screen.getByText('안녕하세요, 저는 해님이에요'));
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
  await press('지우기');
  await press('네, 지울게요');
  await waitFor(() => screen.getByText('아직 지워지지 않았어요'));
  expect(screen.queryByText('내 기록이 지워졌어요')).toBeNull();
  await press('다시 하기');
  await waitFor(() => screen.getByText('내 기록이 지워졌어요'));
});

test('어르신 삭제 화면의 버튼은 64 이상, 글자는 20 이상', async () => {
  await openParentDelete(createFakeApi({consented: true}));
  for (const b of screen.getAllByRole('button')) {
    const s = StyleSheet.flatten(b.props.style);
    if (s?.minHeight !== undefined) {
      expect(s.minHeight).toBeGreaterThanOrEqual(64);
    }
  }
  const t = StyleSheet.flatten(screen.getByText('지금까지 고른 답과 기록이 지워져요').props.style);
  expect(t.fontSize).toBeGreaterThanOrEqual(20);
});

async function openChildDelete(api: ReturnType<typeof createFakeApi>, expectText = '마지막 보호자라서 어르신의 기록까지 모두 지워져요') {
  render(<AppRoot api={api} role="child" />);
  await act(async () => {
    fireEvent.press(screen.getByText('리포트'));
  });
  await press('설정 데이터 지우기');
  await waitFor(() => screen.getByText(expectText));
}

test('자녀: 항상 가장 강한 경고, 확인 입력 후에만 삭제, 결과로 범위를 알린다', async () => {
  const api = createFakeApi({deleteScope: 'family'});
  const del = jest.spyOn(api, 'deleteMyAccount');
  await openChildDelete(api);
  expect(screen.getByText('되돌릴 수 없어요')).toBeTruthy();
  await press('삭제하기');
  expect(del).not.toHaveBeenCalled();
  const confirm = screen.getByRole('button', {name: '네, 삭제할게요'});
  expect(confirm).toBeDisabled();
  fireEvent.changeText(screen.getByLabelText('확인 글자 입력'), '삭제');
  await press('네, 삭제할게요');
  expect(del).toHaveBeenCalledTimes(1);
  await waitFor(() => screen.getByText('가족 전체가 삭제되었어요'));
});

test('자녀: 내 계정만 삭제된 경우 결과 문구', async () => {
  const api = createFakeApi({deleteScope: 'child'});
  await openChildDelete(api, '내 계정만 지워져요');
  expect(screen.queryByText('마지막 보호자라서 어르신의 기록까지 모두 지워져요')).toBeNull();
  await press('삭제하기');
  await press('네, 삭제할게요');
  await waitFor(() => screen.getByText('내 계정이 삭제되었어요'));
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
  await press('삭제하기');
  expect(screen.getByRole('button', {name: '네, 삭제할게요'})).toBeDisabled();
});
