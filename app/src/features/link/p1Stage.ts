// P1 번호 화면 공간 단계 판정(순수 함수, 리드 결정 11-19 — 재확인 1~3 의 onLayout 경쟁 상태를 구조적으로 없앤다).
// 입력은 결정적인 값(창 크기·글자 배율·inset·문구 길이)뿐. onLayout 은 판정 입력이 아니라 사후 검증(넘치면 한 단계, 최대 1회)으로만 쓴다.
// 단계(디자인 9절 H3, b2cc65d): 0 그대로 → 1 제목 28→22 → 2 약관 줄 본문 끝 → 3 링크 줄도 키패드 아래(하단 고정 없음) → 4 키 64 + 스크롤.
// 2·3단계의 약관·링크는 첫 화면 밖(묶음 아래), 묶음은 창 − 위 여백 − 아래 흐림(− 하단 고정이 없으면 아래 inset).
// React·RN 을 모른다(값만). 수치 출처는 ui/Screen·ui/CodeInput·ui/tokens 의 실제 스타일.
import {BELOW_LINE_H, KEY_MIN, keypadKeyHeight} from './keypadFit';
import {FONT_SCALE_MAX, FONT_SCALE_MAX_BODY, lineHeightFor} from '../../ui/tokens';

export type StageInput = {
  windowH: number;
  windowW: number;
  fontScale: number;
  insets: {top: number; bottom: number};
  /** 문구(화면이 copy 에서 넘긴다). 폭은 글자 종류별로 어림한다 */
  text: {title: string; safe: string; below: string; legal: string; links: [string, string]};
};
export type Stage = {level: 0 | 1 | 2 | 3 | 4; keyH: number};

// ui 수치(바뀌면 여기도): 위 TopSafe 52·상단 12(Screen topPad), 이전 바 64(touchMin), 본문 위 4·좌우 24·아래 24·간격 16,
// 하단 고정 위 6·아래 max(28, 16+inset), 링크 줄 64(TextLink touch), 링크 사이 24, 흐림 28
const TOP_SAFE_MIN = 52;
const TOP_GAP = 12;
const BACK_BAR = 64;
const BODY_TOP = 4;
const BODY_X = 24;
const BODY_BOTTOM = 24;
const GAP = 16;
const DOCK_TOP = 6;
const LINK_ROW = 64;
const LINK_GAP = 24;
export const P1_FADE = 28;
// 글자 폭 어림(글자 크기 대비): 한글 등 전각 0.98, 숫자·영문 0.6, 띄어쓰기 0.3. 에뮬레이터 실측(360dp 제목 22 한 줄)과 맞춘 값
const em = (text: string) => [...text].reduce((w, c) => w + (c === ' ' ? 0.3 : /[0-9A-Za-z.,?!]/.test(c) ? 0.6 : 0.98), 0);

const scaled = (size: number, fontScale: number) => size * Math.min(fontScale, size >= 28 ? FONT_SCALE_MAX : FONT_SCALE_MAX_BODY);
/** 여러 줄 글의 높이(줄 수 × 줄 높이, 줄 높이도 글자 배율만큼 커진다) */
export function textHeight(text: string, size: number, fontScale: number, width: number): number {
  const fs = scaled(size, fontScale);
  const lines = Math.max(1, Math.ceil((em(text) * fs) / Math.max(1, width)));
  return lines * lineHeightFor(size) * (fs / size);
}

function dockHeight(level: number, x: StageInput, width: number): number {
  if (level >= 3) {
    return 0;
  }
  const linkFs = scaled(20, Math.min(x.fontScale, FONT_SCALE_MAX)); // TextLink 글자 배율 상한 1.5
  const linksW = (em(x.text.links[0]) + em(x.text.links[1])) * linkFs + LINK_GAP;
  const links = linksW > width ? 2 * LINK_ROW : LINK_ROW;
  const legal = level >= 2 ? 0 : textHeight(x.text.legal, 20, x.fontScale, width);
  return DOCK_TOP + links + legal + Math.max(28, 16 + x.insets.bottom);
}

/** 그 단계에서 키패드 영역(묶음 안 제목·안심 줄 아래)에 남는 높이 */
export function areaFor(level: number, x: StageInput): number {
  const width = x.windowW - 2 * BODY_X;
  const top = Math.max(TOP_SAFE_MIN, x.insets.top + TOP_GAP) + BACK_BAR;
  const title = textHeight(x.text.title, level >= 1 ? 22 : 28, x.fontScale, width);
  const safe = textHeight(x.text.safe, 20, x.fontScale, width);
  const scroll = level >= 2;
  const below = scroll ? P1_FADE + (level >= 3 ? x.insets.bottom : 0) : BODY_BOTTOM; // 2·3단계는 흐림, 0·1단계는 본문 아래 여백
  return x.windowH - top - dockHeight(level, x, width) - BODY_TOP - title - GAP - safe - GAP - below;
}

/** 칸 아래 안내 한 줄의 높이(글자 배율·폭에 따라 두 줄이 될 수 있다) */
export const belowLineH = (x: StageInput) => Math.max(BELOW_LINE_H, textHeight(x.text.below, 20, x.fontScale, x.windowW - 2 * BODY_X) + 4);

/** 키 4줄이 64 이상으로 들어가는 첫 단계. 없으면 4단계(키 64 + 스크롤) */
export function pickStage(x: StageInput): Stage {
  const belowH = belowLineH(x);
  for (const level of [0, 1, 2, 3] as const) {
    const k = keypadKeyHeight(areaFor(level, x) - belowH);
    if (k !== null) {
      return {level, keyH: k};
    }
  }
  return {level: 4, keyH: KEY_MIN};
}

/** 그 단계의 키 높이(64~68). 들어가지 않으면 64(사후 검증으로 올린 단계·4단계) */
export function keyFor(level: number, x: StageInput): number {
  return level >= 4 ? KEY_MIN : keypadKeyHeight(areaFor(level, x) - belowLineH(x)) ?? KEY_MIN;
}

/** 2·3단계 첫 화면 묶음 높이(창을 아직 못 쟀을 때의 어림 — 판정에는 쓰지 않는다) */
export function firstBlockGuess(level: number, x: StageInput): number {
  const width = x.windowW - 2 * BODY_X;
  const top = Math.max(TOP_SAFE_MIN, x.insets.top + TOP_GAP) + BACK_BAR;
  return Math.max(0, x.windowH - top - dockHeight(level, x, width) - BODY_TOP - P1_FADE - (level >= 3 ? x.insets.bottom : 0));
}
