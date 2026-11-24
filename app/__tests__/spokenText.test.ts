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

describe('toSpoken: 날짜·시간·숫자·단위', () => {
  test('날짜: 6월·10월은 유월·시월, 요일 괄호는 요일로', () => {
    expect(toSpoken('11월 24일 화요일')).toBe('십일월 이십사일 화요일');
    expect(toSpoken('6월 5일(목)')).toBe('유월 오일 목요일');
    expect(toSpoken('10월 9일')).toBe('시월 구일');
    expect(toSpoken('2026.11.24')).toBe('이천이십육년 십일월 이십사일');
    expect(toSpoken('2026-06-01')).toBe('이천이십육년 유월 일일');
    expect(toSpoken('1/2 컵')).toBe('일, 이 컵'); // M/D 는 분수와 헷갈려 날짜로 읽지 않는다
    expect(toSpoken('6개월')).toBe('육 개월');
  });
  test('세는 말 앞은 고유어(한 개·세 시), 시간·분은 시는 고유어·분은 한자어', () => {
    expect(toSpoken('사과 2개')).toBe('사과 두 개');
    expect(toSpoken('오전 9시 30분')).toBe('오전 아홉 시 삼십분');
    expect(toSpoken('1시간')).toBe('한 시간');
    expect(toSpoken('20살')).toBe('스무 살');
    expect(toSpoken('1번째')).toBe('첫 번째');
    expect(toSpoken('2번째')).toBe('두 번째');
    expect(toSpoken('15시')).toBe('십오 시');
    expect(toSpoken('3~5개')).toBe('세 개에서 다섯 개');
  });
  test('큰 수 쉼표·소수·퍼센트·단위', () => {
    expect(toSpoken('1,000원')).toBe('천원');
    expect(toSpoken('1.5배')).toBe('일 점 오배');
    expect(toSpoken('30%')).toBe('삼십 퍼센트');
    expect(toSpoken('3km 걷기')).toBe('삼 킬로미터 걷기');
    expect(toSpoken('25℃')).toBe('이십오 도');
    expect(toSpoken('3·1절')).toBe('삼일절');
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
    expect(toSpoken('A4 용지')).toBe('에이사 용지');
    expect(toSpoken('COVID-19')).toBe('씨오브이아이디 십구');
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
