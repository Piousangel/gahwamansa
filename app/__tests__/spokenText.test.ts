import {nativeNumber, sinoNumber, toSpoken} from '../src/audio/spokenText';
import {readTextBuilders, splitSentences} from '../src/audio/readText';
import {copy} from '../src/copy/copy';

// 읽기용 문장 변환(P-2, 오너 S25): 기기 TTS 에 넘기기 직전에만 쓴다. 화면 글자·미리 생성 음성 키는 그대로.
describe('숫자 읽기', () => {
  test('한자어 수: 일은 십·백·천·만 앞에서 빠지고, 억·조는 붙는다', () => {
    expect(sinoNumber(0)).toBe('영');
    expect(sinoNumber(10)).toBe('십');
    expect(sinoNumber(24)).toBe('이십사');
    expect(sinoNumber(111)).toBe('백십일');
    expect(sinoNumber(2026)).toBe('이천이십육');
    expect(sinoNumber(10000)).toBe('만');
    expect(sinoNumber(15000)).toBe('만 오천');
    expect(sinoNumber(100000000)).toBe('일억');
    expect(sinoNumber(120000000)).toBe('일억 이천만');
  });
  test('고유어 수(1~99, 단위 앞 꼴): 한·두·세·네·스무', () => {
    expect(nativeNumber(1)).toBe('한');
    expect(nativeNumber(3)).toBe('세');
    expect(nativeNumber(10)).toBe('열');
    expect(nativeNumber(12)).toBe('열두');
    expect(nativeNumber(20)).toBe('스무');
    expect(nativeNumber(21)).toBe('스물한');
    expect(nativeNumber(99)).toBe('아흔아홉');
    expect(nativeNumber(100)).toBeNull();
  });
});

describe('toSpoken: 날짜·시간·숫자·단위(확실한 꼴만 바꾸고, 나머지 숫자는 원문 그대로 엔진에)', () => {
  test('달: 붙어 쓴 1~12월만 달 이름(6월 유월, 10월 시월), 요일 괄호는 요일, 날·해 숫자는 그대로', () => {
    expect(toSpoken('11월 24일 화요일')).toBe('십일월 24일 화요일');
    expect(toSpoken('6월 5일(목)')).toBe('유월 5일 목요일');
    expect(toSpoken('10월 9일')).toBe('시월 9일');
    expect(toSpoken('2026.11.24')).toBe('2026년 십일월 24일');
    expect(toSpoken('2026-06-01')).toBe('2026년 유월 1일');
    expect(toSpoken('6개월')).toBe('육 개월');
  });
  test('세는 말 앞은 고유어(한 개·세 시·첫 번째), 12시 넘는 시·100 이상은 그대로', () => {
    expect(toSpoken('사과 2개')).toBe('사과 두 개');
    expect(toSpoken('오전 9시 30분')).toBe('오전 아홉 시 30분');
    expect(toSpoken('1시간')).toBe('한 시간');
    expect(toSpoken('20살')).toBe('스무 살');
    expect(toSpoken('1번째')).toBe('첫 번째');
    expect(toSpoken('2번째')).toBe('두 번째');
    expect(toSpoken('15시')).toBe('15시');
    expect(toSpoken('100살')).toBe('100살');
    expect(toSpoken('3~5개')).toBe('세 개에서 다섯 개');
  });
  test('큰 수 쉼표·퍼센트·단위(숫자는 그대로, 기호만 말로)', () => {
    expect(toSpoken('1,000원')).toBe('1000원');
    expect(toSpoken('1.5배')).toBe('1.5배');
    expect(toSpoken('30%')).toBe('30 퍼센트');
    expect(toSpoken('3km 걷기')).toBe('3 킬로미터 걷기');
    expect(toSpoken('25℃')).toBe('25 도');
  });
});

