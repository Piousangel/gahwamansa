// 알림을 눌렀을 때 어디로(순수 함수). 화면 이름은 문자열(ParentStack 라우트와 같음, navStack 테스트가 확인).
// U1(DECISIONS 11-18 승인): 일일 알림 → 오늘 할 단계로 바로. 스택은 [P3 코스 홈, 그 단계] — '이전'을 누르면 P3.
//   이미 다 마친 날·오늘 콘텐츠가 없으면 P3. 미연결·동의 거부여도 같다.
// 응원 도착 → P3(응원은 코스 홈에서 열린다). 자녀 종류(연결·재연결)는 자녀 쪽 처리(features/home/pushOpen).
import type {PushKind} from '../api/contract/push';

export type StepName = 'photo' | 'question' | 'hangul';
export type ParentStepRoute = 'PhotoStep' | 'QuestionStep' | 'KeyboardStep' | 'RecallStep' | 'PassOnStep'; // 뒤 둘: 5단계(기능 스위치 fiveSteps)

// 코스 순서(CourseHome STEPS 와 같아야 한다 — pushOpen 테스트가 비교)
export const COURSE_ORDER: {step: StepName; route: ParentStepRoute}[] = [
  {step: 'photo', route: 'PhotoStep'},
  {step: 'question', route: 'QuestionStep'},
  {step: 'hangul', route: 'KeyboardStep'},
];

/** 어르신 기기에서 처리할 알림인가(아니면 무시) */
export const isParentKind = (k: PushKind) => k === 'daily' || k === 'cheer_arrived';

type ContentLike = {photo: unknown; question: unknown; completed_steps: readonly string[]} | null;

/** 코스 홈 위에 쌓을 단계. null 이면 코스 홈에 머문다. order: 5단계가 켜졌으면 그 순서(PushHost 가 넘긴다), 아니면 3단계 */
export function parentStepAfterOpen(
  kind: PushKind,
  content: ContentLike,
  order: readonly {step: string; route: ParentStepRoute}[] = COURSE_ORDER,
): ParentStepRoute | null {
  if (kind !== 'daily' || !content || !content.photo || !content.question) {
    return null;
  }
  return order.find(s => !content.completed_steps.includes(s.step))?.route ?? null;
}
