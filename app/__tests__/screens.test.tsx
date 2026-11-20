import {StyleSheet} from 'react-native';
import {fireEvent, screen, waitFor} from '@testing-library/react-native';
import {createFakeApi} from '../src/features/fakeApi';
import {press, toHome, pressCourseNext} from '../testUtils/flow';

async function donePhoto() {
  await pressCourseNext();
  await waitFor(() => screen.getByRole('button', {name: '다 봤어요'}));
  await press('다 봤어요');
  await waitFor(() => screen.getByTestId('date-line'));
}

test('사진 화면은 오늘 콘텐츠(2일차)의 설명을 보여 준다', async () => {
  await toHome(createFakeApi({day: 2}));
  await pressCourseNext();
  await waitFor(() => screen.getByText('장날 아침'));
  expect(screen.getByText('사진을 준비하고 있어요')).toBeTruthy();
  expect(screen.queryByText(/AI 옛날 사진/)).toBeNull();
  // 회상 질문 2개를 순서대로 표시
  const a = screen.getByText('장에 가면 제일 먼저 어디를 보셨어요?');
  const b = screen.getByText('장바구니에 꼭 담던 건 뭐예요?');
  expect(a).toBeTruthy();
  expect(b).toBeTruthy();
  expect(StyleSheet.flatten(a.props.style).fontSize).toBeGreaterThanOrEqual(20);
  expect(StyleSheet.flatten(b.props.style).fontSize).toBeGreaterThanOrEqual(20);
});

test('질문 화면은 오늘의 선택지를 보여 주고 고른 답을 미리 표시한다', async () => {
  await toHome(createFakeApi({day: 2, answeredChoice: 'B'}));
  await donePhoto();
  await pressCourseNext();
  await waitFor(() => screen.getByText('시장 구경'));
  expect(screen.getByText('공원 산책')).toBeTruthy();
  expect(screen.getByRole('radio', {name: '공원 산책', checked: true})).toBeTruthy();
  expect(screen.getByRole('radio', {name: '시장 구경', checked: false})).toBeTruthy();
  expect(screen.getByRole('button', {name: '정했어요'})).toBeEnabled();
});

test('아직 안 고른 질문은 아무것도 선택되어 있지 않다', async () => {
  await toHome(createFakeApi({day: 1}));
  await donePhoto();
  await pressCourseNext();
  await waitFor(() => screen.getByText('봄'));
  expect(screen.queryByText('골랐어요')).toBeNull();
});

test('자판으로 쓰기 화면은 오늘의 단어(keyword)를 음절 칸으로 보여 준다', async () => {
  await toHome(createFakeApi({day: 3}));
  await donePhoto();
  await pressCourseNext();
  await waitFor(() => screen.getByText('라디오 듣기'));
  fireEvent.press(screen.getByText('라디오 듣기'));
  await press('정했어요');
  await waitFor(() => screen.getByTestId('date-line'));
  await pressCourseNext();
  await waitFor(() => screen.getByLabelText('따라 쓸 낱말, 라디오')); // P6 v4: 본보기 낱말 한 줄 라벨(시안 ds4b)
});

test('콘텐츠가 없으면 이해하기 쉬운 빈 화면을 보여 준다', async () => {
  await toHome(createFakeApi({empty: true}));
  await waitFor(() => screen.getByText('오늘 사진을 준비하고 있어요'));
  expect(screen.queryByRole('button', {name: '사진 보기'})).toBeNull();
});

test('하루 단위 순환: 콘텐츠 수를 넘기면 1일차로 돌아온다', async () => {
  const api = createFakeApi({day: 4}); // fake 는 3일치 -> 4일차는 1일차 콘텐츠
  const c = await api.getTodayContent();
  expect(c?.photo?.caption).toBe('마을 입구 나무');
});

test('질문 화면(시안 P5 ds4b): 서버 prompt 가 제목, 공통 지시문 줄은 없고 정답은 없어요 한 줄', async () => {
  await toHome(createFakeApi({day: 2}));
  await donePhoto();
  await pressCourseNext();
  await waitFor(() => screen.getByText('나들이를 간다면요?'));
  expect(screen.queryByText('마음에 드는 쪽을 골라 주세요')).toBeNull();
  expect(screen.getByText('정답은 없어요. 마음 가는 쪽을 눌러 주세요')).toBeTruthy();
});

test('prompt 가 null 이면 공통 문장으로 대체한다', async () => {
  await toHome(createFakeApi({day: 2, promptNull: true}));
  await donePhoto();
  await pressCourseNext();
  await waitFor(() => screen.getByText('마음에 드는 쪽을 골라 주세요'));
});

test('콘텐츠 없음 화면에서 다시 보기를 누르면 다시 불러온다', async () => {
  const api = createFakeApi({empty: true});
  const spy = jest.spyOn(api, 'getTodayContent');
  await toHome(api);
  await waitFor(() => screen.getByText('오늘 사진을 준비하고 있어요'));
  await press('다시 보기');
  expect(spy.mock.calls.length).toBeGreaterThanOrEqual(2);
});

test('실제 사진이면 사진 바로 아래 고지 한 줄 "AI가 만든 그림 · 실제 장소가 아니에요"(글자 20, 상한 1.5 — 디자인 #95), 칩 없음', async () => {
  await toHome(createFakeApi({realImage: true}));
  await pressCourseNext();
  const line = await waitFor(() => screen.getByTestId('ai-notice'));
  expect(line).toHaveTextContent('AI가 만든 그림 · 실제 장소가 아니에요');
  expect(StyleSheet.flatten(line.props.style).fontSize).toBeGreaterThanOrEqual(20);
  expect(line.props.maxFontSizeMultiplier).toBe(1.5);
  expect(screen.queryByTestId('photo-ai-chip', {includeHiddenElements: true})).toBeNull();
});

test('자리표시 사진에는 AI 표기가 없다', async () => {
  await toHome(createFakeApi());
  await pressCourseNext();
  await waitFor(() => screen.getByText('사진을 준비하고 있어요'));
  expect(screen.queryByText('AI가 만든 그림')).toBeNull();
});
