// 기획 v2.1 표 [6] 앱: 서버 0068 child_summary parents[].month(자녀 홈 '최근 한 달 고르신 것') 파싱 + P2 v6 동의 문구.
// 계약(dev-server-notes §1 child_summary month): v6 이상 동의 어르신만 키가 생긴다. 값 = child_answer_history answers[] 모양 + care.
// 키가 없거나 모양이 틀리면 month 는 undefined → 앱은 지금 화면(날짜 카드) 그대로.
import {parseMonth} from '../src/api/contract/month';
import {createRealApi} from '../src/features/realApi';
import {createFakeApi} from '../src/features/fakeApi';
import {CONSENT_VERSION, copy} from '../src/copy/copy';

const social = {init: jest.fn(), kakao: jest.fn(), google: jest.fn(), signOut: jest.fn(() => Promise.resolve()), unlinkKakao: jest.fn()};
const sbOf = (data: unknown) => ({rpc: jest.fn(() => Promise.resolve({data, error: null})), auth: {getSession: jest.fn()}}) as never;

const ROW = {session_date: '2026-11-25', prompt: '나들이를 간다면요?', prompt_short: '시장 구경과 공원 산책 중', option_a: '시장 구경', option_b: '공원 산책', choice_label: '시장 구경', care: '가까운 시장 같이 구경 가기'};

describe('parseMonth', () => {
  test('배열이면 항목마다 날짜·짧은 질문·두 보기·고르신 보기·챙겨 드릴 거리', () => {
    expect(parseMonth([ROW, {...ROW, session_date: '2026-11-24', prompt_short: undefined, option_a: '봄', option_b: '가을', choice_label: '가을', care: null}])).toEqual([
      {answeredDate: '2026-11-25', promptShort: '시장 구경과 공원 산책 중', optionA: '시장 구경', optionB: '공원 산책', choiceLabel: '시장 구경', care: '가까운 시장 같이 구경 가기'},
      {answeredDate: '2026-11-24', promptShort: '봄과 가을 중', optionA: '봄', optionB: '가을', choiceLabel: '가을', care: null}, // 짧은 질문이 없으면 두 보기로 만든다
    ]);
  });

  test('빈 배열은 빈 목록(빈 상태 문구), 키 없음은 undefined(지금 화면)', () => {
    expect(parseMonth([])).toEqual([]);
    expect(parseMonth(undefined)).toBeUndefined();
    expect(parseMonth(null)).toBeUndefined();
  });

  test('잘못된 모양: 배열이 아니면 undefined, 항목이 틀리면 그 항목만 뺀다', () => {
    expect(parseMonth({rows: [ROW]})).toBeUndefined();
    expect(parseMonth('[]')).toBeUndefined();
    expect(
      parseMonth([
        ROW,
        null,
        'x',
        {...ROW, session_date: '어제'}, // 날짜 꼴 아님
        {...ROW, choice_label: ''}, // 고르신 보기 없음
        {...ROW, prompt_short: undefined, option_a: undefined}, // 질문을 만들 수 없음
      ])?.map(m => m.answeredDate),
    ).toEqual(['2026-11-25']);
  });

  test('care 는 글자가 있을 때만(빈 글자·숫자·공백은 null — 줄을 숨긴다)', () => {
    expect(parseMonth([{...ROW, care: ''}, {...ROW, care: '  '}, {...ROW, care: 3}, {...ROW, care: undefined}])?.map(m => m.care)).toEqual([null, null, null, null]);
  });

  test('서버가 순서를 바꿔 보내도 앱은 날짜 내림차순 그대로 둔다(순위·묶음 없음 — 다시 정렬하지 않음)', () => {
    const out = parseMonth([{...ROW, session_date: '2026-11-20'}, {...ROW, session_date: '2026-11-25'}]);
    expect(out?.map(m => m.answeredDate)).toEqual(['2026-11-20', '2026-11-25']);
  });
});

test('realApi: child_summary month 는 v6 어르신에게만 — 키 없음·나누지 않음이면 undefined', async () => {
  const s = await createRealApi(
    sbOf({
      parent_title: '부모님',
      parents: [
        {parent_id: 'p1', title: '엄마', shared: true, connected: true, latest: null, month: [ROW]},
        {parent_id: 'p2', title: '아빠', shared: true, connected: true, latest: null}, // v5: 키 없음
        {parent_id: 'p3', title: '할머니', shared: false, connected: true, latest: null, month: [ROW]}, // 나누지 않음이면 무엇이 와도 안 씀
        {parent_id: 'p4', title: '할아버지', shared: true, connected: true, latest: null, month: 'oops'},
      ],
    }),
    social,
  ).fetchChildSummary();
  expect(s.parents.map(p => p.month?.map(m => m.choiceLabel))).toEqual([['시장 구경'], undefined, undefined, undefined]);
});

test('realApi: 어르신 미리보기(0050 summary)도 같은 파서라 month 가 보인다', async () => {
  const r = await createRealApi(
    sbOf({summary: {parents: [{parent_id: 'p1', title: '엄마', shared: true, connected: true, latest: null, month: [ROW]}]}, history: {parents: []}}),
    social,
  ).parentPreviewChildView();
  expect(r.summary.parents[0].month?.[0].care).toBe('가까운 시장 같이 구경 가기');
});

