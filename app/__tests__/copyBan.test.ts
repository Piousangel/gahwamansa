import {copy} from '../src/copy/copy';

// 문구 전체(copy.ko.json 의 모든 키)를 훑는다. _meta 는 개발 메모라 제외.
function strings(v: unknown, path: string, out: [string, string][] = []): [string, string][] {
  if (typeof v === 'string') {
    out.push([path, v]);
  } else if (Array.isArray(v)) {
    v.forEach((x, i) => strings(x, `${path}[${i}]`, out));
  } else if (v && typeof v === 'object') {
    for (const [k, x] of Object.entries(v)) {
      strings(x, path ? `${path}.${k}` : k, out);
    }
  }
  return out;
}
const all = strings(copy, '').filter(([p]) => p !== '_meta');

const BANNED_EVERYWHERE = [/아직/, /못 ?했/, /미완료/, /\d+일째/, /틀렸/, /치매|치료|예방/];

test('전 문구에 금지어가 없다', () => {
  expect(all.length).toBeGreaterThan(50);
  const hits = all.filter(([, s]) => BANNED_EVERYWHERE.some(re => re.test(s)));
  expect(hits).toEqual([]);
});

test('자녀 화면 문구에 "어르신"이 없다', () => {
  const childPaths = /^(child|delete\.child|cheers)\b/;
  const hits = all.filter(([p, s]) => childPaths.test(p) && /어르신/.test(s));
  expect(hits).toEqual([]);
});

test('확정 키: 탭 이름, 지우기 확인 단어, AI 표기, 서비스 이름', () => {
  expect(copy.child.tab_album).toBe('앨범');
  expect(copy.child.tab_past).toBe('지난 날');
  expect(copy.delete.child.type_word).toBe('지우기');
  expect(copy.delete.child.type_hint).toContain('지우기');
  expect(copy.app.ai_photo_label).toBe('AI가 만든 그림');
  expect(copy.brand.name).toBe('가화만사성');
  expect(copy.connect.greeting).toBe('안녕하세요, 해님이에요');
});

test('계정 지우기 로그인 풀림: 어르신용은 로그인 대신 문의하기로(익명 계정은 다시 들어오면 새 계정)', () => {
  const p = copy.delete.signed_out_parent;
  expect([p.title, p.body, p.button].some(s => /로그인/.test(s))).toBe(false);
  expect(p.button).toBe(copy.app_info.contact); // 버튼 이름 = 도착(앱 정보 '문의하기')
  expect(`${p.title}${p.body}`).not.toMatch(/@|https?:/); // 메일 주소·URL 은 앱 정보 상수(CONTACT_EMAIL)에서, 문구에 쓰지 않는다
  // 익명 기기는 본인 확인 수단이 없어 가족(자녀 계정)으로 확인한 뒤에만 지운다(dev-server-notes §19 ③) — 조건 없는 약속 금지
  expect(p.body).toMatch(/가족 확인 뒤/);
  expect(p.body).toMatch(/가족이 대신 문의/);
  expect(copy.delete.signed_out.button).toBe('다시 로그인하기'); // 자녀용은 그대로
});

test('어르신 지우기 두 갈래(#156 M1·H1·H2, 법률 11-20): 지킬 수 없는 약속·단정을 쓰지 않는다', () => {
  const d = copy.delete;
  const elder = [d.signed_out_parent_unlinked, d.parent.done_none, d.parent.done_unsure];
  for (const x of elder) {
    const text = `${x.title}${x.body}`;
    expect(text).not.toMatch(/로그인|서버|@|https?:/); // 어르신 낱말이 아님·주소는 상수에서
    expect(text).not.toMatch(/가족 확인 뒤 지워 드려요/); // 연결한 적 없는 분에게는 지킬 수 없음(M1)
    expect(text).not.toMatch(/모든 정보|모두 지웠/); // 서버에 가명 이용 기록이 남는다(법률)
  }
  // 연결한 적 없음: 문의 버튼 없이, 남는 기록을 말한다(#157 병합 전 기간 기재 금지)
  expect('button' in d.signed_out_parent_unlinked).toBe(false);
  expect(d.signed_out_parent_unlinked.body).toMatch(/이름·연락처 없는 기록만 남아요/);
  expect(d.signed_out_parent_unlinked.body).not.toMatch(/\d+일|\{기간\}/);
  // 결과 화면: '지울 기록이 없었어요'(지운 것이 있는데 없다고 함) 금지
  expect(d.parent.done_none.title).not.toMatch(/없었어요/);
});

