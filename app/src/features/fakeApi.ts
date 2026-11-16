import {OfflineError} from './types';
import type {Api, RedeemResult, StepName, TodayContent} from './types';
import type {FailReason} from '../copy/copy';

const FAIL_CODES: Record<string, FailReason> = {
  '000000': 'used', '111111': 'expired', '222222': 'rate_limited', '333333': 'busy',
  '444444': 'already_linked', '555555': 'not_parent_device',
};

// writer.md 1~3일차 샘플. 서버처럼 (day-1) % 개수 로 순환한다.
const FAKE_CONTENT = [
  {caption: '마을 입구 나무', keyword: '나무', a: '봄', b: '가을', prompt: '더 좋아하는 계절은요?',
    recall: ['이 나무 아래서 쉬어 본 적 있으세요?', '어떤 계절의 나무가 떠오르세요?']},
  {caption: '장날 아침', keyword: '바구니', a: '시장 구경', b: '공원 산책', prompt: '나들이를 간다면요?',
    recall: ['장에 가면 제일 먼저 어디를 보셨어요?', '장바구니에 꼭 담던 건 뭐예요?']},
  {caption: '라디오가 있던 방', keyword: '라디오', a: '라디오 듣기', b: '텔레비전 보기', prompt: '편한 쪽은요?',
    recall: ['라디오에서 나오던 소리 중 기억나는 게 있어요?', '어디서 들으셨어요?']},
];

export type FakeOptions = {
  day?: number; // 오늘이 며칠째인지(테스트에서 주입)
  empty?: boolean; // 콘텐츠 없음
  promptNull?: boolean; // 질문 문장이 없는 경우
  answeredChoice?: 'A' | 'B' | null; // 이미 고른 답
  questionNull?: boolean; // 번호 구멍으로 question 이 null
  consented?: boolean; // 서버에 이미 동의한 상태
  linked?: boolean; // 이미 연결된 기기
  completedSteps?: StepName[]; // 오늘 이미 끝낸 단계
  streak?: number;
  failRecord?: number; // recordSessionStep 이 처음 N번 실패
  failChildHome?: number; // fetchChildHome 이 처음 N번 실패
};

// in-memory 가짜 구현. '123456' 만 성공, 위 표의 코드는 각 reason, 나머지는 invalid.
export function createFakeApi(opts: FakeOptions = {}): Api {
  let answered: 'A' | 'B' | null = opts.answeredChoice ?? null;
  const steps = new Set<StepName>(opts.completedSteps ?? []);
  let consented = opts.consented ?? false;
  let failRecord = opts.failRecord ?? 0;
  let failChildHome = opts.failChildHome ?? 0;
  const baseStreak = opts.streak ?? 0;
  let issued = 0;
  return {
    async createFamily() {
      return {family_id: 'fam-1', profile_id: 'child-1'};
    },
    async issueInviteCode() {
      issued += 1;
      return String(100000 + issued * 7).slice(0, 6);
    },
    async redeemInviteCode(code): Promise<RedeemResult> {
      if (code === '123456') return {ok: true, family_id: 'fam-1', profile_id: 'parent-1'};
      const reason = FAIL_CODES[code] ?? 'invalid';
      return reason === 'rate_limited'
        ? {ok: false, reason, retry_after_sec: 600}
        : {ok: false, reason};
    },
    async restoreSession() {
      return opts.linked ? 'linked' : 'unlinked';
    },
    async giveConsent() {
      consented = true;
    },
    async getTodayContent(): Promise<TodayContent | null> {
      if (opts.empty) {
        return null;
      }
      const idx = ((opts.day ?? 1) - 1) % FAKE_CONTENT.length;
      const c = FAKE_CONTENT[idx];
      return {
        day_index: idx + 1,
        photo: {caption: c.caption, image_url: `pending://day-${idx + 1}`, keyword: c.keyword, recall_questions: c.recall},
        question: opts.questionNull ? null : {id: `q-${idx + 1}`, option_a: c.a, option_b: c.b, prompt: opts.promptNull ? null : c.prompt},
        answered_choice: answered,
        consented,
        completed_steps: [...steps],
        streak: steps.size === 3 ? Math.max(1, baseStreak) : baseStreak,
      };
    },
    async saveAnswer({choice}) {
      answered = choice;
    },
    async recordSessionStep(step) {
      if (failRecord > 0) {
        failRecord -= 1;
        throw new OfflineError('offline');
      }
      steps.add(step);
      const completed = steps.size === 3;
      return {completed, streak: completed ? Math.max(1, baseStreak) : baseStreak, steps: [...steps]};
    },
    async fetchChildHome() {
      if (failChildHome > 0) {
        failChildHome -= 1;
        throw new OfflineError('offline');
      }
      return {participatedToday: steps.size === 3, streak: steps.size === 3 ? 1 : 0};
    },
  };
}
