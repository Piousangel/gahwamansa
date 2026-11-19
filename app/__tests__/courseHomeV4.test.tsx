import React from 'react';
import {BackHandler, StyleSheet} from 'react-native';
import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react-native';
import {ds, roleText} from '../src/ui/ds/roles';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi, FakeOptions} from '../src/features/fakeApi';
import {StepRow} from '../src/ui/StepRow';
import {Text20} from '../src/ui/Text20';
import {fontSize, labelLineHeight, lineHeightFor} from '../src/ui/tokens';
import {press, toHomeConsented, confirmDeleteAll, pressCourseNext} from '../testUtils/flow';
import {createLocalStamps, localStamps, memoryStore, setLocalStampsForTest} from '../src/lib/localStamps';

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
        <StepRow title="낱말 쓰기" status="wait" statusLabel="다음 차례" />
      </>,
    );
    const done = rowStyle('사진 보기, 했어요');
    const now = rowStyle('둘 중 고르기, 지금 할 차례');
    const wait = rowStyle('낱말 쓰기, 다음 차례');
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
  test('했어요 행: 체크 아이콘 + 상태, onPress 면 › 아이콘(글자 아님)이 붙어도 줄 높이가 같다(64 리듬, 리뷰 M1)', () => {
    const onPress = jest.fn();
    render(
      <>
        <StepRow title="사진 보기" status="done" statusLabel="했어요" onPress={onPress} />
        <StepRow title="둘 중 고르기" status="done" statusLabel="했어요" />
      </>,
    );
    expect(screen.getAllByTestId('icon-check', {includeHiddenElements: true})).toHaveLength(2);
    expect(screen.getAllByTestId('icon-chevron-right', {includeHiddenElements: true})).toHaveLength(1);
    expect(screen.queryByText('›', {includeHiddenElements: true})).toBeNull();
    // 행 안 글자 중 가장 큰 줄 높이가 두 행 모두 32(제목 라벨) — › 가 행을 키우지 않는다
    const maxLine = (rowLabel: string) =>
      Math.max(
        ...screen
          .getByLabelText(rowLabel)
          .findAll(n => (n.type as unknown) === 'Text')
          .map(n => StyleSheet.flatten(n.props.style)?.lineHeight ?? 0),
      );
    expect(maxLine('사진 보기, 했어요')).toBe(32);
    expect(maxLine('둘 중 고르기, 했어요')).toBe(32);
    const chevron = screen.getByTestId('icon-chevron-right', {includeHiddenElements: true});
    expect(chevron.props.height).toBeLessThanOrEqual(32);
    fireEvent.press(screen.getByRole('button', {name: '사진 보기, 했어요'}));
    expect(onPress).toHaveBeenCalled();
  });
  test('onPress 가 없으면 누르지 않는 행(› 없음)', () => {
    render(<StepRow title="사진 보기" status="done" statusLabel="했어요" />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByTestId('icon-chevron-right', {includeHiddenElements: true})).toBeNull();
  });
});

async function home(opts: FakeOptions) {
  const api = createFakeApi({linked: true, consented: true, ...opts});
  render(<AppRoot api={api} role="parent" restore />);
  await waitFor(() => screen.getByTestId('date-line'));
  return api;
}

// 보기 전용에서 기록·계측·다시 불러오기가 늘지 않았는지(리뷰 M7-1)
type Fake = ReturnType<typeof createFakeApi>;
function spyAll(api: Fake) {
  return (['recordSessionStep', 'logEvent', 'startToday', 'getTodayContent', 'saveAnswer'] as const).map(k => jest.spyOn(api, k));
}
const counts = (spies: {mock: {calls: unknown[]}}[]) => spies.map(s => s.mock.calls.length);