test('fake: month 는 서버 게이트처럼 v6 이상 동의일 때만(v5 동의·옵션 consented 는 키 없음)', async () => {
  const old = createFakeApi({consented: true, linked: true});
  expect((await old.fetchChildSummary()).parents[0].month).toBeUndefined();
  const api = createFakeApi({linked: true});
  await api.giveConsent('v6');
  expect((await api.fetchChildSummary()).parents[0].month).toEqual([]); // 아직 고르신 것 없음 → 빈 목록
  await api.saveAnswer({questionId: 'q-1', choice: 'B'});
  const [m] = (await api.fetchChildSummary()).parents[0].month ?? [];
  expect(m).toMatchObject({promptShort: '봄과 가을 중', choiceLabel: '가을'});
  expect(typeof m.care).toBe('string'); // 화면 확인용 예시 한 줄
  expect((await api.parentPreviewChildView()).summary.parents[0].month).toHaveLength(1);
});

describe('P2 v6 동의 문구(docs/team/copy/2026-11-26-p2-v6-draft.md 안 A)', () => {
  test('CONSENT_VERSION 은 v6', () => {
    expect(CONSENT_VERSION).toBe('v6');
  });

  test('제목·다섯 줄·안내·버튼이 초안 1.1 그대로', () => {
    expect(copy.consent.title).toBe('고르신 답을 가족과 나눠요');
    expect(copy.consent.body).toEqual([
      '고르신 답과 날짜가 한 달 동안 모여 가족에게 보여요',
      '연결된 가족은 이야기를 꺼내고 챙겨 드릴 수 있어요',
      '앱은 고르신 것으로 어떤 분인지 풀이하지 않아요',
      '안 한 날은 보이지 않아요',
      '한 달 뒤에, 또는 그만 보여 주면 지워져요',
    ]);
    expect(copy.consent.reassure).toBe('싫어요를 눌러도 앱은 그대로 써요. 마음이 바뀌면 설정에서 바꿔요');
    expect(copy.consent.decline_note).toBe('싫어요를 누르면 가족은 답을 보여 주지 않는 중인 것만 알아요');
    expect([copy.consent.accept, copy.consent.decline]).toEqual(['좋아요', '싫어요']);
  });

  test('writer 1-2: 동의 문장은 30자 이하', () => {
    for (const s of [copy.consent.title, ...copy.consent.body]) {
      expect(s.length).toBeLessThanOrEqual(30);
    }
  });
});

describe("자녀 홈 '최근 한 달 고르신 것' 문구(콘텐츠 갈래 설계서 4절 W4 확정)", () => {
  test('제목·줄 이름·빈 상태·31일 안내', () => {
    expect(copy.child.home.month.title).toBe('최근 한 달 고르신 것');
    expect(copy.child.home.month.care_label).toBe('챙겨 드릴 거리');
    expect(copy.child.home.month.empty).toBe('고르신 것이 여기 모여요');
    expect(copy.child.home.month.expire_note).toBe('한 달이 지난 것은 지워져요');
  });
});

// 기획 v2.1 Q1: 앱의 판단어('취향'·'알아서'·'마음 가는 쪽')·부모님을 풀이하는 말('좋아하시는')은 화면·동의 문구에서 뺀다.
// 예외 없음 — #298 QA-3 M3·금지어 표의 대기 3키(first.intro[1]·question.headline·login.preview_lines[1])는 라이터가 교체(copy-legal/v6-scope).
// ('알아서'는 '알아서 해 드려요' 꼴만 막는다 — '알아요'(decline_note 등 사실 문장)는 걸리지 않는다)
const JUDGE = /취향|좋아하시|알아서|마음 ?가는/;
function judgeHits(o: unknown, p = '', out: string[] = []): string[] {
  if (typeof o === 'string') {
    if (JUDGE.test(o)) out.push(p);
  } else if (Array.isArray(o)) {
    o.forEach((v, i) => judgeHits(v, `${p}[${i}]`, out));
  } else if (o && typeof o === 'object') {
    for (const [k, v] of Object.entries(o)) if (!k.startsWith('_')) judgeHits(v, p ? `${p}.${k}` : k, out);
  }
  return out;
}

test("금지어: 동의·자녀 목록을 포함한 전 문구에 '취향'·'좋아하시'·'알아서'·'마음 가는'이 없다(예외 없음)", () => {
  expect(judgeHits(copy)).toEqual([]);
  expect(judgeHits({consent: {body: ['가족이 좋아하시는 걸 챙겨 드릴 수 있어요']}, x: {_memo: '취향'}})).toEqual(['consent.body[0]']); // 검사가 실제로 붙잡는다
  expect(judgeHits({first: {intro: ['a', '고르신 답으로 자녀가 취향을 알아 가요']}, q: {h: '요즘 마음 가는 쪽을 골라요'}, l: ['마음가는 쪽'], s: '알아서 챙겨 드려요'})).toEqual([
    'first.intro[1]',
    'q.h',
    'l[0]',
    's',
  ]); // 예전 대기 키 꼴도 이제 붙잡는다
  expect([copy.consent, copy.child.home.month].flatMap(o => JSON.stringify(o).match(JUDGE) ?? [])).toEqual([]);
});
