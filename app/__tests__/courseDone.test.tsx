import {screen, waitFor} from '@testing-library/react-native';
import {press, toHomeConsented} from '../testUtils/flow';
import {createFakeApi, FakeOptions} from '../src/features/fakeApi';
import {kstWeekdayIndex} from '../src/features/course/stamps';

// P7 코스 완료(시안 P7_done). 마지막 단계(자판으로 쓰기)를 마치면 한 번 보이고, 알겠어요 → 코스 홈.
async function finishCourse(opts: FakeOptions = {}, prepare?: (api: ReturnType<typeof createFakeApi>) => void) {
  const api = createFakeApi({linked: true, consented: true, completedSteps: ['photo', 'question'], ...opts});
  prepare?.(api);
  await toHomeConsented(api);
  await press('이어서 하기');
  await waitFor(() => screen.getByLabelText('낱말 쓰는 칸'));
  await press('오늘은 넘어갈게요');
  await waitFor(() => screen.getByText('오늘 코스를 마쳤어요'));
  return api;
}
const today = kstWeekdayIndex();

test('이번 주 첫 도장: 해님(하트 없음)·제목·도장 줄(오늘 칸)·"오늘 첫 도장을 찍었어요"', async () => {
  await finishCourse();
  const sun = screen.getByTestId('sun-done', {includeHiddenElements: true});
  expect(sun.props.xml).not.toContain('M34 90C30'); // state-done 의 작은 하트 경로
  await waitFor(() => screen.getByText('오늘 첫 도장을 찍었어요'));
  expect(screen.getByLabelText('이번 주 도장 1개')).toBeTruthy();
  expect(screen.getAllByTestId(`stamp-on-${today}`, {includeHiddenElements: true}).length).toBeGreaterThan(0);
  expect(screen.queryByText(/연속|잘하셨|최고/)).toBeNull(); // 숫자 연속·칭찬 없음
});

test('이번 주 다른 날에도 찍었으면 "도장을 찍었어요. 내일 또 만나요"', async () => {
  await finishCourse({weekDone: [today === 0 ? 1 : 0]});
  await waitFor(() => screen.getByText(/도장을 찍었어요\.\s*내일 또 만나요/));
  expect(screen.getByLabelText('이번 주 도장 2개')).toBeTruthy();
  expect(screen.queryByText('오늘 첫 도장을 찍었어요')).toBeNull();
});

test('도장을 못 받아 오면 도장 줄만 숨기고 완료 문구는 그대로', async () => {
  await finishCourse({}, api => {
    jest.spyOn(api, 'getWeekStamps').mockRejectedValue(new Error('x'));
  });
  await waitFor(() => screen.getByText(/도장을 찍었어요\.\s*내일 또 만나요/));
  expect(screen.queryByLabelText(/이번 주 도장/)).toBeNull();
});

test('알겠어요 → 코스 홈(다 마친 상태)', async () => {
  await finishCourse();
  await press('알겠어요');
  await waitFor(() => screen.getByText('오늘의 코스'));
  expect(screen.getByText('오늘 코스를 마쳤어요')).toBeTruthy(); // 코스 홈의 완료 줄
  expect(screen.queryByRole('button', {name: '이어서 하기'})).toBeNull();
});
