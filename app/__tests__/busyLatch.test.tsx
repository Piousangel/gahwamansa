// AP-14 두 번 누름(리뷰 l2 M2): 위험·서버 호출 버튼은 `if (!beginBusy()) return;` 한 줄로 같은 틱 재진입을 막는다.
// 여기서는 l2Polish 에서 다루지 않은 곳(메일 보내기·동의·가족 만들기·새 폰 번호)과 훅 자체를 본다.
import React from 'react';
import {act, fireEvent, render, renderHook, screen, waitFor} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi} from '../src/features/fakeApi';
import {useBusyLatch} from '../src/ui/useBusyLatch';
import {enterCode, press} from '../testUtils/flow';
import {setupWarmAppRoot} from '../testUtils/warm';
import {renderChildScreen} from '../testUtils/childScreen';

// 첫 테스트만 콜드 스타트(첫 로드·첫 렌더)를 떠안지 않게 파일 시작 때 한 번 예열(#245 M2, testUtils/warm)
setupWarmAppRoot();

const twice = async (el: Parameters<typeof fireEvent.press>[0]) => {
  await act(async () => {
    fireEvent.press(el);
    fireEvent.press(el);
  });
};

test('useBusyLatch: 같은 틱 두 번째 begin 은 false, end 뒤에는 다시 true', () => {
  const {result} = renderHook(() => useBusyLatch());
  let a = false;
  let b = true;
  act(() => {
    a = result.current.begin();
    b = result.current.begin();
  });
  expect([a, b]).toEqual([true, false]);
  expect(result.current.busy).toBe(true);
  act(() => result.current.end());
  expect(result.current.busy).toBe(false);
  act(() => {
    a = result.current.begin();
  });
  expect(a).toBe(true);
});

test('메일 인증번호 받기를 두 번 빨리 눌러도 한 번만 보낸다(보낸 횟수 제한 보호)', async () => {
  const api = createFakeApi();
  const send = jest.spyOn(api, 'sendEmailCode');
  render(<AppRoot api={api} />);
  await press(/자녀 휴대폰이에요/);
  await press('이메일로 시작하기');
  await waitFor(() => screen.getByText('이메일로 시작해요'));
  fireEvent.changeText(screen.getByLabelText('이메일 주소'), 'kid@example.test');
  await twice(screen.getByRole('button', {name: '인증번호 받기'}));
  await waitFor(() => screen.getByText('메일로 받은 인증번호 6자리를 써 주세요'));
  expect(send).toHaveBeenCalledTimes(1);
});

test('동의 좋아요를 두 번 빨리 눌러도 한 번', async () => {
  const api = createFakeApi();
  const give = jest.spyOn(api, 'giveConsent');
  render(<AppRoot api={api} role="parent" />);
  await enterCode('123456');
  await waitFor(() => screen.getByText('고르신 답을 가족과 나눠요'));
  await twice(screen.getByRole('button', {name: '좋아요'}));
  await waitFor(() => screen.getByTestId('date-line'));
  expect(give).toHaveBeenCalledTimes(1);
});

test('가족 만들기(번호 만들기)를 두 번 빨리 눌러도 가족·번호는 한 번', async () => {
  const api = createFakeApi();
  const create = jest.spyOn(api, 'createFamily');
  const issue = jest.spyOn(api, 'issueInviteCode');
  render(<AppRoot api={api} />);
  await press(/자녀 휴대폰이에요/);
  await press('이메일로 시작하기');
  await waitFor(() => screen.getByText('이메일로 시작해요'));
  fireEvent.changeText(screen.getByLabelText('이메일 주소'), 'kid@example.test');
  await press('인증번호 받기');
  await waitFor(() => screen.getByText('메일로 받은 인증번호 6자리를 써 주세요'));
  fireEvent.changeText(screen.getByLabelText('인증번호 6자리'), '246810'); // fake 의 올바른 메일 인증번호
  await waitFor(() => screen.getByText('부모님을 어떻게 부르세요?'));
  await twice(screen.getByRole('button', {name: '번호 만들기'}));
  await waitFor(() => screen.getByTestId('wait-code')); // C2 없이 바로 C3
  expect(create).toHaveBeenCalledTimes(1);
  expect(issue).toHaveBeenCalledTimes(1);
});

test('자녀 설정 새 폰 연결 번호를 두 번 빨리 눌러도 번호는 한 번', async () => {
  const api = createFakeApi({consented: true, parentTitle: '엄마'});
  const issue = jest.spyOn(api, 'issueInviteCode');
  await renderChildScreen({api}); // C7 만 바로(대기열 71)
  await waitFor(() => screen.getByText('새 폰 연결 번호'));
  await twice(screen.getByText('새 폰 연결 번호'));
  await waitFor(() => expect(issue).toHaveBeenCalled());
  await new Promise<void>(r => setTimeout(() => r(), 50));
  expect(issue).toHaveBeenCalledTimes(1);
});
