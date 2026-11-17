import {buildShareMessage, formatExpiry, pairShort, shareLink} from '../src/lib/childFormat';
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

test('공유 메시지(라이터 확정 11-1 #5, 6줄): 사람 말 + 링크 + 이 번호로 연결 + 번호 단독 줄 + 기한·안심', () => {
  const m = buildShareMessage(copy.code.share, copy.safe.money, '482915', '11월 24일 오후 3시', 'https://example.test/c#482915');
  expect(m.split('\n')).toEqual([
    '가화만사성에서 같이 쓸 연결 번호예요.',
    '링크를 눌러 앱을 설치하고 열어 주세요.',
    'https://example.test/c#482915',
    "첫 화면에서 '부모님 휴대폰이에요'를 누르고 이 번호로 연결해요.",
    '482 915',
    '11월 24일 오후 3시까지 쓸 수 있어요. 이 앱은 돈이나 통장 번호를 묻지 않아요.',
  ]);
});

test('공유 메시지: 링크 주소가 없으면(도메인 미정) 링크 줄을 빼고 설치 안내를 스토어로, 기한 모르면 7일', () => {
  const lines = buildShareMessage(copy.code.share, copy.safe.money, '123456', null, null).split('\n');
  expect(lines).toHaveLength(5);
  expect(lines[1]).toBe('Play 스토어에서 가화만사성을 설치해 주세요.');
  expect(lines[3]).toBe('123 456');
  expect(lines[4]).toBe('7일 동안 쓸 수 있어요. 이 앱은 돈이나 통장 번호를 묻지 않아요.');
  expect(lines.join('\n')).not.toMatch(/\{|http/);
});

test('공유 링크: https 주소가 있을 때만 번호를 URL 조각(#)에 붙인다(서버 기록에 남지 않게)', () => {
  expect(shareLink('https://gahwa.example/c', '123456')).toBe('https://gahwa.example/c#123456');
  expect(shareLink('https://gahwa.example/c/', '123456')).toBe('https://gahwa.example/c#123456');
  expect(shareLink('', '123456')).toBeNull();
  expect(shareLink('http://gahwa.example/c', '123456')).toBeNull();
});
