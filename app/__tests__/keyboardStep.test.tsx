import React from 'react';
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react-native';
import {Keyboard} from 'react-native';
import {press, toHomeConsented} from '../testUtils/flow';
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
  await press('이어서 하기');
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
  expect(screen.getByText('자판으로 쓰기')).toBeTruthy();
  expect(screen.getByText('3 / 3')).toBeTruthy();
  expect(screen.getByText('보이는 낱말을 아래 칸에 써요')).toBeTruthy();
  expect(screen.getByLabelText('쓸 낱말, 나무, 두 글자. 자판으로 쓰거나 넘어갈 수 있어요')).toBeTruthy();
  expect(screen.getByText('천천히 써 봐요')).toBeTruthy();
  expect(screen.getByText('한 글자만 써도 누를 수 있어요')).toBeTruthy();
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
  expect(input().props.placeholder).toBe('여기를 누르면 자판이 나와요');
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
  expect(screen.getByRole('button', {name: '마치기'})).toBeDisabled();
  expect(calls.some(c => c.name === 'recordSessionStep')).toBe(false); // 자동 이동 없음
  await waitFor(() => expect(screen.getByRole('button', {name: '마치기'})).toBeEnabled(), {timeout: 2500});
  await press('마치기');
  await waitFor(() => screen.getByText('오늘 코스를 마쳤어요'));
  const rec = calls.filter(c => c.name === 'recordSessionStep');
  expect(rec).toHaveLength(1);
  expect(rec[0].args[0]).toBe('hangul');
  dismiss.mockRestore();
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
  expect(screen.getByText('쓰신 낱말')).toBeTruthy();
  expect(screen.getByText('나모')).toBeTruthy();
  expect(screen.queryByText(/한 글자가 달라요|틀/)).toBeNull();
  await press('다시 써 볼게요');
  expect(screen.queryByText('낱말을 한 번 더 볼까요?')).toBeNull();
  expect(screen.queryByTestId('kb-skip-strong')).toBeNull();
  await press('다 썼어요');
  await press('다시 써 볼게요');
  expect(screen.getByTestId('kb-skip-strong')).toBeTruthy();
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

test('자판 열림(100%): 사진·안내·이유 줄·넘어가기를 숨기고 제목은 남긴다', async () => {
  await toKeyboardStep();
  await act(async () => {
    fireEvent(input(), 'focus');
  });
  expect(screen.getByText('자판으로 쓰기')).toBeTruthy();
  expect(screen.queryByText('보이는 낱말을 아래 칸에 써요')).toBeNull();
  expect(screen.queryByText('천천히 써 봐요')).toBeNull();
  expect(screen.queryByText('한 글자만 써도 누를 수 있어요')).toBeNull();
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
  expect(screen.getByText('자판으로 쓰기')).toBeTruthy();
  await act(async () => {
    fireEvent(input(), 'focus');
  });
  expect(screen.queryByText('자판으로 쓰기')).toBeNull();
  expect(screen.queryByText('3 / 3')).toBeNull();
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
  await press('오늘 코스로 돌아가기');
  await waitFor(() => screen.getByText('오늘의 코스'));
  expect(calls.some(c => c.name === 'recordSessionStep')).toBe(false);
});

test('P3 단계 행·첫 화면 소개는 "자판으로 쓰기"·"사진 속 낱말을 자판으로 써요"', async () => {
  render(<AppRoot api={createFakeApi()} />);
  expect(screen.getByText('사진 속 낱말을 자판으로 써요', {includeHiddenElements: true})).toBeTruthy();
});
