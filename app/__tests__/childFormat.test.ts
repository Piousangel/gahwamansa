import {buildShareMessage, formatExpiry, pairShort} from '../src/lib/childFormat';
import {copy} from '../src/copy/copy';

test('만료 시각은 KST 날짜 + 오전/오후 시(분은 있을 때만, 다른 해는 연도)', () => {
  const now = new Date('2026-11-17T03:00:00Z');
  expect(formatExpiry('2026-11-24T06:00:00Z', now)).toBe('11월 24일 오후 3시');
  expect(formatExpiry('2026-11-25T01:00:00Z', now)).toBe('11월 25일 오전 10시');
  expect(formatExpiry('2026-11-24T06:30:00Z', now)).toBe('11월 24일 오후 3시 30분');
  expect(formatExpiry('2026-11-23T15:00:00Z', now)).toBe('11월 24일 오전 12시');
  expect(formatExpiry('2026-11-24T03:00:00Z', now)).toBe('11월 24일 오후 12시');
  expect(formatExpiry('2026-12-31T16:00:00Z', now)).toBe('2027년 1월 1일 오전 1시');
});

test('질문 짧은 형: 받침이면 과, 아니면 와', () => {
  expect(pairShort('봄', '가을')).toBe('봄과 가을 중');
  expect(pairShort('산', '바다')).toBe('산과 바다 중');
  expect(pairShort('라디오', '텔레비전')).toBe('라디오와 텔레비전 중');
  expect(pairShort('기차', '버스')).toBe('기차와 버스 중');
  expect(pairShort('곶감', '홍시')).toBe('곶감과 홍시 중');
});

test('공유 메시지(C2_share): 설치 3단계 + 3자리씩 띄운 번호 + 기한 + 안심 한 줄', () => {
  expect(buildShareMessage(copy.code.share, '482915', '11월 24일 오후 3시').split('\n')).toEqual([
    '가화만사성에서 같이 쓸 번호예요.',
    '1. Play 스토어에서 가화만사성을 설치해요',
    "2. 첫 화면에서 '부모님 휴대폰이에요'를 눌러요",
    '3. 번호 6개를 써요: 482 915',
    '11월 24일 오후 3시까지 쓸 수 있어요.',
    '이 앱은 돈이나 은행 번호를 묻지 않아요.',
  ]);
  const m = buildShareMessage(copy.code.share, '123456', null); // 막 만든 번호: 기한 시각을 모름
  expect(m).toContain('7일 동안 쓸 수 있어요.');
  expect(m).not.toMatch(/\{|사기/);
});
