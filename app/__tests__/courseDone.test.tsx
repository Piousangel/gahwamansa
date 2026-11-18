import {screen, waitFor} from '@testing-library/react-native';
import {press, pressCourseNext, toHomeConsented} from '../testUtils/flow';
import {createFakeApi, FakeOptions} from '../src/features/fakeApi';
import {kstWeekdayIndex} from '../src/features/course/stamps';

// P7 코스 완료(시안 P7_done). 마지막 단계(자판으로 쓰기)를 마치면 한 번 보이고, 알겠어요 → 코스 홈.
async function finishCourse(opts: FakeOptions = {}, prepare?: (api: ReturnType<typeof createFakeApi>) => void) {
  const api = createFakeApi({linked: true, consented: true, completedSteps: ['photo', 'question'], ...opts});
  prepare?.(api);
  await toHomeConsented(api);
  await pressCourseNext();
  await waitFor(() => screen.getByLabelText('낱말 쓰는 칸'));
  await press('오늘은 넘어갈게요');
  await waitFor(() => screen.getByText('오늘 코스를 마쳤어요'));
  return api;
}
const today = kstWeekdayIndex();
const WEEKDAYS_A11Y = ['월요일', '화요일', '수요일', '목요일', '금요일', '토요일', '일요일'];

test('이번 주 첫 도장: 해님(하트 없음)·제목·도장 줄(오늘 칸)·"오늘 첫 도장을 찍었어요"', async () => {
  await finishCourse();
  // 해님은 U0 sun-happy(하트 없음). 그림 문자열에 하트 경로(state-done·sun-cheer)가 없다
  const svgs = screen.UNSAFE_root.findAll(n => typeof n.props?.xml === 'string');
  expect(svgs.length).toBeGreaterThan(0);
  for (const s of svgs) {
    expect(s.props.xml).not.toContain('M34 90C30');
  }
  await waitFor(() => screen.getByText(/오늘 첫 도장을 찍었어요\.\s*내일 새 사진이 와요/));
  expect(screen.getByLabelText(`이번 주 도장, ${WEEKDAYS_A11Y[today]}에 찍었어요`)).toBeTruthy();
  expect(screen.getAllByTestId(`stamp-on-${today}`, {includeHiddenElements: true}).length).toBeGreaterThan(0);
  expect(screen.queryByText(/연속|잘하셨|최고/)).toBeNull(); // 숫자 연속·칭찬 없음
});

test('이번 주 다른 날에도 찍었으면 "도장을 찍었어요. 내일 또 만나요"', async () => {
  const other = today === 0 ? 1 : 0;
  await finishCourse({weekDone: [other]});
  await waitFor(() => screen.getByText(/^도장을 찍었어요\.\s*내일 새 사진이 와요/));
  expect(screen.getByLabelText(`이번 주 도장, ${[other, today].sort((a, b) => a - b).map(i => WEEKDAYS_A11Y[i]).join(', ')}에 찍었어요`)).toBeTruthy();
  expect(screen.queryByText('오늘 첫 도장을 찍었어요')).toBeNull();
});

test('도장을 못 받아 오면 도장 줄만 숨기고 완료 문구는 그대로', async () => {
  await finishCourse({}, api => {
    jest.spyOn(api, 'getWeekStamps').mockRejectedValue(new Error('x'));
  });
  await waitFor(() => screen.getByText(/^도장을 찍었어요\.\s*내일 새 사진이 와요/));
  expect(screen.queryByLabelText(/이번 주 도장/)).toBeNull();
});

test('알겠어요 → 코스 홈(다 마친 상태)', async () => {
  await finishCourse();
  await press('알겠어요');
  await waitFor(() => screen.getByTestId('date-line'));
  expect(screen.getByText('오늘 코스는 여기까지예요. 내일 또 만나요')).toBeTruthy(); // 코스 홈의 완료 줄(P3 v4)
  expect(screen.getByRole('button', {name: '오늘 코스 다시 보기'})).toBeTruthy(); // 다 마치면 하단은 다시 보기(P3 v4)
});