describe('코스 홈 v4', () => {
  test('"오늘 코스" 제목 없음, 날짜 줄이 화면 제목(머리글)이고 위 영역(시안 ds4b — 200%에서도 첫 화면에 남는다), 단계 행 사이 12', async () => {
    await home({});
    expect(screen.queryByText('오늘 코스')).toBeNull();
    expect(screen.getByTestId('date-line').props.accessibilityRole).toBe('header');
    expect(within(screen.getByTestId('ds-screen-top')).getByTestId('date-line')).toBeTruthy(); // 네이버 패널 r1/4: 돌아와도 날짜·설정이 위로 밀려 사라지지 않게
    expect(within(screen.getByTestId('ds-screen-top')).getByRole('button', {name: '설정'})).toBeTruthy();
    // 본문 간격 12(FoldStack 이 요소 사이 marginTop 으로 준다)
    const kids = (screen.getByTestId('course-steps').children as unknown as {props: {style: unknown}}[]).map(k => StyleSheet.flatten(k.props.style as never)?.marginTop);
    expect(kids.slice(1).every(m => m === 12)).toBe(true);
  });

  test('3/3 완료: 세 행 모두 › 와 하단 "오늘 코스 다시 보기"', async () => {
    await home({completedSteps: ['photo', 'question', 'hangul']});
    expect(screen.getByText('오늘 코스는 여기까지예요. 내일 또 만나요')).toBeTruthy();
    for (const n of ['사진 보기', '둘 중 고르기', '낱말 쓰기']) {
      expect(screen.getByRole('button', {name: `${n}, 했어요`})).toBeTruthy();
    }
    expect(screen.getByRole('button', {name: '오늘 코스 다시 보기'})).toBeTruthy();
  });

  test('다시 보기 → P4 보기 전용: 단계 숨김·돌아가기, 기록·계측·다시 불러오기 0', async () => {
    const api = await home({completedSteps: ['photo', 'question', 'hangul']});
    const spies = spyAll(api);
    const before = counts(spies);
    await press('오늘 코스 다시 보기');
    await waitFor(() => screen.getByLabelText('사진 보기, 다시 보는 중'));
    expect(screen.getByText('마을 입구 나무')).toBeTruthy();
    expect(screen.getByText('사진 보기')).toBeTruthy(); // 보기 전용은 단계 표시 없이 이름만
    expect(screen.queryByText(/1 \/ 3/)).toBeNull();
    expect(screen.queryByRole('button', {name: '다 봤어요'})).toBeNull();
    fireEvent.press(screen.getAllByRole('button', {name: '오늘 코스로'}).slice(-1)[0]);
    await waitFor(() => screen.getByText('오늘 코스는 여기까지예요. 내일 또 만나요'));
    expect(counts(spies)).toEqual(before);
  });

  test('P5 보기 전용: 고른 답 이름표(읽기 "고른 답, 봄"), 바꿀 수 없음, 기록 0', async () => {
    const api = await home({completedSteps: ['photo', 'question', 'hangul'], answeredChoice: 'A'});
    const spies = spyAll(api);
    const before = counts(spies);
    await press('둘 중 고르기, 했어요');
    await waitFor(() => screen.getByLabelText('둘 중 고르기, 다시 보는 중'));
    expect(screen.getByLabelText('고른 답, 봄')).toBeTruthy();
    expect(screen.getByText('가을')).toBeTruthy();
    expect(screen.queryByRole('radio')).toBeNull(); // 누를 수 없음
    expect(screen.queryByRole('button', {name: '정했어요'})).toBeNull();
    fireEvent.press(screen.getAllByRole('button', {name: '오늘 코스로'}).slice(-1)[0]);
    await waitFor(() => screen.getByTestId('date-line'));
    expect(counts(spies)).toEqual(before);
  });

  test('P5 보기 전용: 저장된 답이 없으면(동의 거부) 고른 답 줄을 빼고 문구도 넣지 않는다', async () => {
    await home({completedSteps: ['photo', 'question', 'hangul'], consented: false});
    await press('둘 중 고르기, 했어요');
    await waitFor(() => screen.getByLabelText('둘 중 고르기, 다시 보는 중'));
    expect(screen.queryByText('고른 답')).toBeNull();
  });

  test('P6 보기 전용: "오늘의 낱말이에요" + 낱말(읽기 "오늘의 낱말, 나무"), 입력칸 없음, 기록 0', async () => {
    const api = await home({completedSteps: ['photo', 'question', 'hangul']});
    const spies = spyAll(api);
    const before = counts(spies);
    await press('낱말 쓰기, 했어요');
    await waitFor(() => screen.getByLabelText('낱말 쓰기, 다시 보는 중'));
    expect(screen.getByText('오늘의 낱말이에요', {includeHiddenElements: true})).toBeTruthy(); // 보이는 글, 읽기는 아래 한 덩어리
    expect(screen.getByLabelText('오늘의 낱말, 나무')).toBeTruthy();
    expect(screen.queryByLabelText('낱말 쓰는 칸')).toBeNull();
    expect(screen.queryByRole('button', {name: '다 썼어요'})).toBeNull();
    fireEvent.press(screen.getAllByRole('button', {name: '오늘 코스로'}).slice(-1)[0]);
    await waitFor(() => screen.getByTestId('date-line'));
    expect(counts(spies)).toEqual(before);
  });

  test('보기 전용에서 상단 "‹ 오늘 코스"도 코스 홈으로(하드웨어 뒤로가기와 같은 동작)', async () => {
    await home({completedSteps: ['photo', 'question', 'hangul']});
    await press('사진 보기, 했어요');
    await waitFor(() => screen.getByLabelText('사진 보기, 다시 보는 중'));
    // v4 BackLink '오늘 코스로'(보이는 글 = 읽기). 하단 '돌아가기'는 힌트로 목적지를 읽는다(copy 11-1 #3)
    expect(screen.getByRole('button', {name: '오늘 코스로'}).props.accessibilityHint).toBe('오늘 코스로 돌아가기');
    fireEvent.press(screen.getByRole('link', {name: '오늘 코스로'}));
    await waitFor(() => screen.getByTestId('date-line'));
  });

  test('리드 결정(시안 1:1): 완료 전에도 했어요 행은 눌러 다시 보기(읽기 이름 = 보이는 글, 다시 보기는 힌트), 다음 행은 누르지 않는다', async () => {
    await home({completedSteps: ['photo']});
    const row = screen.getByRole('button', {name: '사진 보기, 했어요'});
    expect(row.props.accessibilityHint).toBe('다시 보기');
    expect(screen.getByRole('button', {name: '둘 중 고르기, 지금 할 차례'})).toBeTruthy();
    expect(screen.queryByRole('button', {name: /낱말 쓰기/})).toBeNull();
    expect(screen.queryByRole('button', {name: '오늘 코스 다시 보기'})).toBeNull();
    await act(async () => fireEvent.press(row));
    await waitFor(() => screen.getByRole('button', {name: '오늘 코스로'})); // 보기 전용 P4(Dock 돌아가기 = copy.review.back)
  });

  test('동의 거부: 날짜 아래 한 줄 띠 "고른 답은 저장되지 않아요" + "다시 정하기"(설정으로)', async () => {
    await home({consented: false});
    expect(screen.getByText('고른 답은 저장되지 않아요')).toBeTruthy();
    const strip = StyleSheet.flatten(screen.getByTestId('course-declined').props.style);
    expect(strip.borderWidth ?? 0).toBe(0);
    await press('다시 정하기');
    await waitFor(() => screen.getByText('가족에게 답 보여 주기'));
  });
});

