import React from 'react';
import {StyleSheet} from 'react-native';
import {fireEvent, render, screen, waitFor} from '@testing-library/react-native';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi, FakeOptions} from '../src/features/fakeApi';
import {StepRow} from '../src/ui/StepRow';
import {Text20} from '../src/ui/Text20';
import {fontSize, labelLineHeight, lineHeightFor} from '../src/ui/tokens';
import {press} from '../testUtils/flow';

// P3 코스 홈 v4(동결 시안 P3_course_home_v4): 리듬 규칙(D)·완료 상태 다시 보기(B)·제목 없음·미연결 띠.

describe('토큰: 줄 높이 표·글자 크기 이름', () => {
  test('줄 높이 표 20→30, 22→32, 24→34, 28→38, 32→44, 36→48, 한 줄 라벨 = 글자 + 8', () => {
    expect([20, 22, 24, 28, 32, 36].map(lineHeightFor)).toEqual([30, 32, 34, 38, 44, 48]);
    expect([20, 24, 32].map(labelLineHeight)).toEqual([28, 32, 40]);
  });
  test('본문 20, 큰 본문 22(fontSize.body 22 이름 폐기, bodyMin 정리)', () => {
    expect(fontSize.body).toBe(20);
    expect(fontSize.bodyLg).toBe(22);
    expect((fontSize as Record<string, number>).bodyMin).toBeUndefined();
  });
  test('Text20 은 표대로 줄 높이를 주고, oneLine 이면 라벨 줄 높이', () => {
    render(
      <>
        <Text20 size={24}>여러 줄</Text20>
        <Text20 size={24} oneLine>
          한 줄
        </Text20>
        <Text20>본문</Text20>
      </>,
    );
    expect(StyleSheet.flatten(screen.getByText('여러 줄').props.style).lineHeight).toBe(34);
    expect(StyleSheet.flatten(screen.getByText('한 줄').props.style).lineHeight).toBe(32);
    expect(StyleSheet.flatten(screen.getByText('본문').props.style).lineHeight).toBe(30);
  });
});

describe('StepRow 리듬', () => {
  const rowStyle = (label: string) => StyleSheet.flatten(screen.getByLabelText(label).props.style);
  test('내용 시작 20 고정(테두리 + 패딩), 세로 패딩 16, 최소 높이 없음, 바닥선 정렬·줄바꿈 가운데', () => {
    render(
      <>
        <StepRow title="사진 보기" status="done" statusLabel="했어요" />
        <StepRow title="둘 중 고르기" status="now" statusLabel="지금 할 차례" />
        <StepRow title="자판으로 쓰기" status="wait" statusLabel="다음 차례" />
      </>,
    );
    const done = rowStyle('사진 보기, 했어요');
    const now = rowStyle('둘 중 고르기, 지금 할 차례');
    const wait = rowStyle('자판으로 쓰기, 다음 차례');
    expect((done.borderWidth ?? 0) + done.paddingHorizontal).toBe(20);
    expect(now.borderWidth + now.paddingHorizontal).toBe(20);
    expect(wait.borderWidth + wait.paddingHorizontal).toBe(20);
    for (const s of [done, now, wait]) {
      expect(s.paddingVertical).toBe(16);
      expect(s.minHeight).toBeUndefined();
    }
    expect(done.alignItems).toBe('baseline');
    expect(done.alignContent).toBe('center');
    // 한 줄 행: 제목 24 라벨 32 → 16 + 32 + 16 = 64
    expect(StyleSheet.flatten(screen.getByText('사진 보기').props.style).lineHeight).toBe(32);
    // 지금 행: 테이프 28 + 8 + 제목 32
    expect(StyleSheet.flatten(screen.getByText('지금 할 차례').props.style).lineHeight).toBe(28);
    expect(StyleSheet.flatten(screen.getByText('둘 중 고르기').props.style).lineHeight).toBe(32);
  });
  test('onPress 를 주면 했어요 행이 버튼이 되고 오른쪽에 ›', () => {
    const onPress = jest.fn();
    render(<StepRow title="사진 보기" status="done" statusLabel="했어요" onPress={onPress} />);
    const btn = screen.getByRole('button', {name: '사진 보기, 했어요'});
    expect(screen.getByText('›', {includeHiddenElements: true})).toBeTruthy();
    fireEvent.press(btn);
    expect(onPress).toHaveBeenCalled();
  });
  test('onPress 가 없으면 누르지 않는 행(› 없음)', () => {
    render(<StepRow title="사진 보기" status="done" statusLabel="했어요" />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByText('›', {includeHiddenElements: true})).toBeNull();
  });
});

