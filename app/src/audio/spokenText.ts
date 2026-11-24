// 읽기용 문장 변환(P-2, 오너 S25 피드백 2026-11-20). 기기 TTS 에 넘기기 **직전에만** 쓴다(engines.createTtsEngine.speak).
// - 화면 글자·미리 생성 음성 키(voiceClips, readText.splitSentences 원문)는 바꾸지 않는다 → 파일 찾기에 영향 없음.
// - 결과에 줄바꿈이 있으면 그 자리에서 문장을 나눠 따로 말한다(엔진이 SSML·쉼 길이 지정을 받지 않아서, 아래 '쉼' 참고).
// - readText.ts 처럼 import 없이, 지울 수 있는 타입 문법만 쓴다(scripts/tts 가 node 로 그대로 import). 정규식 뒤보기·유니코드 속성 금지(Hermes).
//
// 쉼(엔진별 조사, docs/team/dev/2026-11-24-tts-reading.md 2절):
// - @mhpdev/react-native-speech 1.4.4 는 Android TextToSpeech.speak·iOS AVSpeechUtterance(string:)에 글을 그대로 넘긴다.
//   SSML(<break>)·Android playSilentUtterance·iOS postUtteranceDelay 는 라이브러리가 열어 주지 않는다.
// - 그래서 쓸 수 있는 쉼은 셋: 쉼표(문장 안 짧은 쉼, 두 엔진 공통) · 문장 나누기(엔진이 문장을 끝맺는 억양+틈) ·
//   문장 사이 JS 대기(engines TTS_TUNING.sentencePauseMs). 이 파일은 앞의 둘만 만든다.

const SINO = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
const SMALL_UNITS = ['', '십', '백', '천'];
const BIG_UNITS = ['', '만', '억', '조', '경'];

/** 한자어 수(0 이상 정수). 십·백·천·만 앞의 '일'은 뺀다(만 오천), 억·조는 붙인다(일억). 만 단위마다 띄운다. */
export function sinoNumber(n: number): string {
  if (!Number.isFinite(n) || n < 0) {
    return String(n);
  }
  n = Math.floor(n);
  if (n === 0) {
    return '영';
  }
  const groups: string[] = [];
  let big = 0;
  while (n > 0 && big < BIG_UNITS.length) {
    const g = n % 10000;
    n = Math.floor(n / 10000);
    if (g > 0) {
      let s = '';
      const digits = String(g).padStart(4, '0');
      for (let i = 0; i < 4; i++) {
        const d = Number(digits[i]);
        const unit = SMALL_UNITS[3 - i];
        if (d === 0) {
          continue;
        }
        s += (d === 1 && unit ? '' : SINO[d]) + unit;
      }
      if (big === 1 && g === 1) {
        s = ''; // 일만 → 만
      }
      groups.unshift(s + BIG_UNITS[big]);
    }
    big++;
  }
  return groups.join(' ');
}

const NATIVE_ONES = ['', '한', '두', '세', '네', '다섯', '여섯', '일곱', '여덟', '아홉'];
const NATIVE_TENS = ['', '열', '스물', '서른', '마흔', '쉰', '예순', '일흔', '여든', '아흔'];

/** 고유어 수(세는 말 앞 꼴, 1~99). 범위 밖이면 null → 한자어로 읽는다. */
export function nativeNumber(n: number): string | null {
  if (!Number.isInteger(n) || n < 1 || n > 99) {
    return null;
  }
  if (n === 20) {
    return '스무';
  }
  return NATIVE_TENS[Math.floor(n / 10)] + NATIVE_ONES[n % 10];
}

/** 소수까지: 1.5 → 일 점 오(소수 자리는 숫자 하나씩) */
function sinoDecimal(s: string): string {
  const [int, frac] = s.split('.');
  const head = sinoNumber(Number(int));
  if (!frac) {
    return head;
  }
  return `${head} 점 ${Array.from(frac).map(d => (d === '0' ? '영' : SINO[Number(d)])).join('')}`;
}

