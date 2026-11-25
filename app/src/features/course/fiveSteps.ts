// 오늘 코스 5단계(기능 스위치 fiveSteps, 기본 꺼짐) — 단계 순서·값 고르기·⑤ 문장 만들기 한 곳.
// 근거: DECISIONS 2026-11-25 '3단계 → 5단계'·'5단계 화면 결정'·'5단계 문구 확정', docs/team/copy/2026-11-25-five-steps-copy.md.
// 5단계로 도는 조건 = 스위치 켜짐 + 서버가 지원(get_today_content.five_steps_supported, 0061). 둘 중 하나라도 아니면 옛 3단계(LEGACY_STEPS)
// — 3단계 화면은 한 줄도 바뀌지 않는다. 화면은 세션의 five(AppRoot 가 계산)를 읽는다.
import {useSyncExternalStore} from 'react';
import {isFeatureOn, subscribeFeatures} from '../../lib/features';
import {copy} from '../../copy/copy';
import type {PassOnKey} from '../../api/contract/fiveSteps';
import type {LegacyStepName, StepName, TodayContent} from '../types';

export type StepRoute = 'PhotoStep' | 'RecallStep' | 'QuestionStep' | 'KeyboardStep' | 'PassOnStep';
export type StepEntry = {readonly step: StepName; readonly route: StepRoute};

/** 옛 3단계(서버 완료 판정 R-3 '옛 3단계 모두 포함'의 기준이기도 하다) */
export const LEGACY_STEPS: readonly LegacyStepName[] = ['photo', 'question', 'hangul'];
/** 5단계 순서: 보기 → 떠올리기 → 고르기 → 쓰기 → 건네기(R-1 안 A) */
export const FIVE_STEP_ORDER: readonly StepEntry[] = [
  {step: 'photo', route: 'PhotoStep'} as const,
  {step: 'recall', route: 'RecallStep'} as const,
  {step: 'question', route: 'QuestionStep'} as const,
  {step: 'hangul', route: 'KeyboardStep'} as const,
  {step: 'pass_on', route: 'PassOnStep'} as const,
];
const FIVE_NAMES: readonly StepName[] = FIVE_STEP_ORDER.map(s => s.step);

export const isLegacyStep = (s: StepName): s is LegacyStepName => (LEGACY_STEPS as readonly string[]).includes(s);

/** 스위치만(서버 지원 여부는 따로) */
export const fiveStepsOn = (): boolean => isFeatureOn('fiveSteps');

/** 스위치만 읽는 훅(개발자 메뉴가 바꾸면 다시 그린다). 화면은 이것 대신 세션 five(스위치 + 서버 지원)를 쓴다 */
export function useFiveSteps(): boolean {
  return useSyncExternalStore(subscribeFeatures, fiveStepsOn, fiveStepsOn);
}

/** 5단계로 도는가: 스위치 켜짐 + 오늘 콘텐츠가 5단계를 지원(옛 서버면 키가 없다 → 3단계) */
export const fiveStepsActive = (switchOn: boolean, content: TodayContent | null | undefined): boolean =>
  switchOn && content?.five_steps_supported === true;

/** 오늘 코스 단계 이름(순서대로) */
export const courseStepNames = (five: boolean): readonly StepName[] => (five ? FIVE_NAMES : LEGACY_STEPS);

/** 단계 번호(1부터). 꺼짐: 사진 1 · 고르기 2 · 쓰기 3 그대로 */
export const stepNumber = (step: StepName, five: boolean): number => courseStepNames(five).indexOf(step) + 1;

/** 오늘 코스를 다 했나(넘어간 단계도 '했어요') */
export const allStepsDone = (done: readonly StepName[], five: boolean): boolean => courseStepNames(five).every(s => done.includes(s));

/**
 * 이 기기 화면에서 고른 값(세션). 저장은 동의한 경우만 하지만 ④ 낱말·⑤ 카드는 고른 값을 그대로 쓴다(어르신 본인 화면).
 * day = 고른 날의 day_index(날이 바뀌면 비운다). recall = ② 보기 slot. 넘긴 단계는 서버 skipped_steps(content)가 기억한다
 */
export type CoursePicks = {day: number | null; recall: number | null; question: 'A' | 'B' | null; passOn: PassOnKey | null};
export const EMPTY_PICKS: CoursePicks = Object.freeze({day: null, recall: null, question: null, passOn: null});

/** 넘긴 단계(서버 skipped_steps, 화면 반영 포함) */
export const skippedOf = (content: TodayContent | null | undefined): readonly StepName[] => content?.skipped_steps ?? [];

/** ②에서 고른 낱말(화면에서 고른 slot → 서버 저장 picked_slot 순). 넘겼거나 보기가 없으면 null */
export function recallWordOf(content: TodayContent | null | undefined, picks: CoursePicks): string | null {
  const opts = content?.recall?.options;
  if (!opts || opts.length === 0) {
    return null;
  }
  const slot = picks.recall ?? content?.recall?.picked_slot ?? null;
  return slot == null ? null : opts.find(o => o.slot === slot)?.label ?? null;
}

/** ③에서 고른 쪽의 글(화면에서 고른 값 → 저장된 답 순). 넘겼으면 null */
export function questionLabelOf(content: TodayContent | null | undefined, picks: CoursePicks): string | null {
  const q = content?.question;
  const c = picks.question ?? content?.answered_choice ?? null;
  return q && c ? (c === 'A' ? q.option_a : q.option_b) : null;
}

const fill = (tpl: string, vars: Record<string, string>) => Object.keys(vars).reduce((s, k) => s.split(`{${k}}`).join(vars[k]), tpl);
const p = copy.pass_on;

export type PassOnCard = {key: PassOnKey; text: string; sub?: string};

/**
 * ⑤ 카드 3장(문구 문서 4.2): 자리 1 = ②를 고른 날 recall_story / 넘긴 날 photo_memory,
 * 자리 2 = ③을 고른 날 choice_like / 넘긴 날 photo_like, 자리 3 = ask_which(보조 줄 '③ 보기 A · B'). 늘 3장, 이 순서.
 */
export function passOnCards(recallWord: string | null, choiceLabel: string | null, q: {option_a: string; option_b: string} | null | undefined): PassOnCard[] {
  const first: PassOnCard = recallWord ? {key: 'recall_story', text: fill(p.recall_story, {'떠올린 것': recallWord})} : {key: 'photo_memory', text: p.photo_memory};
  const second: PassOnCard = choiceLabel ? {key: 'choice_like', text: fill(p.choice_like, {'고른 쪽': choiceLabel})} : {key: 'photo_like', text: p.photo_like};
  const third: PassOnCard = q ? {key: 'ask_which', text: p.ask_which, sub: fill(p.ask_which_sub, {'보기 A': q.option_a, '보기 B': q.option_b})} : {key: 'ask_which', text: p.ask_which};
  return [first, second, third];
}

/** 저장된 키 → 그날 값으로 같은 문장(오늘 한 장 '건넨 말'). 끼울 값이 없으면 null(빈 문장을 보이지 않는다, 문구 문서 4.2) */
export function passOnLine(key: PassOnKey, recallWord: string | null, choiceLabel: string | null, q: {option_a: string; option_b: string} | null | undefined): PassOnCard | null {
  if ((key === 'recall_story' && !recallWord) || (key === 'choice_like' && !choiceLabel)) {
    return null;
  }
  const card = passOnCards(recallWord, choiceLabel, q).find(c => c.key === key);
  if (card) {
    return card;
  }
  return key === 'photo_memory' ? {key, text: p.photo_memory} : key === 'photo_like' ? {key, text: p.photo_like} : null;
}
