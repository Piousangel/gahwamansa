import React from 'react';
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react-native';
import {AccessibilityInfo, Keyboard} from 'react-native';
import {press, pressCourseNext, toHomeConsented} from '../testUtils/flow';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi, FakeOptions} from '../src/features/fakeApi';
import type {Api} from '../src/features/types';

// P6 자판으로 쓰기(시안 P6_keyboard v4, copy-v3 10절, 설계 B + 리뷰 B항). 오늘 낱말: 1일차 "나무".
let mockFontScale = 1;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({width: 360, height: 780, scale: 3, fontScale: mockFontScale}),
}));
afterEach(() => {
  mockFontScale = 1;
  jest.useRealTimers();
});

// 모든 API 호출 인자를 기록한다(입력 글자가 어디로도 나가지 않는지 보기 위해)
function recordingApi(opts: FakeOptions) {
  const api = createFakeApi(opts);
  const calls: {name: string; args: unknown[]}[] = [];
  const wrapped = new Proxy(api, {
    get(target, prop: string) {
      const v = (target as unknown as Record<string, unknown>)[prop];
      if (typeof v !== 'function') {
        return v;
      }
      return (...args: unknown[]) => {
        calls.push({name: prop, args});
        return (v as (...a: unknown[]) => unknown).apply(target, args);
      };
    },
  }) as Api;
  return {api: wrapped, calls};
}

async function toKeyboardStep(opts: FakeOptions = {}) {
  const r = recordingApi({linked: true, consented: true, completedSteps: ['photo', 'question'], ...opts});
  await toHomeConsented(r.api);
  await pressCourseNext();
  await waitFor(() => screen.getByLabelText('낱말 쓰는 칸'));
  return r;
}
const input = () => screen.getByLabelText('낱말 쓰는 칸');
const type = async (t: string) => {
  await act(async () => {
    fireEvent.changeText(input(), t);
  });
};
const filled = () => [0, 1].filter(i => screen.queryByTestId(`kb-cell-check-${i}`, {includeHiddenElements: true}));

test('처음: 단계 제목·안내·낱말 칸·입력칸·이유 줄, "다 썼어요"는 비활성, 넘어가기는 약한 링크', async () => {
  await toKeyboardStep();
  expect(screen.getByText('자판으로 쓰기 · 3 / 3')).toBeTruthy(); // 단계 제목 한 줄(v4 StepHeader)
  expect(screen.getByText('보이는 낱말을 아래 칸에 써요')).toBeTruthy();
  expect(screen.getByLabelText('쓸 낱말, 나무, 두 글자')).toBeTruthy();
  expect(screen.getByText('천천히 써 봐요')).toBeTruthy();
  expect(screen.getByText('한 글자라도 쓰면 눌려요', {includeHiddenElements: true})).toBeTruthy(); // 이유 줄은 힌트로 읽어 중복 읽기 숨김(R8)
  expect(screen.getByRole('button', {name: '다 썼어요'})).toBeDisabled();
  expect(screen.getByRole('button', {name: '오늘은 넘어갈게요'})).toBeTruthy();
  expect(screen.queryByTestId('kb-skip-strong')).toBeNull();
  // 폐기 문구
  expect(screen.queryByText(/틀려도|따라 써|점선/)).toBeNull();
});

test('입력칸은 비제어(value 재주입 없음), 시스템 자판 설정 그대로(autoCorrect 지정 안 함)', async () => {
  await toKeyboardStep();
  expect(input().props.value).toBeUndefined();
  expect(input().props.autoCorrect).toBeUndefined();
  expect(input().props.placeholder).toBeUndefined(); // v4 2-8 placeholder 금지(PR #14 리뷰 M1) — 안내는 칸 위 글·읽기 힌트
  expect(input().props.accessibilityHint).toBe('여기를 누르면 자판이 나와요');
  await type('나');
  expect(input().props.value).toBeUndefined();
});

test('맞은 음절 칸만 앞에서부터 채우고, 틀림 표시는 어디에도 없다', async () => {
  await toKeyboardStep();
  await type('나');
  expect(filled()).toEqual([0]);
  await type('나모'); // 조합 중이거나 다른 음절: 채우지 않을 뿐
  expect(filled()).toEqual([0]);
  expect(screen.queryByText(/틀|아직|못/)).toBeNull();
  await type('너무');
  expect(filled()).toEqual([]);
  expect(screen.getByRole('button', {name: '다 썼어요'})).toBeEnabled();
});