async function home(opts: FakeOptions) {
  const api = createFakeApi({linked: true, consented: true, ...opts});
  render(<AppRoot api={api} role="parent" restore />);
  await waitFor(() => screen.getByTestId('date-line'));
  return api;
}

describe('코스 홈 v4', () => {
  test('"오늘의 코스" 제목 없음, 날짜 줄이 화면 제목(머리글), 단계 행 사이 8', async () => {
    await home({});
    expect(screen.queryByText('오늘의 코스')).toBeNull();
    expect(screen.getByTestId('date-line').props.accessibilityRole).toBe('header');
    expect(StyleSheet.flatten(screen.getByTestId('course-steps').props.style).gap).toBe(8);
    expect(screen.getByText('오늘 코스예요')).toBeTruthy(); // 0/3 인사 한 줄
  });

  test('3/3 완료: "오늘 코스는 여기까지예요. 내일 또 만나요", 했어요 행 ›, 하단 보조 "오늘 코스 다시 보기" → 사진 보기 전용(기록 0)', async () => {
    const api = await home({completedSteps: ['photo', 'question', 'hangul']});
    const rec = jest.spyOn(api, 'recordSessionStep');
    expect(screen.getByText('오늘 코스는 여기까지예요. 내일 또 만나요')).toBeTruthy();
    expect(screen.getByRole('button', {name: '사진 보기, 했어요'})).toBeTruthy();
    await press('오늘 코스 다시 보기');
    await waitFor(() => screen.getByLabelText('사진 보기, 다시 보는 중'));
    expect(screen.getByText('마을 입구 나무')).toBeTruthy();
    expect(screen.getByLabelText('사진 보기, 다시 보는 중')).toBeTruthy();
    expect(screen.queryByText('1 / 3')).toBeNull();
    expect(screen.queryByRole('button', {name: '다 봤어요'})).toBeNull();
    // 하단 '돌아가기'(보이는 글) = 읽기 "오늘 코스로 돌아가기"
    expect(screen.getByText('돌아가기')).toBeTruthy();
    fireEvent.press(screen.getByText('돌아가기'));
    await waitFor(() => screen.getByText('오늘 코스는 여기까지예요. 내일 또 만나요'));
    expect(rec).not.toHaveBeenCalled();
  });

  test('3/3 완료: 사진 보기 행 › 로도 보기 전용', async () => {
    await home({completedSteps: ['photo', 'question', 'hangul']});
    await press('사진 보기, 했어요');
    await waitFor(() => screen.getByLabelText('사진 보기, 다시 보는 중'));
  });

  test('완료 전에는 행을 누를 수 없고 다시 보기 버튼도 없다', async () => {
    await home({completedSteps: ['photo']});
    expect(screen.queryByRole('button', {name: '사진 보기, 했어요'})).toBeNull();
    expect(screen.queryByRole('button', {name: '오늘 코스 다시 보기'})).toBeNull();
  });
});

describe('미연결', () => {
  async function previewDone() {
    render(<AppRoot api={createFakeApi()} />);
    await press(/부모님 휴대폰이에요/);
    await press('코스 보기');
    await waitFor(() => screen.getByText('번호를 받으면 그때부터 답이 저장돼요'));
  }
  test('띠: 세로 패딩 12, 글 첫 줄과 링크 바닥선 정렬', async () => {
    await previewDone();
    const strip = StyleSheet.flatten(screen.getByTestId('course-strip').props.style);
    expect(strip.paddingVertical).toBe(12);
    expect(strip.alignItems).toBe('baseline');
  });
  test('미연결 3/3 은 도장 문구 대신 "오늘 코스를 다 봤어요"', async () => {
    await previewDone();
    for (const step of ['다 봤어요', '정했어요']) {
      await press(/사진 보기|둘 중 고르기/);
      if (step === '정했어요') {
        await waitFor(() => screen.getByText('봄'));
        fireEvent.press(screen.getByText('봄'));
      }
      await waitFor(() => screen.getByRole('button', {name: step}));
      await press(step);
      await waitFor(() => screen.getByTestId('date-line'));
    }
    await press('자판으로 쓰기');
    await waitFor(() => screen.getByRole('button', {name: '오늘은 넘어갈게요'}));
    await press('오늘은 넘어갈게요');
    await waitFor(() => screen.getByText('오늘 코스를 마쳤어요')); // P7
    await press('알겠어요');
    await waitFor(() => screen.getByText('오늘 코스를 다 봤어요'));
    expect(screen.queryByText(/도장/)).toBeNull();
  });
});
