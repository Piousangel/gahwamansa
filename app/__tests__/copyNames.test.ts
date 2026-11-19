import {copy} from '../src/copy/copy';

// 이름 사전(docs/design/NAMES.md, 전문가 리뷰 A4 ③): 같은 대상은 같은 말로, 링크·버튼 문구 = 도착 화면 제목.
// 사전에서 이름을 바꾸면 여기 NAMES 를 먼저 고치고, 문구가 따라오는지 이 테스트가 지킨다.
const NAMES = {
  course: '오늘 코스', // 유지(V27 뒤 재검토)
  write: '낱말 쓰기', // 확정
  past: '지난 날', // 확정, 두 역할 모두
  album: '앨범', // 미정(A7)
  firstScreen: '처음으로', // 첫 화면(FS)으로만
};

function strings(v: unknown, path: string, out: [string, string][] = []): [string, string][] {
  if (typeof v === 'string') {
    out.push([path, v]);
  } else if (Array.isArray(v)) {
    v.forEach((x, i) => strings(x, `${path}[${i}]`, out));
  } else if (v && typeof v === 'object') {
    for (const [k, x] of Object.entries(v)) {
      if (!k.startsWith('_')) {
        strings(x, path ? `${path}.${k}` : k, out);
      }
    }
  }
  return out;
}
const all = strings(copy, '');

describe('이름 사전: 대상 이름', () => {
  test('하루 단위 = 오늘 코스', () => {
    expect(copy.course.title).toBe(NAMES.course);
  });
  test('셋째 단계 = 낱말 쓰기', () => {
    expect(copy.course.step.hangul).toBe(NAMES.write);
  });
  test('지난 기록 = 지난 날(어르신·자녀 모두)', () => {
    expect(copy.history.title).toBe(NAMES.past);
    expect(copy.child.tab_past).toBe(NAMES.past);
    expect(copy.child.past_title).toBe(NAMES.past);
    expect(copy.child.past.title_many).toBe(NAMES.past);
    expect(copy.child.past.title).toBe(`{호칭}의 ${NAMES.past}`);
  });
});

describe('이름 사전: 링크·버튼 문구 = 도착 화면 제목', () => {
  test.each([
    ['course.history_link → history.title', copy.course.history_link, `${NAMES.past} 보기`, copy.history.title],
    ['course.to_home → course.title', copy.course.to_home, `${NAMES.course}로`, copy.course.title],
    ['course.review_link → course.title', copy.course.review_link, `${NAMES.course} 다시 보기`, copy.course.title],
    ['nav.back_course → course.title', copy.nav.back_course, `‹ ${NAMES.course}`, copy.course.title],
    ['nav.back_course_a11y → course.title', copy.nav.back_course_a11y, `${NAMES.course}로 돌아가기`, copy.course.title],
  ])('%s', (_name, link, expected, title) => {
    expect(link).toBe(expected);
    expect(link).toContain(title);
  });

  test('자녀 탭 이름이 도착 화면 제목에 들어 있다', () => {
    expect(copy.child.home.bar_title).toContain(copy.child.tab_album);
    expect(copy.child.tab_album).toBe(NAMES.album);
    expect(copy.child.past.title).toContain(copy.child.tab_past);
    expect(copy.connect_done.button).toBe(`${NAMES.album}으로`);
  });

  test('C0 BackLink 목적지: 로그인 고르기·이메일 주소 화면 이름과 같다', () => {
    expect(copy.login.choose_title.startsWith(copy.login.back_choose.replace(/으?로$/, ''))).toBe(true);
    expect(copy.login.back_email).toBe(`${copy.login.email_label}로`);
  });

  test("'처음으로'는 첫 화면으로 가는 버튼에만(목적지 하나)", () => {
    const firstKeys = all.filter(([, s]) => s === NAMES.firstScreen).map(([p]) => p).sort();
    expect(firstKeys).toEqual(['delete.child.back', 'delete.parent.back', 'errors.not_parent_device.button', 'login.back'].sort());
  });
});

describe('이름 사전: 쓰지 않는 말', () => {
  // NAMES.md '쓰지 않는 말' 중 문장 안에서도 쓰이면 안 되는 것만. '지난 답'(내용 명사)·'오늘 사진'(그날 사진)은 문장에서 다른 뜻으로 쓰여 목록 이름 키로만 지킨다(위).
  const BANNED = [/오늘의 코스/, /자판으로 쓰기/, /한 단어 쓰기/, /따라 쓰기/, /코드/, /팻말|장날|좌판/];
  test('전 문구에 없다', () => {
    const hits = all.filter(([, s]) => BANNED.some(re => re.test(s)));
    expect(hits).toEqual([]);
  });
});