test('같게 쓰면 자판을 내리고 "낱말을 다 쓰셨어요", 마치기는 1.5초 뒤부터, 이동은 마치기로만', async () => {
  const dismiss = jest.spyOn(Keyboard, 'dismiss');
  const {calls} = await toKeyboardStep();
  await type(' 나무 '); // 공백은 무시
  expect(dismiss).toHaveBeenCalled();
  expect(filled()).toEqual([0, 1]);
  expect(screen.getByText('낱말을 다 쓰셨어요')).toBeTruthy();
  expect(screen.getByRole('button', {name: '마칠게요'})).toBeDisabled();
  expect(calls.some(c => c.name === 'recordSessionStep')).toBe(false); // 자동 이동 없음
  await waitFor(() => expect(screen.getByRole('button', {name: '마칠게요'})).toBeEnabled(), {timeout: 6000});
  await press('마칠게요');
  await waitFor(() => screen.getByText('오늘 코스를 마쳤어요'));
  const rec = calls.filter(c => c.name === 'recordSessionStep');
  expect(rec).toHaveLength(1);
  expect(rec[0].args[0]).toBe('hangul');
  dismiss.mockRestore();
});

test('추천 낱말이 조사를 붙여도("나무가") 일치로 본다(칸 전부 체크 + 시트 없음, 리뷰 3)', async () => {
  await toKeyboardStep();
  await type('나무가');
  expect(filled()).toEqual([0, 1]);
  expect(screen.getByText('낱말을 다 쓰셨어요')).toBeTruthy();
  expect(screen.queryByText('낱말을 한 번 더 볼까요?')).toBeNull();
});

test('조합 중 받침이 붙어도(나 → 남) 첫 칸 체크가 사라지지 않는다(리뷰 4)', async () => {
  await toKeyboardStep();
  await type('나');
  expect(filled()).toEqual([0]);
  await type('남');
  expect(filled()).toEqual([0]);
});

test('일치하면 알림 1회 뒤 접근성 포커스를 "마칠게요"로 옮긴다(명세 P6, 리뷰 5)', async () => {
  const send = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent');
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
  await toKeyboardStep();
  send.mockClear();
  announce.mockClear();
  await type('나무');
  expect(announce).toHaveBeenCalledTimes(1);
  expect(announce).toHaveBeenCalledWith('낱말을 다 쓰셨어요');
  const toFinish = () =>
    send.mock.calls.some(c => (c[0] as unknown as {props?: {accessibilityLabel?: string}})?.props?.accessibilityLabel === '마칠게요');
  expect(toFinish()).toBe(false); // 알림 읽기가 끝나도록 바로 옮기지 않는다(재검토 ①)
  await waitFor(() => expect(toFinish()).toBe(true), {timeout: 6000}); // 1.5초(마치기 활성)와 함께
  send.mockRestore();
  announce.mockRestore();
});

test('입력칸은 자동완성 저장 제안을 끈다(importantForAutofill="no")', async () => {
  await toKeyboardStep();
  expect(input().props.importantForAutofill).toBe('no');
});

test('입력한 글자는 어떤 API 호출에도 실리지 않는다', async () => {
  const {calls} = await toKeyboardStep();
  await type('나모');
  await press('다 썼어요');
  await press('이대로 마칠게요');
  await waitFor(() => screen.getByText('오늘 코스를 마쳤어요'));
  expect(JSON.stringify(calls)).not.toContain('나모');
});

test('다른 낱말로 "다 썼어요": 시트(낱말·쓰신 낱말), 다시 써 볼게요 → 입력 유지, 두 번째 뒤 넘어가기가 또렷해진다', async () => {
  await toKeyboardStep();
  await type('나모');
  await press('다 썼어요');
  expect(screen.getByText('낱말을 한 번 더 볼까요?')).toBeTruthy();
  expect(screen.getByText('쓰신 낱말 나모')).toBeTruthy();
  expect(screen.queryByText(/한 글자가 달라요|틀/)).toBeNull();
  await press('다시 써 볼게요');
  expect(screen.queryByText('낱말을 한 번 더 볼까요?')).toBeNull();
  expect(screen.queryByTestId('kb-skip-strong')).toBeNull();
  await press('다 썼어요');
  await press('다시 써 볼게요');
  expect(screen.getByTestId('kb-skip-strong')).toBeTruthy();
});

