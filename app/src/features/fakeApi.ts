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
};

// in-memory 가짜 구현. '123456' 만 성공, 위 표의 코드는 각 reason, 나머지는 invalid.
export function createFakeApi(opts: FakeOptions = {}): Api {
  let answered: 'A' | 'B' | null = opts.answeredChoice ?? null;
  const steps = new Set<StepName>();
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
    async giveConsent() {},
    async getTodayContent(): Promise<TodayContent | null> {
      if (opts.empty) {
        return null;
      }
      const idx = ((opts.day ?? 1) - 1) % FAKE_CONTENT.length;
      const c = FAKE_CONTENT[idx];
      return {
        day_index: idx + 1,
        photo: {caption: c.caption, image_url: `pending://day-${idx + 1}`, keyword: c.keyword, recall_questions: c.recall},
        question: {id: `q-${idx + 1}`, option_a: c.a, option_b: c.b, prompt: opts.promptNull ? null : c.prompt},
        answered_choice: answered,
      };
    },
    async saveAnswer({choice}) {
      answered = choice;
    },
    async recordSessionStep(step) {
      steps.add(step);
      const completed = steps.size === 3;
      return {completed, streak: completed ? 1 : 0};
    },
    async fetchChildHome() {
      return {participatedToday: steps.size === 3, streak: steps.size === 3 ? 1 : 0};
    },
  };
}