test('호칭은 조사 없이 의/께/뒤 띄어쓰기로만 쓴다', () => {
  const bad = all.filter(([, s]) => /\{호칭\}(은|는|이|가|을|를|과|와)(?![가-힣])/.test(s));
  expect(bad).toEqual([]);
});

// 전문가 리뷰 A5(8/8): 닫기 말은 세 갈래다.
// - 상태를 바꾸지 않으면 '닫기'
// - 질문을 거절하면 '안 ○○할게요/래요'
// - 나중에 다시 물을 때는 '다음에'
// 화면을 옮기는 버튼은 목적지 이름('오늘 코스로'·'처음으로')을 쓴다. 아래 말은 값 전체로 쓰지 않는다.
// P2 동의 '좋아요/싫어요'와 P13 다시 보여 주기 '좋아요'는 법률 확인 뒤에 바꾼다(라이터 11-20 표 2절). 그래서 아직 목록에 넣지 않았다.
test('A5: 없앤 닫기 말을 버튼으로 쓰지 않는다', () => {
  const RETIRED = ['그만둘래요', '그대로 둘래요', '괜찮아요', '나중에 할게요', '취소', '돌아가기'];
  const hits = all.filter(([, s]) => RETIRED.includes(s));
  expect(hits).toEqual([]);
});

test("A5: '알겠어요'는 정보만 읽고 닫는 곳에만(P7·P8·P13 미리보기)", () => {
  const ok = all.filter(([, s]) => s === '알겠어요').map(([p]) => p).sort();
  expect(ok).toEqual(['cheer.button', 'done.button', 'errors.push_denied.button', 'settings.preview.ok'].sort());
});

// W-09(전문가 리뷰 r2): 버튼 키 이름이 닫기 말 갈래를 말한다. 키와 값이 어긋나면 실패(A5 세 갈래가 문구 파일에서도 지켜지게).
// - …close  → '닫기'            - …later(시트·대화상자 버튼) → '다음에'
// - …cancel → '닫기' 또는 '안 ○○요'   - no / offer_no / decline / …_decline → '안 ○○요'(reg_no 같은 번호 키는 아님)
// - 값 '닫기'는 close·cancel·keep 키에만, '다음에'는 later 키에만
// 예외(법률 확인 뒤 바꿈, 라이터 11-20 표 2절): consent.decline '싫어요'
test('W-09: 버튼 키 규칙 — 닫기·다음에·안 ○○요 가 키 이름과 맞는다', () => {
  const DECLINE = /^안 \S.*요$/;
  const LATER_KEYS_NOT_BUTTON = ['course.status.later', 'relation.later']; // 상태 이름·안내 문장(버튼 아님)
  const EXCEPT = ['consent.decline'];
  const last = (p: string) => p.split('.').pop() ?? '';
  const bad: string[] = [];
  for (const [p, s] of all) {
    if (EXCEPT.includes(p)) {
      continue;
    }
    const k = last(p);
    if (/close$/.test(k) && s !== '닫기') {
      bad.push(`${p}: close 키인데 '${s}'`);
    }
    if (k === 'later' && !LATER_KEYS_NOT_BUTTON.includes(p) && s !== '다음에') {
      bad.push(`${p}: later 키인데 '${s}'`);
    }
    if (/cancel$/.test(k) && s !== '닫기' && !DECLINE.test(s)) {
      bad.push(`${p}: cancel 키는 '닫기' 또는 '안 ○○요'`);
    }
    if (/^(no|offer_no|decline)$|_decline$/.test(k) && !DECLINE.test(s)) {
      bad.push(`${p}: 거절 키는 '안 ○○요'인데 '${s}'`);
    }
    if (s === '닫기' && !/(close|cancel|keep)$/.test(k)) {
      bad.push(`${p}: '닫기'는 close·cancel·keep 키에만`);
    }
    if (s === '다음에' && k !== 'later') {
      bad.push(`${p}: '다음에'는 later 키에만`);
    }
  }
  expect(bad).toEqual([]);
});

test("W-09: 뒤로 목적지(nav.to)는 모두 '…로'이고 '이전'·'뒤로'가 없다, '‹ 이전' 문구는 없다", () => {
  const to = Object.entries(copy.nav.to);
  expect(to.length).toBeGreaterThan(20);
  expect(to.filter(([, v]) => !/로$/.test(v) || /이전|뒤로/.test(v))).toEqual([]);
  expect(all.filter(([, s]) => /‹ ?이전|이전 화면/.test(s))).toEqual([]);
});