test('반례: 받침 유지로 칸은 다 찼어도 일치가 아니면 "다 썼어요" → 대화상자, 대화상자 칸은 확정된 칸만(재검토 ③)', async () => {
  await toKeyboardStep();
  await type('나뭄');
  expect(filled()).toEqual([0, 1]); // 쓰는 중 화면: 조합 중 받침 유지
  expect(screen.queryByText('낱말을 다 쓰셨어요')).toBeNull(); // 자동 완료 없음
  await press('다 썼어요');
  expect(screen.getByText('낱말을 한 번 더 볼까요?')).toBeTruthy();
  expect(screen.getByTestId('kb-dialog-cell-check-0', {includeHiddenElements: true})).toBeTruthy();
  expect(screen.queryByTestId('kb-dialog-cell-check-1', {includeHiddenElements: true})).toBeNull();
  expect(screen.getByText('쓰신 낱말 나뭄')).toBeTruthy();
});

test('계측: 단계 시작 + 완료 때 course_step_completed {step:hangul, attempt_no, duration_sec, result:finished} + course_completed, 글자 없음', async () => {
  const {calls} = await toKeyboardStep();
  await type('나모');
  await press('다 썼어요');
  await press('다시 써 볼게요');
  await press('다 썼어요');
  await press('이대로 마칠게요');
  await waitFor(() => screen.getByText('오늘 코스를 마쳤어요'));
  // 코스 이벤트는 전부 본다: 다른 코스 이벤트가 끼면 순서 검사가 잡는다(번호 연결·첫 실행 이벤트는 다른 테스트)
  const ev = calls.filter(c => c.name === 'logEvent' && String(c.args[0]).startsWith('course_')).map(c => c.args);
  expect(ev).toHaveLength(3);
  expect(ev[0]).toEqual(['course_step_started', {step: 'hangul', day_index: 1}]);
  expect(ev[1][0]).toBe('course_step_completed');
  // AC-05: '이대로 마칠게요'도 finished(맞았는지는 싣지 않음)
  expect(ev[1][1]).toEqual({step: 'hangul', duration_sec: expect.any(Number), attempt_no: 2, result: 'finished'});
  expect(ev[2]).toEqual(['course_completed', {day_index: 1}]);
  expect(JSON.stringify(calls.filter(c => c.name === 'logEvent'))).not.toContain('나모');
});

test('계측 AC-05: 맞게 써서 마치기도 finished, 넘어가기는 skipped — 두 값뿐', async () => {
  const a = await toKeyboardStep();
  await type('나무');
  await waitFor(() => expect(screen.getByRole('button', {name: '마칠게요'})).toBeEnabled(), {timeout: 6000});
  await press('마칠게요');
  await waitFor(() => screen.getByText('오늘 코스를 마쳤어요'));
  const done1 = a.calls.filter(c => c.name === 'logEvent' && c.args[0] === 'course_step_completed').map(c => c.args[1]);
  expect(done1).toEqual([expect.objectContaining({step: 'hangul', result: 'finished'})]);
  screen.unmount();

  const b = await toKeyboardStep();
  await press('오늘은 넘어갈게요');
  await waitFor(() => screen.getByText('오늘 코스를 마쳤어요'));
  const done2 = b.calls.filter(c => c.name === 'logEvent' && c.args[0] === 'course_step_completed').map(c => c.args[1]);
  expect(done2).toEqual([expect.objectContaining({step: 'hangul', result: 'skipped'})]);
});

test('계측 실패(한도·지워진 계정·네트워크)는 화면을 막지 않는다', async () => {
  for (const eventResult of ['rate_limited', 'no_user', 'offline'] as const) {
    await toKeyboardStep({eventResult});
    await press('오늘은 넘어갈게요');
    await waitFor(() => screen.getByText('오늘 코스를 마쳤어요'));
    screen.unmount();
  }
});

test('시트에서 "이대로 마칠게요"도 단계 완료로 저장한다(평가하지 않음)', async () => {
  const {calls} = await toKeyboardStep();
  await type('나모');
  await press('다 썼어요');
  await press('이대로 마칠게요');
  await waitFor(() => screen.getByText('오늘 코스를 마쳤어요'));
  expect(calls.filter(c => c.name === 'recordSessionStep').map(c => c.args[0])).toEqual(['hangul']);
});