/** 달 이름: 6월 유월, 10월 시월 */
const month = (m: number): string => (m === 6 ? '유' : m === 10 ? '시' : sinoNumber(m)) + '월';

// 고유어로 세는 말(긴 것 먼저). '분'(시간)·'대'(20대)·'번'(버스 번호)처럼 한자어로 읽는 쓰임이 더 흔한 것은 넣지 않거나 따로 둔다.
const NATIVE_COUNTERS = '시간|번째|마리|사람|그릇|가지|켤레|송이|군데|시|개|살|명|잔|장|권|벌|달|곳|번';
// 숫자 뒤 단위 → 읽는 말(뒤에 영문이 이어지면 단위가 아님)
const UNITS: Record<string, string> = {
  km: '킬로미터', kg: '킬로그램', cm: '센티미터', mm: '밀리미터', ml: '밀리리터', mL: '밀리리터',
  m: '미터', g: '그램', L: '리터', '%': '퍼센트', '℃': '도', '°C': '도', '°': '도',
};
const UNIT_RE = 'km|kg|cm|mm|mL|ml|°C|℃|°|%|m|g|L';

// 영문 대문자 약어는 한 글자씩(Wolters 2007: 낯선 낱말일수록 어르신 청취가 떨어진다 → 엔진마다 다른 읽기를 하나로)
const LETTERS: Record<string, string> = {
  A: '에이', B: '비', C: '씨', D: '디', E: '이', F: '에프', G: '지', H: '에이치', I: '아이', J: '제이', K: '케이', L: '엘', M: '엠',
  N: '엔', O: '오', P: '피', Q: '큐', R: '알', S: '에스', T: '티', U: '유', V: '브이', W: '더블유', X: '엑스', Y: '와이', Z: '제트',
};
// 앱 글에 나오는 영문 이름(앱 정보 ai_music 등)
const WORDS: Record<string, string> = {Google: '구글', Lyria: '리리아'};

const WEEKDAY = '월화수목금토일';

/**
 * 읽기용 문장으로 바꾼다. 순서가 뜻을 가진다: 날짜 → 범위 → 세는 말 → 단위 → 남은 숫자 → 영문 → 괄호·기호 → 한 글자씩 → 정리.
 * 두 번 돌려도 결과가 같다(대체 경로가 이미 바뀐 글을 다시 넘겨도 안전).
 */
