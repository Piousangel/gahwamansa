import React from 'react';
import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react-native';
import {AccessibilityInfo, Keyboard} from 'react-native';
import {press, pressCourseNext, toHomeConsented} from '../testUtils/flow';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi, FakeOptions} from '../src/features/fakeApi';
import type {Api} from '../src/features/types';
import {setupWarmAppRoot} from '../testUtils/warm';

// 첫 테스트만 콜드 스타트(첫 로드·첫 렌더)를 떠안지 않게 파일 시작 때 한 번 예열(#245 M2, testUtils/warm)
setupWarmAppRoot();

// P6 자판으로 쓰기(시안 P6_keyboard v4, copy-v3 10절, 설계 B + 리뷰 B항). 오늘 낱말: 1일차 "나무".
let mockFontScale = 1;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({width: 360, height: 780, scale: 3, fontScale: mockFontScale}),
}));
// 자판 열림은 DsScreen 이 Keyboard 이벤트로 위 영역을 접는다(R-15) → 시스템 자판 이벤트를 붙잡아 테스트가 보낸다
let kbHandlers: Record<string, ((e?: unknown) => void)[]> = {};
beforeEach(() => {
  kbHandlers = {};
  jest.spyOn(Keyboard, 'addListener').mockImplementation(((ev: string, fn: (e?: unknown) => void) => {
    (kbHandlers[ev] ??= []).push(fn);
    return {remove: () => {}};
  }) as never);
});
afterEach(() => {
  mockFontScale = 1;
  jest.useRealTimers();
  jest.restoreAllMocks();
});
const openKb = async () => {
  await act(async () => {
    fireEvent(input(), 'focus');
    (kbHandlers.keyboardDidShow ?? []).forEach(f => f({endCoordinates: {height: 270}}));
  });
};
const closeKb = async () => {
  await act(async () => {
    fireEvent(input(), 'blur');
    (kbHandlers.keyboardDidHide ?? []).forEach(f => f());
  });
};

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

test('처음: 단계 제목·안내·낱말 칸·입력칸·이유 줄, "다 썼어요"는 비활성, 넘어가기는 약한 링크', async () => {
  await toKeyboardStep();
  expect(screen.getByText('낱말 쓰기 · 3 / 3')).toBeTruthy(); // 단계 제목 한 줄(v4 StepHeader)
  expect(screen.getByText('보이는 낱말을 아래 칸에 써요')).toBeTruthy();
  expect(screen.getByLabelText('따라 쓸 낱말, 나무')).toBeTruthy(); // v4: 본보기 낱말 한 줄(입력 칸 바로 위)
  expect(screen.queryByText('천천히 써 봐요')).toBeNull(); // 시안 ds4b 보조 문구는 '한 글자라도 쓰면 눌려요'
  expect(screen.getAllByText('한 글자라도 쓰면 눌려요', {includeHiddenElements: true}).length).toBeGreaterThanOrEqual(1);
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
  expect(input().props.accessibilityHint).toBe('나무를 써 주세요. 여기를 누르면 자판이 나와요'); // #265 QA-2 L1: 힌트에 따라 쓸 낱말
  await type('나');
  expect(input().props.value).toBeUndefined();
});

test('v4(시안 ds4b): 쓰는 중에는 음절 칸이 없고 본보기 낱말 한 줄만, 틀림 표시는 어디에도 없다', async () => {
  await toKeyboardStep();
  await type('나모');
  expect(screen.queryByTestId('kb-cell-0')).toBeNull();
  expect(screen.getByTestId('kb-word', {includeHiddenElements: true})).toHaveTextContent('나무');
  expect(screen.queryByText(/틀|아직|못/)).toBeNull();
  expect(screen.getByRole('button', {name: '다 썼어요'})).toBeEnabled();
});

test('같게 쓰면 자판을 내리고 "낱말을 다 쓰셨어요", 마치기는 1.5초 뒤부터, 이동은 마치기로만', async () => {
  jest.useFakeTimers(); // 마치기 1.5초를 실제로 기다리지 않는다(waitFor 가 가짜 시계를 돌림, 부하 정리 2차)
  const dismiss = jest.spyOn(Keyboard, 'dismiss');
  const {calls} = await toKeyboardStep();
  await type(' 나무 '); // 공백은 무시
  expect(dismiss).toHaveBeenCalled();
  expect(screen.getByText('낱말을 다 쓰셨어요')).toBeTruthy();
  expect(screen.getByTestId('kb-written')).toHaveTextContent(/쓰신 낱말\s*나무/);
  // 시안 ds4b: '마칠게요'는 보통 모양(비활성 아님), 1.5초 동안은 눌러도 무시
  expect(screen.getByRole('button', {name: '마칠게요'})).toBeEnabled();
  await press('마칠게요');
  expect(calls.some(c => c.name === 'recordSessionStep')).toBe(false); // 무시 + 자동 이동 없음
  await act(async () => {
    jest.advanceTimersByTime(1600);
  });
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
  expect(screen.getByText('낱말을 다 쓰셨어요')).toBeTruthy();
  expect(screen.queryByText('낱말을 한 번 더 볼까요?')).toBeNull();
});