test('"오늘은 넘어갈게요"도 단계 완료로 저장한다', async () => {
  const {calls} = await toKeyboardStep();
  await press('오늘은 넘어갈게요');
  await waitFor(() => screen.getByText('오늘 코스를 마쳤어요'));
  expect(calls.filter(c => c.name === 'recordSessionStep').map(c => c.args[0])).toEqual(['hangul']);
});

test('20초가 지나면 넘어가기가 또렷해진다', async () => {
  jest.useFakeTimers();
  await toKeyboardStep();
  expect(screen.queryByTestId('kb-skip-strong')).toBeNull();
  await act(async () => {
    jest.advanceTimersByTime(19000);
  });
  expect(screen.queryByTestId('kb-skip-strong')).toBeNull();
  await act(async () => {
    jest.advanceTimersByTime(1000);
  });
  expect(screen.getByTestId('kb-skip-strong')).toBeTruthy();
});

test('자판 열림(100%): 사진·안내·이유 줄·넘어가기를 숨기고, 단계 제목도 접는다(PR #14 리뷰 M2·v4 2-5: 배율 무관)', async () => {
  await toKeyboardStep();
  await act(async () => {
    fireEvent(input(), 'focus');
  });
  expect(screen.queryByText('자판으로 쓰기 · 3 / 3')).toBeNull();
  expect(screen.queryByText('보이는 낱말을 아래 칸에 써요')).toBeNull();
  expect(screen.queryByText('천천히 써 봐요')).toBeNull();
  expect(screen.queryByText('한 글자라도 쓰면 눌려요')).toBeNull();
  expect(screen.queryByRole('button', {name: '오늘은 넘어갈게요'})).toBeNull();
  expect(screen.getByRole('button', {name: '다 썼어요'})).toBeTruthy();
  await act(async () => {
    fireEvent(input(), 'blur');
  });
  expect(screen.getByText('보이는 낱말을 아래 칸에 써요')).toBeTruthy();
});

test('글자 150% 이상 + 자판 열림이면 제목·단계도 숨긴다', async () => {
  mockFontScale = 1.5;
  await toKeyboardStep();
  expect(screen.getByText('자판으로 쓰기 · 3 / 3')).toBeTruthy();
  await act(async () => {
    fireEvent(input(), 'focus');
  });
  expect(screen.queryByText('자판으로 쓰기 · 3 / 3')).toBeNull();
});

test('기록 실패: 오류 패널과 다시 하기, 다시 하면 완료 화면으로', async () => {
  await toKeyboardStep({failRecord: 1});
  await press('오늘은 넘어갈게요');
  await waitFor(() => screen.getByText('인터넷이 잠깐 끊겼어요'));
  await press('다시 하기');
  await waitFor(() => screen.getByText('오늘 코스를 마쳤어요'));
});

test('이전(‹ 오늘 코스)은 기록 없이 코스 홈으로', async () => {
  const {calls} = await toKeyboardStep();
  await act(async () => fireEvent.press(screen.getAllByRole('button', {name: '오늘 코스로 돌아가기'})[0])); // 상단 바(하단 링크도 같은 읽기, U13)
  await waitFor(() => screen.getByTestId('date-line'));
  expect(calls.some(c => c.name === 'recordSessionStep')).toBe(false);
});

test('화면 읽기(TalkBack)가 켜져 있으면 넘어가기를 처음부터 또렷하게(명세 P6 9번)', async () => {
  const sr = jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(true);
  await toKeyboardStep();
  await waitFor(() => screen.getByTestId('kb-skip-strong'));
  // 프리셋의 이 함수는 jest.fn 이라 mockRestore 하면 구현이 비어 버린다 → 기본값(false)으로 되돌린다
  sr.mockImplementation(() => Promise.resolve(false));
});

test('읽기 라벨: 제목 줄 한 덩어리, 읽어 주세요는 글자 있는 버튼 하나(AP-03, 빈 버튼 없음)', async () => {
  await toKeyboardStep();
  expect(screen.getByLabelText('자판으로 쓰기, 3단계 중 3단계')).toBeTruthy();
  expect(screen.getAllByRole('button', {name: '읽어 주세요'})).toHaveLength(1);
  expect(screen.getByText('읽어 주세요')).toBeTruthy();
});

test('P3 단계 행·첫 화면 소개는 "자판으로 쓰기"·"사진 속 낱말을 자판으로 써요"', async () => {
  render(<AppRoot api={createFakeApi()} />);
  expect(screen.getByText('사진 속 낱말을 자판으로 써요', {includeHiddenElements: true})).toBeTruthy();
});
