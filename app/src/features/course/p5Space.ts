// P5 둘 중 고르기 공간 단계(독립 감사 H2 → 디자인 판정 9절, 2026-11-18). React 를 모르는 순수 계산.
// 기준: 가용 높이(상태 바·제스처 제외)에서 카드 2장과 '정했어요'가 스크롤 없이 보여야 한다. 빠듯하면 다음 단계로(여유 16).
//  0 다 보임 → 1 '정답은 없어요…'·'오늘 코스로' 숨김 → 2 지시문 숨김 → 3 카드 132→96(사이 14→12)
//  → 4 '하나를 골라 주세요'는 읽기 힌트로만 → 5 본문 스크롤(320×640·150% 이상).
// 예산(디자인 판정 계산, 글자 100%): 0단계 706 · 1단계 612 · 2단계 590 · 3단계 518 · 4단계 476.
// 기대(예산 테스트): S25 가용 780 → 0, 360×740 가용 약 700 → 1, 360×640 가용 약 600 → 3.
export type P5Level = 0 | 1 | 2 | 3 | 4 | 5;

const MARGIN = 16; // 측정 오차 여유(빠듯하면 다음 단계)
const TOP = 64 + 36; // 이전 바 + 단계 이름·'2 / 3'
const QUESTION = 38 + 16; // 질문(제목 28, 줄 높이 38) + 간격
const INSTRUCTION = 22; // 지시문 한 줄(보조 20) — 2단계에서 숨김
const HINT_AND_LINK = 94; // '정답은 없어요…' 30 + '오늘 코스로' 64 — 1단계에서 숨김
const CARDS = 132 * 2 + 14; // 3단계 전
const CARDS_COMPACT = 96 * 2 + 14; // 3단계부터(디자인 계산 518 기준. 실제 사이는 12라 2 여유)
const AFTER = 16;
const REASON = 30 + 12; // 하단 '하나를 골라 주세요' — 4단계에서 화면에서 뺌
const BUTTON = 72 + 28; // '정했어요' + 하단 여백

export function p5Need(level: P5Level): number {
  return (
    TOP +
    QUESTION +
    (level < 2 ? INSTRUCTION : 0) +
    (level < 1 ? HINT_AND_LINK : 0) +
    (level < 3 ? CARDS : CARDS_COMPACT) +
    AFTER +
    (level < 4 ? REASON : 0) +
    BUTTON
  );
}

/** 가용 높이·글자 배율 → 단계. 글자가 크면 같은 구성이 그만큼 높아진다고 보고(보수적) 판단한다. */
export function p5Level(available: number, fontScale = 1): P5Level {
  const k = Math.max(1, fontScale);
  for (const level of [0, 1, 2, 3, 4] as const) {
    if (p5Need(level) * k + MARGIN <= available) {
      return level;
    }
  }
  return 5;
}
