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

/** 달 이름: 6월 유월, 10월 시월 */
const month = (m: number): string => (m === 6 ? '유' : m === 10 ? '시' : sinoNumber(m)) + '월';
/** 숫자를 한 자씩(기념일의 날: 25 → 이오) */
const digitsEach = (d: string): string => Array.from(d).map(x => (x === '0' ? '영' : SINO[Number(x)])).join('');

// 고유어로 세는 말. '분'(시간)·'대'(20대)는 한자어가 흔해 넣지 않는다. '번'은 횟수(세 번)·번호(1번 버스)가 애매해 넣지 않는다(번째만).
const NATIVE_COUNTERS = '시간|번째|마리|사람|그릇|가지|켤레|송이|군데|시|개|살|명|잔|장|권|벌|달|곳';
// 세는 말·달 뒤의 낱말 경계: 글 끝·한글 아닌 글자, 또는 조사(뒤에 한글이 더 이어지지 않을 때). '3달러'·'2개국어'·'10시대'는 경계가 아니다
const PARTICLES = '에서는|에서도|에서|에는|에도|에게|부터|까지|마다|밖에|만에|만큼|이나|이에요|예요|이요|이고|이면|으로|쯤에|쯤|째|씩|에|은|는|이|가|을|를|의|도|만|과|와|나|로|요|엔|반';
const BOUNDARY = `(?=$|[^가-힣]|(?:${PARTICLES})(?![가-힣]))`;
// 숫자 뒤 단위 → 읽는 말(뒤에 영문이 이어지면 단위가 아님). 숫자는 그대로 둔다(엔진이 읽는다)
const UNITS: Record<string, string> = {
  km: '킬로미터', kg: '킬로그램', cm: '센티미터', mm: '밀리미터', ml: '밀리리터', mL: '밀리리터',
  m: '미터', g: '그램', L: '리터', '%': '퍼센트', '℃': '도', '°C': '도', '°': '도',
};
const UNIT_RE = 'km|kg|cm|mm|mL|ml|°C|℃|°|%|m|g|L';
// 기념일 마침표 꼴(6.25 전쟁)은 이 낱말이 뒤따를 때만(그 밖의 8.15 는 소수일 수 있어 그대로)
const ANNIVERSARY_NEXT = '전쟁|사변|동란|운동|혁명|의거|항쟁|민주|광복|해방|사태|선언|절';

// 영문 대문자 약어(2~4자)는 한 글자씩(Wolters 2007: 낯선 낱말일수록 어르신 청취가 떨어진다 → 엔진마다 다른 읽기를 하나로)
const LETTERS: Record<string, string> = {
  A: '에이', B: '비', C: '씨', D: '디', E: '이', F: '에프', G: '지', H: '에이치', I: '아이', J: '제이', K: '케이', L: '엘', M: '엠',
  N: '엔', O: '오', P: '피', Q: '큐', R: '알', S: '에스', T: '티', U: '유', V: '브이', W: '더블유', X: '엑스', Y: '와이', Z: '제트',
};
// 앱 글에 나오는 영문 이름(앱 정보 ai_music 등)
const WORDS: Record<string, string> = {Google: '구글', Lyria: '리리아'};

const WEEKDAY = '월화수목금토일';

/**
 * 읽기용 문장으로 바꾼다. 원칙(리드, #238 리뷰): **확실한 꼴만 바꾸고, 애매하면 원문 그대로 엔진에 맡긴다**(틀리게 바꾸는 것이 안 바꾸는 것보다 나쁘다).
 * 그래서 숫자는 읽기가 갈리는 곳(달 이름·세는 말 앞 고유어·기념일·시각·영하·개월)만 말로 바꾸고, 나머지 숫자(해·날·소수·전화번호·분수)는 그대로 둔다.
 * 순서: 날짜 → 기념일 → 시각·영하 → 범위 → 세는 말 → 단위 → 영문 → 괄호·기호 → 한 글자씩 → 정리. 두 번 돌려도 결과가 같다.
 */