export function toSpoken(text: string): string {
  let s = text.normalize('NFC');

  // 1. 날짜(M/D 꼴은 분수 1/2 와 헷갈려 다루지 않는다)
  s = s.replace(/(\d{4})\s*[.\-/]\s*(\d{1,2})\s*[.\-/]\s*(\d{1,2})\.?/g, (all, y, m, d) =>
    validDate(+m, +d) ? `${y}년 ${m}월 ${d}일` : all,
  );
  s = s.replace(new RegExp(`\\s*\\(\\s*([${WEEKDAY}])(?:요일)?\\s*\\)`, 'g'), ' $1요일');
  s = s.replace(/(\d+)\s*개월/g, (_, n) => `${sinoNumber(+n)} 개월`);
  s = s.replace(/(\d+)\s*월/g, (_, n) => month(+n));

  // 2. 큰 수 쉼표(1,000) 지우기, 가운뎃점 사이 숫자(3·1절)는 붙여 읽기
  s = s.replace(/(\d),(?=\d{3}(?!\d))/g, '$1');
  s = s.replace(/(\d+)\s*[·ㆍ・]\s*(\d+)/g, (_, a, b) => sinoNumber(+a) + sinoNumber(+b));

  // 3. 범위(3~5개 → 3개에서 5개: 세는 말을 양쪽에 붙여 아래 규칙이 각각 읽게)
  s = s.replace(new RegExp(`(\\d+)\\s*[~∼～]\\s*(\\d+)\\s*(${NATIVE_COUNTERS}|${UNIT_RE})?`, 'g'), (_, a, b, c = '') => `${a}${c}에서 ${b}${c}`);

  // 4. 세는 말 앞은 고유어(1~99). 시는 12 이하만, 번째의 1은 '첫'
  s = s.replace(new RegExp(`(\\d+)\\s*(${NATIVE_COUNTERS})`, 'g'), (_, num, c) => {
    const n = Number(num);
    if (c === '번째' && n === 1) {
      return '첫 번째';
    }
    const native = c === '시' && n > 12 ? null : nativeNumber(n);
    return `${native ?? sinoNumber(n)} ${c}`;
  });

  // 5. 단위
  s = s.replace(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(${UNIT_RE})(?![A-Za-z])`, 'g'), (_, num, u) => `${sinoDecimal(num)} ${UNITS[u]}`);

  // 6. 남은 숫자는 한자어(소수 포함)
  s = s.replace(/\d+(?:\.\d+)?/g, num => sinoDecimal(num));

  // 7. 영문: 아는 이름 → 한글, 대문자 약어(1~5자, A4 의 A 포함) → 한 글자씩. 소문자가 섞인 낱말은 엔진에 맡긴다.
  //    낱말 사이 붙임표(COVID-19)는 띄어 읽는다
  s = s.replace(/[A-Za-z]+/g, w => WORDS[w] ?? (/^[A-Z]{1,5}$/.test(w) ? Array.from(w).map(ch => LETTERS[ch]).join('') : w));
  s = s.replace(/([0-9A-Za-z가-힣])-(?=[0-9A-Za-z가-힣])/g, '$1 ');

  // 8. 따옴표·꺾쇠는 지운다(읽을 말이 아님)
  s = s.replace(/["“”‘’'「」『』《》〈〉<>]/g, '');
  // 9. 괄호: 앞에 짧은 쉼. 뒤에 한글(조사)이 바로 붙으면 그대로 잇고, 아니면 뒤에도 쉼
  s = s.replace(/\s*[([{]\s*([^()[\]{}]*?)\s*[)\]}](?=([가-힣])?)/g, (_, inner, next) => (next ? `, ${inner}` : `, ${inner},`));
  // 10. 가운뎃점·빗금·화살표 → 쉼표, 그리고(&)
  s = s.replace(/\s*[·ㆍ・‧∙/→⇒]\s*/g, ', ');
  s = s.replace(/\s*&\s*/g, ' 그리고 ');
  // 11. 말줄임표: 뒤가 공백·끝이면 마침표(문장 쉼), 문장 안이면 쉼표
  s = s.replace(/(?:…|⋯|\.{2,})+(\s|$)/g, '.$1');
  s = s.replace(/\s*(?:…|⋯|\.{2,})+\s*/g, ', ');
  // 12. 읽지 않는 기호
  s = s.replace(/[~∼～★☆♥♡❤●○◎◇◆□■△▲▽▼▶▷◀◁※#*_|^=+@]/g, ' ');

  // 13. 한 글자씩(copy tts.read.word '{낱말}. 한 글자씩, {글자들}.'): 글자마다 따로 말해 글자 사이를 문장 쉼으로(따라 쓰기)
  s = s.replace(/글자씩\s*,\s*([가-힣](?:\s*,\s*[가-힣])*)\s*\.?(?![가-힣])/g, (_, list: string) =>
    `글자씩.\n${list.split(/\s*,\s*/).join('.\n')}.`,
  );

  return tidy(s);
}

function validDate(m: number, d: number): boolean {
  return m >= 1 && m <= 12 && d >= 1 && d <= 31;
}

/** 공백·쉼표 정리(줄바꿈은 문장 나눔이라 남긴다) */
function tidy(s: string): string {
  return s
    .split('\n')
    .map(line =>
      line
        .replace(/[ \t\r\f\v]+/g, ' ')
        .replace(/\s+([,.?!])/g, '$1')
        .replace(/,(\s*,)+/g, ',')
        .replace(/,\s*([.?!])/g, '$1')
        .replace(/([.?!])\s*,/g, '$1')
        .replace(/,(?=\S)/g, ', ')
        .replace(/^[\s,]+|[\s,]+$/g, ''),
    )
    .filter(line => line.length > 0)
    .join('\n');
}