test('조합 중(나 → 남)에는 일치로 보지 않는다(리뷰 4)', async () => {
  await toKeyboardStep();
  await type('나');
  await type('남');
  expect(screen.queryByText('낱말을 다 쓰셨어요')).toBeNull();
});

test('일치하면 알림 1회 뒤 접근성 포커스를 "마칠게요"로 옮긴다(명세 P6, 리뷰 5)', async () => {
  jest.useFakeTimers(); // 마치기 1.5초를 실제로 기다리지 않는다(waitFor 가 가짜 시계를 돌림, 부하 정리 2차)
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
  await waitFor(() => expect(toFinish()).toBe(true)); // 1.5초(마치기 활성)와 함께
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
  jest.useFakeTimers(); // 마치기 1.5초를 실제로 기다리지 않는다(waitFor 가 가짜 시계를 돌림, 부하 정리 2차)
  const a = await toKeyboardStep();
  await type('나무');
  await act(async () => {
    jest.advanceTimersByTime(1600); // 1.5초 누름 무시가 끝난 뒤
  });
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

test('자판 열림(100%, 시안 ds4b): 위 영역은 BackLink 줄 + 오른쪽 "넘어갈게요", 본문은 낱말 카드(본보기 낱말 + 입력 칸)만, Dock 다 썼어요', async () => {
  await toKeyboardStep();
  await openKb();
  expect(screen.queryByText('낱말 쓰기 · 3 / 3')).toBeNull();
  expect(screen.queryByText('보이는 낱말을 아래 칸에 써요')).toBeNull();
  expect(screen.queryByText('한 글자라도 쓰면 눌려요')).toBeNull();
  expect(screen.getByTestId('kb-word', {includeHiddenElements: true})).toBeTruthy(); // r1/7 H: 본보기 낱말이 입력 칸 바로 위에
  const top = screen.getByTestId('kb-skip-top');
  expect(top).toBeTruthy();
  expect(screen.queryByRole('button', {name: '오늘은 넘어갈게요'})).toBeNull();
  expect(screen.getByRole('button', {name: '다 썼어요'})).toBeTruthy();
  await closeKb();
  expect(screen.getByText('보이는 낱말을 아래 칸에 써요')).toBeTruthy();
});

test('자판 열림 + 로마자 입력이면 카드 아래 영문 안내 한 줄(시안 ds4b)', async () => {
  await toKeyboardStep();
  await openKb();
  await type('namu');
  expect(screen.getByTestId('kb-roman')).toHaveTextContent("영어로 써지고 있어요. 자판의 '한/영'을 눌러 주세요");
  await type('나무가');
  expect(screen.queryByTestId('kb-roman')).toBeNull();
});

test('글자 150% 이상 + 자판 열림이면 제목·단계도 숨긴다', async () => {
  mockFontScale = 1.5;
  await toKeyboardStep();
  expect(screen.getByText('낱말 쓰기 · 3 / 3')).toBeTruthy();
  await openKb();
  expect(screen.queryByText('낱말 쓰기 · 3 / 3')).toBeNull();
  // 200% 시안: '넘어갈게요'는 위 줄이 아니라 카드 아래 본문(스크롤로 닿음)
  expect(screen.queryByTestId('kb-skip-top')).toBeNull();
  expect(within(screen.getByTestId('screen-body')).getByRole('button', {name: '오늘은 넘어갈게요'})).toBeTruthy();
});

test('기록 실패: 오류 패널과 다시 하기, 다시 하면 완료 화면으로', async () => {
  await toKeyboardStep({failRecord: 1});
  await press('오늘은 넘어갈게요');
  await waitFor(() => screen.getByText('인터넷이 잠깐 끊겼어요'));
  await press('다시 하기');
  await waitFor(() => screen.getByText('오늘 코스를 마쳤어요'));
});

test('뒤로(‹ 오늘 코스로)는 기록 없이 코스 홈으로', async () => {
  const {calls} = await toKeyboardStep();
  await act(async () => fireEvent.press(screen.getByRole('link', {name: '오늘 코스로'}))); // v4 BackLink(하단 링크 없음, U-8)
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
  expect(screen.getByLabelText('낱말 쓰기, 3단계 중 3단계')).toBeTruthy();
  expect(screen.getAllByRole('button', {name: '읽어 주세요'})).toHaveLength(1);
  expect(screen.getByText('읽어 주세요')).toBeTruthy();
});

test('P3 단계 행·첫 화면 소개는 "낱말 쓰기"·"사진 속 낱말을 자판으로 써요"', async () => {
  render(<AppRoot api={createFakeApi()} />);
  expect(screen.getByText('사진 속 낱말을 자판으로 써요', {includeHiddenElements: true})).toBeTruthy();
});
