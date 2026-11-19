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
