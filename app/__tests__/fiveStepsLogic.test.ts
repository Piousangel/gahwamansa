// 5단계 로직(스위치와 무관한 순수 함수): 조사 자동(문구 문서 2절), ⑤ 카드 3장 규칙(4.2절), 단계 순서, fake 보기 = 라이터 CSV, 계약 읽기, 문구 값.
declare const __dirname: string;
const fs: {readFileSync(p: string, enc: string): string} = require('fs');
const path: {join(...p: string[]): string} = require('path');
import {fillObject, hasFinalConsonant, objectParticle} from '../src/lib/josa';
import {FAKE_RECALL_OPTIONS} from '../src/features/fakeRecallOptions';
import {
  allStepsDone,
  courseStepNames,
  EMPTY_PICKS,
  FIVE_STEP_ORDER,
  passOnCards,
  passOnLine,
  questionLabelOf,
  recallWordOf,
  stepNumber,
} from '../src/features/course/fiveSteps';
import {PASS_ON_KEYS, parseFiveStepsContent} from '../src/api/contract/fiveSteps';
import {COURSE_ORDER, parentStepAfterOpen} from '../src/push/openRoute';
import {copy} from '../src/copy/copy';
import type {TodayContent} from '../src/features/types';

// CSV(따옴표 안 쉼표 포함) 한 줄 → 칸
function cells(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let q = false;
  for (const ch of line) {
    if (ch === '"') {
      q = !q;
    } else if (ch === ',' && !q) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}
const CSV: string[][] = fs
  .readFileSync(path.join(__dirname, '../../docs/team/copy/2026-11-25-recall-options.csv'), 'utf8')
  .trim()
  .split('\n')
  .slice(1)
  .map(cells);

describe('조사 자동(받침 판정)', () => {
  test('라이터 CSV 90개 보기의 "자녀 줄 조사" 칸과 모두 같다', () => {
    const rows = CSV.flatMap(c => {
      const josa = c[9].split('/');
      return [c[5], c[6], c[7]].map((w, i) => [w, josa[i]] as const);
    });
    expect(rows).toHaveLength(90);
    expect(rows.filter(([w, j]) => objectParticle(w) !== j)).toEqual([]);
  });
  test('예: 누룽지를 · 숨바꼭질을 · 모깃불을(ㄹ 받침도 을)', () => {
    expect(fillObject(copy.child.recall_line, '떠올린 것', '누룽지')).toBe('사진 보고 누룽지를 떠올리셨어요');
    expect(fillObject(copy.child.recall_line, '떠올린 것', '숨바꼭질')).toBe('사진 보고 숨바꼭질을 떠올리셨어요');
    expect(objectParticle('모깃불')).toBe('을');
  });
  test('한글 완성형으로 끝나지 않으면(영문·숫자·빈 값·자모) null → 줄을 그리지 않는다', () => {
    for (const w of ['TV', '7080', '', '  ', 'ㄱ', '라디오!']) {
      expect(hasFinalConsonant(w)).toBeNull();
      expect(fillObject(copy.child.recall_line, '떠올린 것', w)).toBeNull();
    }
  });
  test('조합형(NFD)도 합쳐서 판정한다', () => {
    expect(objectParticle('누룽지'.normalize('NFD'))).toBe('를');
    expect(objectParticle('장작'.normalize('NFD'))).toBe('을');
  });
});

test('fake 콘텐츠의 ② 보기 = 라이터 CSV(날·사진 이름·보기1~3, 글자까지)', () => {
  expect(FAKE_RECALL_OPTIONS.map(r => [String(r[0]), r[1], ...r[2]])).toEqual(CSV.map(c => [c[0], c[1], c[5], c[6], c[7]]));
});

describe('단계 순서', () => {
  test('꺼짐 3단계 / 켜짐 5단계(보기 → 떠올리기 → 고르기 → 쓰기 → 건네기)', () => {
    expect(courseStepNames(false)).toEqual(['photo', 'question', 'hangul']);
    expect(courseStepNames(true)).toEqual(['photo', 'recall', 'question', 'hangul', 'pass_on']);
    expect([1, 2, 3].map(i => courseStepNames(false)[i - 1]).map(s => stepNumber(s, false))).toEqual([1, 2, 3]);
    expect(stepNumber('question', true)).toBe(3);
    expect(stepNumber('hangul', true)).toBe(4);
    expect(allStepsDone(['photo', 'question', 'hangul'], false)).toBe(true);
    expect(allStepsDone(['photo', 'question', 'hangul'], true)).toBe(false);
  });
  test('알림 열기: 5단계 순서를 넘기면 ②·⑤로도 간다(꺼짐 기본은 3단계)', () => {
    const c = (done: string[]) => ({photo: {}, question: {}, completed_steps: done});
    expect(parentStepAfterOpen('daily', c(['photo']), FIVE_STEP_ORDER)).toBe('RecallStep');
    expect(parentStepAfterOpen('daily', c(['photo', 'recall', 'question', 'hangul']), FIVE_STEP_ORDER)).toBe('PassOnStep');
    expect(parentStepAfterOpen('daily', c(['photo']))).toBe('QuestionStep');
    expect(COURSE_ORDER.map(s => s.step)).toEqual(['photo', 'question', 'hangul']);
  });
});

describe('⑤ 카드 3장(문구 문서 4.2)', () => {
  const q = {option_a: '봄', option_b: '가을'};
  test('②·③ 모두 한 날: 떠올린 것 얘기 · 고른 쪽 · 되묻기(+ 보기 두 개 보조 줄)', () => {
    expect(passOnCards('누룽지', '봄', q)).toEqual([
      {key: 'recall_story', text: '누룽지 얘기할게요'},
      {key: 'choice_like', text: '봄, 그게 좋아요'},
      {key: 'ask_which', text: '어느 쪽일지 궁금해요', sub: '봄 · 가을'},
    ]);
  });
  test('②·③ 모두 넘긴 날도 3장(대신 문장), 제목은 그대로', () => {
    expect(passOnCards(null, null, q).map(c => c.text)).toEqual(['사진 보니 옛 생각 나요', '오늘 사진이 좋아요', '어느 쪽일지 궁금해요']);
  });
  test('하나만 넘긴 날: 그 자리만 대신 문장', () => {
    expect(passOnCards('누룽지', null, q).map(c => c.key)).toEqual(['recall_story', 'photo_like', 'ask_which']);
    expect(passOnCards(null, '가을', q).map(c => c.key)).toEqual(['photo_memory', 'choice_like', 'ask_which']);
  });
  test('카드 키는 계약 PASS_ON_KEYS 안에서만', () => {
    const keys = [passOnCards('a', 'b', q), passOnCards(null, null, q)].flat().map(c => c.key);
    expect(keys.every(k => (PASS_ON_KEYS as readonly string[]).includes(k))).toBe(true);
  });
  test('오늘 한 장 "건넨 말": 끼울 값이 없으면 줄을 그리지 않는다', () => {
    expect(passOnLine('recall_story', null, '봄', q)).toBeNull();
    expect(passOnLine('choice_like', '누룽지', null, q)).toBeNull();
    expect(passOnLine('photo_memory', '누룽지', '봄', q)).toEqual({key: 'photo_memory', text: '사진 보니 옛 생각 나요'});
    expect(passOnLine('ask_which', null, null, q)).toEqual({key: 'ask_which', text: '어느 쪽일지 궁금해요', sub: '봄 · 가을'});
  });
});

test('고른 값: 화면에서 고른 값이 먼저, 없으면 서버 저장 값, 넘겼으면 null', () => {
  const content = {
    question: {id: 'q', option_a: '봄', option_b: '가을', prompt: null},
    answered_choice: 'B',
    recall: {options: ['그늘', '참새', '산들바람']},
    recall_choice: 3,
  } as unknown as TodayContent;
  expect(recallWordOf(content, EMPTY_PICKS)).toBe('산들바람');
  expect(recallWordOf(content, {...EMPTY_PICKS, recall: 2})).toBe('참새');
  expect(recallWordOf({...content, recall_choice: null}, EMPTY_PICKS)).toBeNull();
  expect(recallWordOf({...content, recall: null}, {...EMPTY_PICKS, recall: 1})).toBeNull();
  expect(questionLabelOf(content, EMPTY_PICKS)).toBe('가을');
  expect(questionLabelOf(content, {...EMPTY_PICKS, question: 'A'})).toBe('봄');
});

test('계약 읽기: 옛 서버(칸 없음)는 빈 값, 이상한 값은 버린다', () => {
  expect(parseFiveStepsContent({})).toEqual({recall: null, recall_choice: null, pass_on_key: null, pass_on_enabled: false});
  expect(parseFiveStepsContent({recall: {options: ['a', 'b', 'c']}, recall_choice: 2, pass_on_key: 'ask_which', pass_on_enabled: true})).toEqual({
    recall: {options: ['a', 'b', 'c']},
    recall_choice: 2,
    pass_on_key: 'ask_which',
    pass_on_enabled: true,
  });
  expect(parseFiveStepsContent({recall: {options: ['a', 'b']}, recall_choice: 4, pass_on_key: 'hello', pass_on_enabled: 'yes'})).toEqual({
    recall: null,
    recall_choice: null,
    pass_on_key: null,
    pass_on_enabled: false,
  });
});

test('문구: 라이터 확정 값 그대로(five-steps-copy 1절·4.2절)', () => {
  expect(copy.course.step.recall).toBe('떠올려 보기');
  expect(copy.course.step.pass_on).toBe('이야기 건네기');
  expect(copy.recall.question).toBe('이 사진을 보면 무엇이 먼저 떠오르세요?');
  expect(copy.recall.hint).toBe('정답은 없어요');
  expect(copy.recall.confirm).toBe('이걸로 할게요');
  expect(copy.pass_on.title).toBe('가족에게 건넬 한 줄을 골라요');
  expect(copy.pass_on.confirm).toBe('건넬게요');
  expect(copy.keyboard.skip).toBe('오늘은 넘어갈게요'); // ②③⑤ 보조 버튼도 이 키(#2 통일)
  expect(copy.keyboard.guide_recall).toBe('떠올리신 낱말을 아래 칸에 써요');
  expect(copy.course.stop_here).toBe('오늘은 여기까지 할게요');
  expect(copy.done.passed_on).toBe('가족에게 건넸어요');
  expect(copy.course.review_recall).toBe('먼저 떠올리신 것');
  expect(copy.course.review_pass_on).toBe('건넨 말');
  expect([copy.pass_on.recall_story, copy.pass_on.photo_memory, copy.pass_on.choice_like, copy.pass_on.photo_like, copy.pass_on.ask_which]).toEqual([
    '{떠올린 것} 얘기할게요',
    '사진 보니 옛 생각 나요',
    '{고른 쪽}, 그게 좋아요',
    '오늘 사진이 좋아요',
    '어느 쪽일지 궁금해요',
  ]);
  expect(copy.nav.to.RecallStep).toBe('떠올려 보기로');
  expect(copy.nav.to.PassOnStep).toBe('이야기 건네기로');
});
