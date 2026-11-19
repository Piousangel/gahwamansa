import {normalizeSentence, readTextBuilders, splitSentences} from '../src/audio/readText';
import {copy} from '../src/copy/copy';

// 읽어 주기 문장 나누기(DECISIONS 11-19 V13a): 기기 TTS 는 문장마다 따로 말하고, 미리 생성 음성은 문장마다 파일 하나.
describe('splitSentences', () => {
  test('마침표·물음표 뒤 공백, 줄바꿈에서 나눈다', () => {
    expect(splitSentences('장에 가면 어디를 보셨어요? 장바구니에 담던 건 뭐예요?')).toEqual([
      '장에 가면 어디를 보셨어요?',
      '장바구니에 담던 건 뭐예요?',
    ]);
    expect(splitSentences('가족이 보낸 응원이에요. 늘 고마워요\n덕분에 하루가 따뜻해요')).toEqual([
      '가족이 보낸 응원이에요.',
      '늘 고마워요',
      '덕분에 하루가 따뜻해요',
    ]);
  });
  test('쉼표·문장 안 마침표(공백 없음)는 나누지 않는다', () => {
    expect(splitSentences('학교종. 한 글자씩, 학, 교, 종.')).toEqual(['학교종.', '한 글자씩, 학, 교, 종.']);
    expect(splitSentences('1.5배 빨라요')).toEqual(['1.5배 빨라요']);
  });
  test('공백을 하나로 줄이고, 기호만 남은 조각·빈 글은 버린다', () => {
    expect(splitSentences('  봄,   아니면  가을.  ')).toEqual(['봄, 아니면 가을.']);
    expect(splitSentences('... ?')).toEqual([]);
    expect(splitSentences('')).toEqual([]);
    expect(normalizeSentence(' a \n b ')).toBe('a b');
  });
  test('말줄임표 뒤 공백에서도 나눈다', () => {
    expect(splitSentences('학… 교… 종.')).toEqual(['학…', '교…', '종.']);
    expect(splitSentences('그때는... 좋았지요')).toEqual(['그때는...', '좋았지요']);
  });
});

describe('readTextBuilders(copy tts.read)', () => {
  const b = readTextBuilders(copy.tts.read);
  test('응원 여러 개는 줄바꿈으로 이어 문장마다 나뉜다', () => {
    const text = b.cheer([copy.cheers.thanks_always, copy.cheers.warm_day]);
    expect(splitSentences(text)).toEqual(['가족이 보낸 응원이에요.', copy.cheers.thanks_always, copy.cheers.warm_day]);
    expect(b.cheer('사랑해요')).toBe('가족이 보낸 응원이에요. 사랑해요');
  });
  test('사진 질문 두 개는 두 문장', () => {
    expect(splitSentences(b.photo(['어디일까요?', '가 보셨어요?']))).toHaveLength(2);
  });
});