// #238 QA-2 리뷰 입력 전부: 틀린 읽기가 다시 나오면 실패. '그대로'는 애매해서 엔진에 맡기는 꼴(틀리게 바꾸는 것보다 낫다)
describe('toSpoken: 리뷰 #238 QA-2 입력', () => {
  const cases: [string, string, string][] = [
    // M1 기념일(가운뎃점·전쟁 앞 마침표): 달은 수로, 날은 한 자씩. 10월 이상·꼴이 애매하면 그대로
    ['M1', '6·25 때', '육이오 때'],
    ['M1', '4·19', '사일구'],
    ['M1', '5·18', '오일팔'],
    ['M1', '8·15', '팔일오'],
    ['M1', '3·1절', '삼일절'],
    ['M1', '6.25 전쟁', '육이오 전쟁'],
    ['M1', '8.15', '8.15'],
    ['M1', '10·26', '십이륙'],
    // M2 달: 붙어 있고 1~12, 뒤가 조사·끝일 때만
    ['M2', '2002 월드컵', '2002 월드컵'],
    ['M2', '10 월세', '10 월세'],
    ['M2', '1990 월급', '1990 월급'],
    ['M2', '1 월요일', '1 월요일'],
    ['M2', '16월', '16월'],
    ['M2', '3월에', '삼월에'],
    ['M2', '12월에는', '십이월에는'],
    // M3 세는 말 뒤 낱말 경계(조사만 허용), '번'은 횟수·번호가 애매해 그대로
    ['M3', '3달러', '3달러'],
    ['M3', '2개국어', '2개국어'],
    ['M3', '2번지', '2번지'],
    ['M3', '10시대', '10시대'],
    ['M3', '5장소', '5장소'],
    ['M3', '1번 버스', '1번 버스'],
    ['M3', '2번 출구', '2번 출구'],
    ['M3', '1시간째', '한 시간째'],
    ['M3', '3개가', '세 개가'],
    // M4 세는 말이 붙은 범위도 '에서'
    ['M4', '3시~5시', '세 시에서 다섯 시'],
    ['M4', '오전 9시~오후 6시', '오전 아홉 시에서 오후 여섯 시'],
    ['M4', '1960년~1970년', '1960년에서 1970년'],
    ['M4', '1~2시간', '한 시간에서 두 시간'],
    ['M4', '10~20%', '10 퍼센트에서 20 퍼센트'],
    // L1 전화번호·0으로 시작하는 수는 그대로
    ['L1', '010-1234-5678', '010-1234-5678'],
    ['L1', '02-123-4567', '02-123-4567'],
    ['L1', '007', '007'],
    // L2 시각·영하
    ['L2', '10:30', '열 시 30분'],
    ['L2', '-3도', '영하 3도'],
    ['L2', '-3℃', '영하 3도'],
    ['L2', '3:2', '3:2'],
    // L3 분수·영문+숫자는 그대로(엔진)
    ['L3', '1/2 컵', '1/2 컵'],
    ['L3', '50/50', '50/50'],
    ['L3', 'A4 용지', 'A4 용지'],
    ['L3', '4K', '4K'],
    ['L3', '5G', '5G'],
    ['L3', 'No.1', 'No.1'],
    ['L3', 'COVID-19', 'COVID-19'],
  ];
  test.each(cases)('%s %s', (_tag, input, expected) => {
    expect(toSpoken(input)).toBe(expected);
  });
  test('두 번 돌려도 같다', () => {
    for (const [, input] of cases) {
      expect(toSpoken(toSpoken(input))).toBe(toSpoken(input));
    }
  });
});

describe('toSpoken: 기호·영문', () => {
  test('AI 고지: 가운뎃점은 짧은 쉼(쉼표), AI 는 에이아이', () => {
    expect(toSpoken('AI가 만든 그림·실제 장소가 아니에요')).toBe('에이아이가 만든 그림, 실제 장소가 아니에요');
    expect(toSpoken('앱의 옛날 사진은 AI가 만든 그림이에요. 실제 장소가 아니에요')).toBe(
      '앱의 옛날 사진은 에이아이가 만든 그림이에요. 실제 장소가 아니에요',
    );
  });
  test('영문 대문자 약어는 한 글자씩, 아는 이름은 한글로, 소문자 낱말은 그대로', () => {
    expect(toSpoken('TV 보기')).toBe('티브이 보기');
    expect(toSpoken('KBS 라디오')).toBe('케이비에스 라디오');
    expect(toSpoken('Google 음성')).toBe('구글 음성');
    expect(toSpoken('hello')).toBe('hello');
  });
  test('괄호: 앞에 짧은 쉼, 뒤에 조사가 붙으면 쉼 없이 잇는다', () => {
    expect(toSpoken('배경 음악은 AI(Google Lyria)가 만든 연주곡이에요')).toBe('배경 음악은 에이아이, 구글 리리아가 만든 연주곡이에요');
    expect(toSpoken('숭늉(누룽지 물) 한 그릇')).toBe('숭늉, 누룽지 물, 한 그릇');
    expect(toSpoken('「학교종」')).toBe('학교종');
  });
  test('말줄임표: 문장 끝이면 마침표(문장 쉼), 문장 안이면 쉼표', () => {
    expect(toSpoken('그때는... 좋았지요')).toBe('그때는. 좋았지요');
    expect(toSpoken('그때는…좋았지요')).toBe('그때는, 좋았지요');
    expect(toSpoken('글쎄요…')).toBe('글쎄요.');
  });
  test('읽지 않는 기호는 지우고, 빗금·화살표는 쉼', () => {
    expect(toSpoken('★ 오늘의 낱말 ~')).toBe('오늘의 낱말');
    expect(toSpoken('예/아니요')).toBe('예, 아니요');
    expect(toSpoken('"사랑해요"')).toBe('사랑해요');
  });
});

