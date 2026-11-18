// P6 ANR 조사(L4 logcat 11-19 22:20 "Input dispatching timed out … KeyEvent", F1 자판 입력) 회귀 가드.
// 조사 결과 JS 쪽은 한 글자마다 다시 그리기 1번(앱 전체 ~1~3ms, jest)이고 서버·네이티브 호출이 없었다.
// 이 테스트는 그 상태를 지킨다: 글자 입력마다 서버(api)·읽어 주기(TTS)·소리 크기·벨소리·앱 상태 구독·접근성 알림을 부르지 않고,
// 다시 그리기는 글자당 한 번.
import React, {Profiler} from 'react';
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi} from '../src/features/fakeApi';
import {pressCourseNext} from '../testUtils/flow';

test('P6 글자 입력마다: 다시 그리기 1번, 서버·TTS·소리·앱 상태·접근성 알림 호출 0', async () => {
  const api = createFakeApi({linked: true, consented: true, completedSteps: ['photo', 'question']});
  const apiSpies: [string, jest.SpyInstance][] = Object.keys(api)
    .filter(k => typeof (api as unknown as Record<string, unknown>)[k] === 'function')
    .map(k => [k, jest.spyOn(api as never, k as never)]);
  let commits = 0;
  render(
    <Profiler id="app" onRender={() => (commits += 1)}>
      <AppRoot api={api} role="parent" restore />
    </Profiler>,
  );
  await waitFor(() => screen.getByTestId('date-line'));
  await pressCourseNext();
  const input = await waitFor(() => screen.getByLabelText('낱말 쓰는 칸'));
  await act(async () => {
    fireEvent(input, 'focus');
  });
  await new Promise<void>(r => setTimeout(() => r(), 500)); // 진입 뒤 남은 효과(제목 포커스·지연 타이머)가 끝나게

  const RN = require('react-native');
  const vm = require('react-native-volume-manager');
  const speech = require('@mhpdev/react-native-speech').default;
  const watched: [string, jest.SpyInstance | jest.Mock][] = [
    ...apiSpies,
    ['announce', jest.spyOn(RN.AccessibilityInfo, 'announceForAccessibility')],
    ['sendA11y', jest.spyOn(RN.AccessibilityInfo, 'sendAccessibilityEvent')],
    ['appState', jest.spyOn(RN.AppState, 'addEventListener')],
    ['ringer', vm.getRingerMode],
    ['volume', vm.getVolume],
    ...Object.entries(speech as Record<string, unknown>)
      .filter(([, f]) => typeof f === 'function' && (f as jest.Mock).mock)
      .map(([k, f]) => [`speech.${k}`, f as jest.Mock] as [string, jest.Mock]),
  ];
  watched.forEach(([, m]) => m.mockClear());
  commits = 0;

  const N = 40;
  for (let i = 0; i < N; i++) {
    const t = '가나다라마바사아자차카타파하'.slice(0, (i % 14) + 1); // 맞는 낱말이 되지 않는 입력(일치하면 입력칸이 잠김)
    await act(async () => {
      fireEvent.changeText(input, t);
    });
  }
  const called = watched.filter(([, m]) => m.mock.calls.length > 0).map(([k, m]) => `${k}×${m.mock.calls.length}`);
  expect(called).toEqual([]);
  expect(commits).toBe(N);
});