describe('미연결', () => {
  beforeEach(() => setLocalStampsForTest(createLocalStamps(memoryStore())));
  afterEach(() => setLocalStampsForTest(null));
  async function preview(api = createFakeApi()) {
    render(<AppRoot api={api} />);
    await press(/부모님 휴대폰이에요/);
    await press('코스 보기');
    await waitFor(() => screen.getByTestId('course-strip'));
  }
  test('띠: 날짜 다음·본문 안, 띠 전체가 하나의 버튼, 흰 면·3px 테두리·wrap, 터치 64', async () => {
    await preview();
    const strip = screen.getByTestId('course-strip');
    expect(strip.props.accessibilityRole).toBe('button');
    expect(strip.props.accessibilityLabel).toBe('번호를 받으면 답이 저장돼요, 번호 쓰기'); // R-14: 보이는 글 그대로
    const st = StyleSheet.flatten(typeof strip.props.style === 'function' ? strip.props.style({pressed: false}) : strip.props.style);
    expect(st.borderWidth).toBe(1.5);
    expect(st.minHeight).toBeGreaterThanOrEqual(64);
    expect(within(strip).getByText('번호 쓰기', {includeHiddenElements: true})).toBeTruthy();
    expect(within(strip).getByTestId('icon-chevron-right', {includeHiddenElements: true})).toBeTruthy();
    // 순서: 날짜 줄 다음(R1)
    expect(within(screen.getByTestId('screen-body')).getByTestId('course-strip')).toBeTruthy(); // 본문 맨 위(날짜 줄은 위 영역)
    fireEvent.press(strip);
    await waitFor(() => screen.getByText('가족에게 받은 번호를 써 주세요'));
  });
  test('미연결도 도장 줄이 보이고(기기 로컬, 찍은 날이 있을 때 — 감사 M1), 서버 도장 호출은 없다', async () => {
    await localStamps().addToday();
    const api = createFakeApi();
    const week = jest.spyOn(api, 'getWeekStamps');
    await preview(api);
    await waitFor(() => screen.getByTestId('course-week'));
    expect(week).not.toHaveBeenCalled();
  });
  test('미연결 3/3: 오늘 도장이 기기에 찍히고, P7·P3 문구는 11-7 #19·#18', async () => {
    await preview();
    for (const step of ['다 봤어요', '정했어요']) {
      await pressCourseNext();
      if (step === '정했어요') {
        await waitFor(() => screen.getByText('봄'));
        fireEvent.press(screen.getByText('봄'));
      }
      await waitFor(() => screen.getByRole('button', {name: step}));
      await press(step);
      await waitFor(() => screen.getByTestId('date-line'));
    }
    await pressCourseNext();
    await waitFor(() => screen.getByRole('button', {name: '오늘은 넘어갈게요'}));
    await press('오늘은 넘어갈게요');
    await waitFor(() => screen.getByText(/도장을 찍었어요\.\s*번호를 받으면 그때부터 고른 답이 가족에게 보여요/)); // P7
    expect(screen.getByLabelText(/이번 주 도장, .*찍었어요/)).toBeTruthy();
    await press('알겠어요');
    await waitFor(() => screen.getByText('번호를 받으면 그때부터 고른 답이 가족에게 보여요'));
    expect(screen.getByText('오늘 코스를 마쳤어요')).toBeTruthy();
    expect(screen.getByLabelText(/이번 주 도장, .*찍었어요/)).toBeTruthy();
    expect(await localStamps().read()).toHaveLength(1);
  });
  test('연결된 뒤 첫 로드에서 기기 도장은 지우고 서버 값만 쓴다(옮기지 않음)', async () => {
    await localStamps().addToday();
    const api = createFakeApi({linked: true, consented: true, weekDone: []});
    const week = jest.spyOn(api, 'getWeekStamps');
    render(<AppRoot api={api} role="parent" restore />);
    await waitFor(() => screen.getByTestId('date-line'));
    await waitFor(async () => expect(await localStamps().read()).toEqual([]));
    expect(week).toHaveBeenCalled();
    expect(screen.queryAllByTestId(/^stamp-on-/, {includeHiddenElements: true})).toHaveLength(0);
    expect(screen.queryByText('이번 주 도장')).toBeNull(); // 서버 값 0 → 도장 줄 숨김(감사 M1)
  });
});