// #238 QA-2 재확인(issuecomment-7135168517) 입력 전부. 기념일은 목록만, 범위는 달·시각보다 먼저, 애매하면 원문
describe('toSpoken: 리뷰 #238 QA-2 재확인 입력', () => {
  const cases: [string, string, string][] = [
    // M-A 가운뎃점·마침표 기념일은 실제 기념일 목록만. 나열 꼴(1·2학년)은 그대로
    ['M-A', '1·2학년', '1·2학년'],
    ['M-A', '초등학교 1·2학년 때', '초등학교 1·2학년 때'],
    ['M-A', '1·2층', '1·2층'],
    ['M-A', '5·6개', '5·6개'],
    ['M-A', '3·4월', '3·4월'],
    ['M-A', '6·25 전쟁 때', '육이오 전쟁 때'],
    ['M-A', '4·19 혁명', '사일구 혁명'],
    ['M-A', '5.18 민주화', '오일팔 민주화'],
    ['M-A', '8.15 광복', '팔일오 광복'],
    ['M-A', '1·4 후퇴', '일사 후퇴'],
    ['M-A', '“6·25” 때', '육이오 때'],
    ['M-A', '5·16', '오일육'],
    ['M-A', '6·10 민주항쟁', '육십 민주항쟁'],
    ['M-A', '10·26', '십이륙'],
    ['M-A', '3·1절', '삼일절'],
    // M-B 범위 '에서'는 달·시각 변환보다 먼저
    ['M-B', '3월~5월', '삼월에서 오월'],
    ['M-B', '3~4월', '삼월에서 사월'],
    ['M-B', '2:30~3:00', '두 시 30분에서 세 시'],
    ['M-B', '3월 5일~7일', '삼월 5일에서 7일'],
    ['M-B', '3시~5시', '세 시에서 다섯 시'],
    // L 애매하면 원문 그대로, 확실한 것만
    ['L-1', '10:30분', '열 시 30분'],
    ['L-2', '영하 -5도', '영하 5도'],
    ['L-2', '온도는-2도', '온도는-2도'],
    ['L-2', '-0.5도', '영하 0.5도'],
    ['L-3', '1-2월', '1-2월'],
    ['L-4', '1.2 운동장', '1.2 운동장'],
    ['L-4', '1.5 전쟁', '1.5 전쟁'],
    // 재확인에서 맞다고 본 꼴(되돌아가지 않게)
    ['ok', '오후 12:30', '오후 열두 시 30분'],
    ['ok', '11:59', '열한 시 59분'],
    ['ok', '13:00', '13:00'],
    ['ok', '00:30', '00:30'],
    ['ok', '09:30', '09:30'],
    ['ok', '24:00', '24:00'],
    ['ok', '12:60', '12:60'],
    ['ok', '6월드', '6월드'],
    ['ok', '1개월 반', '일 개월 반'],
    ['ok', "'3시'에", '세 시에'],
    ['ok', '2시간이었어요', '2시간이었어요'],
  ];
  test.each(cases)('%s %s', (_tag, input, expected) => {
    expect(toSpoken(input)).toBe(expected);
  });
  test('두 번 돌려도 같다', () => {
    for (const [, input] of cases) {
      expect(toSpoken(toSpoken(input))).toBe(toSpoken(input));
    }
  });
});

describe('toSpoken: 콘텐츠 틀(copy tts.read)', () => {
  const b = readTextBuilders(copy.tts.read);
  test('한 글자씩은 글자마다 따로 말한다(글자 사이 쉼, 따라 쓰기)', () => {
    expect(splitSentences(toSpoken(b.word('나무', ['나', '무'])))).toEqual(['나무.', '한 글자씩.', '나.', '무.']);
    expect(splitSentences(toSpoken(b.word('감', ['감'])))).toEqual(['감.', '한 글자씩.', '감.']);
  });
  test('둘 중 고르기·사진 질문·응원은 바꾸지 않는다(단음절 선택지 "전"도 그대로)', () => {
    const q = b.question('잔치 음식은요?', '국수', '전');
    expect(toSpoken(q)).toBe(q);
    const p = b.photo(['장에 가면 제일 먼저 어디를 보셨어요?', '장바구니에 꼭 담던 건 뭐예요?']);
    expect(toSpoken(p)).toBe(p);
    const c = b.cheer([copy.cheers.love_you, copy.cheers.thanks_always]);
    expect(toSpoken(c)).toBe(c);
  });
  test('두 번 돌려도 같다(대체 경로에서 이미 바뀐 글이 다시 와도 안전)', () => {
    for (const s of ['11월 24일(화) 오전 9시', 'AI가 만든 그림·실제 장소가 아니에요', b.word('학교종', ['학', '교', '종']), '1,000원 (30%)']) {
      expect(toSpoken(toSpoken(s))).toBe(toSpoken(s));
    }
  });
  test('빈 글·공백은 빈 글', () => {
    expect(toSpoken('')).toBe('');
    expect(toSpoken('  ')).toBe('');
  });
});