export function toSpoken(text: string): string {
  let s = text.normalize('NFC');

  // 1. 날짜: YYYY.M.D·YYYY-M-D 만(M/D 는 분수와 헷갈려 다루지 않는다). 앞뒤가 숫자·붙임표면 전화번호 등이라 그대로
  s = s.replace(/(^|[^\d-])(\d{4})\s*[.\-/]\s*(\d{1,2})\s*[.\-/]\s*(\d{1,2})\.?(?![\d-])/g, (all, pre, y, m, d) =>
    validDate(+m, +d) ? `${pre}${y}년 ${+m}월 ${+d}일` : all,
  );
  s = s.replace(new RegExp(`\\s*\\(\\s*([${WEEKDAY}])(?:요일)?\\s*\\)`, 'g'), ' $1요일');
  s = s.replace(/(^|[^\d])([1-9]\d*)\s*개월/g, (_, pre, n) => `${pre}${sinoNumber(+n)} 개월`);
  s = s.replace(new RegExp(`(^|[^\\d.])(\\d{1,2})월${BOUNDARY}`, 'g'), (all, pre, n) => (+n >= 1 && +n <= 12 && n[0] !== '0' ? pre + month(+n) : all));

  // 2. 큰 수 쉼표(1,000) 지우기
  s = s.replace(/(\d),(?=\d{3}(?!\d))/g, '$1');
  // 3. 기념일: 달(1~9)·날 꼴의 가운뎃점(6·25, 3·1절), 또는 '전쟁' 등이 뒤따르는 마침표(6.25 전쟁) → 달은 수, 날은 한 자씩(육이오).
  //    10월 이상(10·26)·그 밖의 마침표(8.15)는 읽기가 갈려 그대로
  const anniversary = (all: string, pre: string, m: string, d: string) => (+d >= 1 && +d <= 31 ? pre + sinoNumber(+m) + digitsEach(d) : all);
  s = s.replace(/(^|[^\d.·ㆍ・])([1-9])\s*[·ㆍ・]\s*(\d{1,2})(?![\d·ㆍ・])/g, anniversary);
  s = s.replace(new RegExp(`(^|[^\\d.])([1-9])\\.(\\d{1,2})(?=\\s*(?:${ANNIVERSARY_NEXT}))`, 'g'), anniversary);

  // 4. 시각 10:30 → 열 시 30분(1~12시만, 분은 숫자 그대로), 영하 -3도 → 영하 3도
  s = s.replace(/(^|[^\d:])(\d{1,2}):([0-5]\d)(?![\d:])/g, (all, pre, h, m) => {
    const native = +h >= 1 && +h <= 12 && h[0] !== '0' ? nativeNumber(+h) : null;
    return native ? `${pre}${native} 시${+m > 0 ? ` ${+m}분` : ''}` : all;
  });
  s = s.replace(/(^|[^\dA-Za-z.-])-(\d+(?:\.\d+)?)\s*(?:℃|°C|°|도)/g, '$1영하 $2도');

  // 5. 범위 → '에서'. 숫자~숫자+세는 말·단위는 양쪽에 붙여(3~5개 → 3개에서 5개) 아래 규칙이 각각 읽게.
  //    세는 말이 붙은 범위(3시~5시, 오전 9시~오후 6시)는 물결만 '에서'로
  s = s.replace(
    new RegExp(`(\\d+(?:\\.\\d+)?)\\s*[~∼～]\\s*(\\d+(?:\\.\\d+)?)\\s*(?:(${NATIVE_COUNTERS})${BOUNDARY}|(${UNIT_RE})(?![A-Za-z]))?`, 'g'),
    (_, a, b, c, u) => {
      const tail = c ?? u ?? '';
      return `${a}${tail}에서 ${b}${tail}`;
    },
  );
  s = s.replace(/(\d[^\s~∼～]*)\s*[~∼～]\s*(?=\S*\d|오전|오후)/g, '$1에서 ');

  // 6. 세는 말 앞은 고유어(1~99, 0으로 시작하지 않음, 뒤가 낱말 경계일 때만). 시는 12 이하만, 번째의 1은 '첫'. 아니면 그대로
  s = s.replace(new RegExp(`(^|[^\\d.,:])([1-9]\\d?)\\s*(${NATIVE_COUNTERS})${BOUNDARY}`, 'g'), (all, pre, num, c) => {
    const n = Number(num);
    if (c === '번째' && n === 1) {
      return `${pre}첫 번째`;
    }
    const native = c === '시' && n > 12 ? null : nativeNumber(n);
    return native ? `${pre}${native} ${c}` : all;
  });

  // 7. 단위 기호 → 말(숫자는 그대로)
  s = s.replace(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(${UNIT_RE})(?![A-Za-z])`, 'g'), (_, num, u) => `${num} ${UNITS[u]}`);

  // 8. 영문: 아는 이름 → 한글, 대문자 약어 2~4자 → 한 글자씩. 한 글자(A4 의 A)·5자 이상(COVID)·소문자가 섞인 낱말은 엔진에 맡긴다
  s = s.replace(/[A-Za-z]+/g, w => WORDS[w] ?? (/^[A-Z]{2,4}$/.test(w) ? Array.from(w).map(ch => LETTERS[ch]).join('') : w));

  // 9. 따옴표·꺾쇠는 지운다(읽을 말이 아님)
  s = s.replace(/["“”‘’'「」『』《》〈〉<>]/g, '');
  // 10. 괄호: 앞에 짧은 쉼. 뒤에 한글(조사)이 바로 붙으면 그대로 잇고, 아니면 뒤에도 쉼
  s = s.replace(/\s*[([{]\s*([^()[\]{}]*?)\s*[)\]}](?=([가-힣])?)/g, (_, inner, next) => (next ? `, ${inner}` : `, ${inner},`));
  // 11. 가운뎃점·화살표 → 쉼표(숫자 사이 가운뎃점은 그대로: 10·26), 한글 사이 빗금 → 쉼표(1/2·A/S 는 그대로), 그리고(&)
  s = s.replace(/\s*[·ㆍ・‧∙→⇒]\s*/g, (m: string, at: number, all: string) => (/\d/.test(all[at - 1] ?? '') && /\d/.test(all[at + m.length] ?? '') ? m : ', '));
  s = s.replace(/([가-힣])\s*\/\s*(?=[가-힣])/g, '$1, ');
  s = s.replace(/\s*&\s*/g, ' 그리고 ');
  // 12. 말줄임표: 뒤가 공백·끝이면 마침표(문장 쉼), 문장 안이면 쉼표
  s = s.replace(/(?:…|⋯|\.{2,})+(\s|$)/g, '.$1');
  s = s.replace(/\s*(?:…|⋯|\.{2,})+\s*/g, ', ');
  // 13. 읽지 않는 기호
  s = s.replace(/[~∼～★☆♥♡❤●○◎◇◆□■△▲▽▼▶▷◀◁※#*_|^=+@]/g, ' ');

  // 14. 한 글자씩(copy tts.read.word '{낱말}. 한 글자씩, {글자들}.'): 글자마다 따로 말해 글자 사이를 문장 쉼으로(따라 쓰기)
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