describe('보기 전용 재검토(N1·N2·N3, 낮음)', () => {
  function captureBack() {
    const handlers: (() => boolean | null | undefined)[] = [];
    jest.spyOn(BackHandler, 'addEventListener').mockImplementation(((_: string, h: () => boolean) => {
      handlers.push(h);
      return {remove: () => handlers.splice(handlers.indexOf(h), 1)};
    }) as never);
    return async () => {
      await act(async () => {
        for (let i = handlers.length - 1; i >= 0; i--) {
          if (handlers[i]()) {
            break;
          }
        }
      });
    };
  }
  afterEach(() => jest.restoreAllMocks());

  test('N1: 세 보기 전용의 "돌아가기"는 주 버튼(P4 는 v4 시안대로 보조 읽어 주세요가 함께)', async () => {
    await home({completedSteps: ['photo', 'question', 'hangul'], answeredChoice: 'A'});
    for (const [row, label] of [
      ['사진 보기, 했어요', '사진 보기, 다시 보는 중'],
      ['둘 중 고르기, 했어요', '둘 중 고르기, 다시 보는 중'],
      ['낱말 쓰기, 했어요', '낱말 쓰기, 다시 보는 중'],
    ]) {
      await press(row);
      await waitFor(() => screen.getByLabelText(label));
      const dockButton = within(screen.getByTestId('screen-dock')).getByRole('button', {name: /^오늘 코스로$/});
      expect(StyleSheet.flatten(dockButton.props.style).minHeight).toBe(72); // 주 버튼 높이
      fireEvent.press(dockButton);
      await waitFor(() => screen.getByTestId('date-line'));
    }
  });

  test('하드웨어 뒤로가기도 보기 전용에서 코스 홈으로', async () => {
    const back = captureBack();
    await home({completedSteps: ['photo', 'question', 'hangul']});
    await press('둘 중 고르기, 했어요');
    await waitFor(() => screen.getByLabelText('둘 중 고르기, 다시 보는 중'));
    await back();
    await waitFor(() => screen.getByTestId('date-line'));
  });

  test('N2: P6 보기 전용 — 그림·캡션·제목·칸이 한 흰 카드 안, 칸 사이 10, 좁으면 줄어드는 칸', async () => {
    await home({completedSteps: ['photo', 'question', 'hangul'], realImage: true});
    await press('낱말 쓰기, 했어요');
    await waitFor(() => screen.getByLabelText('낱말 쓰기, 다시 보는 중'));
    const card = screen.getByTestId('kb-review-card');
    expect(within(card).getByText('오늘의 낱말이에요', {includeHiddenElements: true})).toBeTruthy();
    expect(within(card).getByLabelText('오늘의 낱말, 나무')).toBeTruthy();
    const cells = StyleSheet.flatten(within(card).getByLabelText('오늘의 낱말, 나무').props.style);
    expect(cells.gap).toBe(10);
    const cell = StyleSheet.flatten(within(card).getByTestId('kb-review-cell-0', {includeHiddenElements: true}).props.style);
    expect(cell.flexShrink).toBe(1);
    expect(cell.maxWidth).toBeGreaterThanOrEqual(64); // 64 × 글자 배율(상한 1.5 → 96)
    expect(cell.maxWidth).toBeLessThanOrEqual(96);
  });

  test('N3: P5 보기 전용(v4) — 질문 title, 선택 칸 최소 높이 96, 고른 칸 체크 아이콘, 이름표 doneInk', async () => {
    await home({completedSteps: ['photo', 'question', 'hangul'], answeredChoice: 'B'});
    await press('둘 중 고르기, 했어요');
    await waitFor(() => screen.getByLabelText('고른 답, 가을'));
    expect(StyleSheet.flatten(screen.getByText('더 좋아하는 계절은요?').props.style).fontSize).toBe(roleText('title', 'elder').style.fontSize);
    const chosen = screen.getByLabelText('고른 답, 가을');
    expect(StyleSheet.flatten(chosen.props.style).minHeight).toBe(96);
    expect(within(chosen).getByTestId('icon-check', {includeHiddenElements: true})).toBeTruthy();
    expect(StyleSheet.flatten(within(chosen).getByText('고른 답', {includeHiddenElements: true}).props.style).color).toBe(ds.color.doneInk);
    expect(StyleSheet.flatten(screen.getByLabelText('봄').props.style).minHeight).toBe(96);
  });
});

describe('기기 도장 정리(낮음)', () => {
  test('설정 "모두 지우기"를 마치면 기기 도장 목록도 지운다', async () => {
    const local = createLocalStamps(memoryStore());
    setLocalStampsForTest(local);
    await toHomeConsented(createFakeApi({consented: true}));
    await local.addToday(); // 연결 뒤 첫 로드에서 지워졌어도 다시 넣어 두고, 삭제 흐름이 지우는지 본다
    await press('설정');
    await press('모두 지우기');
    await waitFor(() => screen.getByText('모두 지울까요?'));
    await confirmDeleteAll();
    await waitFor(() => screen.getByText('모두 지웠어요'));
    await waitFor(async () => expect(await local.read()).toEqual([]));
    setLocalStampsForTest(null);
  });
});
