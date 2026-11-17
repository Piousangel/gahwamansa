import {createLocalStamps, kstDate, memoryStore} from '../src/lib/localStamps';

// 미연결 기기 도장(리드 결정): 날짜 문자열 목록만, 7일 지나면 정리, 같은 날 한 번, 손상된 값은 빈 목록, 연결 뒤 지움.
const at = (iso: string) => () => new Date(iso);

test('kstDate: UTC 15시 이후는 KST 다음 날', () => {
  expect(kstDate(new Date('2026-11-19T14:59:00Z'))).toBe('2026-11-19');
  expect(kstDate(new Date('2026-11-19T15:00:00Z'))).toBe('2026-11-20');
});

test('오늘 추가: 같은 날 여러 번이어도 한 번, 날짜 문자열만 저장', async () => {
  const store = memoryStore();
  const s = createLocalStamps(store, at('2026-11-20T03:00:00Z'));
  expect(await s.read()).toEqual([]);
  await s.addToday();
  expect(await s.addToday()).toEqual(['2026-11-20']);
  expect(await store.getItem('local_week_stamps_v1')).toBe('["2026-11-20"]');
});

test('7일 지난 날짜는 읽을 때 정리하고 다시 저장한다(오늘-6 까지 남김), 미래·형식 오류는 버린다', async () => {
  const store = memoryStore();
  await store.setItem('local_week_stamps_v1', JSON.stringify(['2026-11-13', '2026-11-14', '2026-11-20', '2026-11-21', 'nope', 3]));
  const s = createLocalStamps(store, at('2026-11-20T03:00:00Z'));
  expect(await s.read()).toEqual(['2026-11-14', '2026-11-20']);
  expect(await store.getItem('local_week_stamps_v1')).toBe('["2026-11-14","2026-11-20"]');
});

test('손상된 값·저장소 오류는 빈 목록(화면을 막지 않음)', async () => {
  const store = memoryStore();
  await store.setItem('local_week_stamps_v1', '{깨짐');
  expect(await createLocalStamps(store, at('2026-11-20T03:00:00Z')).read()).toEqual([]);
  const broken = {
    getItem: async () => {
      throw new Error('x');
    },
    setItem: async () => {
      throw new Error('x');
    },
    removeItem: async () => {
      throw new Error('x');
    },
  };
  const s = createLocalStamps(broken, at('2026-11-20T03:00:00Z'));
  expect(await s.read()).toEqual([]);
  expect(await s.addToday()).toEqual(['2026-11-20']);
  await expect(s.clear()).resolves.toBeUndefined();
});

test('연결 뒤 지우기', async () => {
  const store = memoryStore();
  const s = createLocalStamps(store, at('2026-11-20T03:00:00Z'));
  await s.addToday();
  await s.clear();
  expect(await s.read()).toEqual([]);
  expect(await store.getItem('local_week_stamps_v1')).toBeNull();
});

test('지우기에서 removeItem 이 실패하면 빈 목록을 덮어써 남지 않게 한다', async () => {
  const mem = memoryStore();
  const store = {
    ...mem,
    removeItem: async () => {
      throw new Error('x');
    },
  };
  const s = createLocalStamps(store, at('2026-11-20T03:00:00Z'));
  await s.addToday();
  await s.clear();
  expect(await s.read()).toEqual([]);
});
