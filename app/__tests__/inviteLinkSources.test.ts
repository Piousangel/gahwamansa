import {Linking, NativeModules, Platform} from 'react-native';
import {
  INITIAL_INVITE_STATE,
  INVITE_TTL_SEC,
  codeFromInstallReferrer,
  codeFromInviteLink,
  familyCodeBanner,
  inviteAnalyticsEvent,
  inviteReducer,
  normalizeInviteCode,
  readInstallReferrerOnce,
  subscribeInviteCodes,
  type PendingInvite,
} from '../src/lib/linkSources';

describe('normalizeInviteCode: 6자리 숫자만', () => {
  test.each([
    ['123456', '123456'],
    ['123 456', '123456'],
    ['123-456', '123456'],
    [' 123456\n', '123456'],
  ])('%j → %s', (raw, want) => expect(normalizeInviteCode(raw)).toBe(want));

  test.each([['12345'], ['1234567'], ['12345a'], ['１２３４５６'], [''], [null], [123456]])(
    '%j 는 버린다',
    raw => expect(normalizeInviteCode(raw)).toBeNull(),
  );
});

describe('codeFromInviteLink: https://<도메인>/c#번호', () => {
  test.each([
    'https://example.test/c#123456',
    'https://example.test/c/#123456',
    'https://example.test/c?utm_source=kakao#123456',
    'https://Example.Test/c#123%20456',
    'https://example.test:443/c#123-456',
    'https://example.test/c?code=123456', // /c 페이지 intent:// 버튼 경로
    'https://example.test/c?code=999999#123456', // 조각 우선
  ])('%s → 123456', url => expect(codeFromInviteLink(url)).toBe('123456'));

  test.each([
    'http://example.test/c#123456', // https 만
    'https://example.test/c', // 조각 없음
    'https://example.test/x#123456', // 다른 경로
    'https://example.test/cx#123456',
    'https://example.test/c#12345',
    'https://example.test/c#%E0%A4%A', // 깨진 인코딩
    'https://example.test/c?code=12345',
    'https://example.test/c?xcode=123456',
    'bumojasik://c#123456',
    'kakao0000://oauth?code=123456', // 카카오 로그인 복귀 URL 과 섞이지 않게
  ])('%s → null', url => expect(codeFromInviteLink(url)).toBeNull());

  test('allowedHost 를 주면 다른 도메인은 거절', () => {
    expect(codeFromInviteLink('https://evil.test/c#123456', 'example.test')).toBeNull();
    expect(codeFromInviteLink('https://example.test/c#123456', 'EXAMPLE.test')).toBe('123456');
  });
});

describe('codeFromInstallReferrer: Play referrer 값', () => {
  const now = 2_000_000_000;
  test('code=123456', () => expect(codeFromInstallReferrer('code=123456', now - 60, now)).toBe('123456'));
  test('utm 파라미터가 섞여도 code 만', () =>
    expect(codeFromInstallReferrer('utm_source=kakao&code=654321&utm_medium=share', 0, now)).toBe('654321'));
  test('한 번 더 인코딩된 값도 푼다', () => expect(codeFromInstallReferrer('code%3D123456', 0, now)).toBe('123456'));
  test('오가닉 설치 기본값(utm_source=google-play)은 번호 없음', () =>
    expect(codeFromInstallReferrer('utm_source=google-play&utm_medium=organic', 0, now)).toBeNull());
  test('7일 넘은 클릭은 채우지 않는다', () => {
    expect(codeFromInstallReferrer('code=123456', now - INVITE_TTL_SEC - 1, now)).toBeNull();
    expect(codeFromInstallReferrer('code=123456', now - INVITE_TTL_SEC, now)).toBe('123456');
  });
  test.each([[''], ['code=12345'], ['code=abcdef'], ['xcode=123456'], [null]])('%j → null', r =>
    expect(codeFromInstallReferrer(r, 0, now)).toBeNull(),
  );
  test('512자 넘는 referrer 는 버린다', () =>
    expect(codeFromInstallReferrer('code=123456&x=' + '1'.repeat(600), 0, now)).toBeNull());
});

describe('inviteReducer / familyCodeBanner: 첫 화면 띠 값', () => {
  const link: PendingInvite = {code: '111111', source: 'app_link'};
  const ref: PendingInvite = {code: '222222', source: 'install_referrer'};

  test('처음엔 띠 없음', () => expect(familyCodeBanner(INITIAL_INVITE_STATE)).toEqual({visible: false, code: null}));

  test('받으면 띠에 번호', () => {
    const s = inviteReducer(INITIAL_INVITE_STATE, {type: 'received', invite: ref});
    expect(familyCodeBanner(s)).toEqual({visible: true, code: '222222'});
  });

  test('링크 번호가 있으면 설치 referrer 가 늦게 와도 덮지 않는다', () => {
    let s = inviteReducer(INITIAL_INVITE_STATE, {type: 'received', invite: link});
    s = inviteReducer(s, {type: 'received', invite: ref});
    expect(s.pending).toEqual(link);
  });

  test('referrer 다음에 링크가 오면 링크로 바꾼다(방금 누른 것)', () => {
    let s = inviteReducer(INITIAL_INVITE_STATE, {type: 'received', invite: ref});
    s = inviteReducer(s, {type: 'received', invite: link});
    expect(s.pending).toEqual(link);
  });

  test('새 링크는 이전 링크를 덮는다, 같은 값은 같은 객체', () => {
    let s = inviteReducer(INITIAL_INVITE_STATE, {type: 'received', invite: link});
    expect(inviteReducer(s, {type: 'received', invite: {...link}})).toBe(s);
    s = inviteReducer(s, {type: 'received', invite: {code: '333333', source: 'app_link'}});
    expect(s.pending?.code).toBe('333333');
  });

  test('consumed 면 띠가 사라진다', () => {
    const s = inviteReducer({pending: link}, {type: 'consumed'});
    expect(familyCodeBanner(s).visible).toBe(false);
    expect(inviteReducer(INITIAL_INVITE_STATE, {type: 'consumed'})).toBe(INITIAL_INVITE_STATE);
  });
});

test('분석 이벤트에는 번호 값이 없다(출처만)', () => {
  const ev = inviteAnalyticsEvent({code: '987654', source: 'install_referrer'});
  expect(ev).toEqual({name: 'invite_code_prefilled', params: {source: 'install_referrer'}});
  expect(JSON.stringify(ev)).not.toMatch(/\d{6}/);
});

describe('네이티브 연결(Install Referrer·Linking)', () => {
  const nm = NativeModules as {InstallReferrerModule?: unknown};
  const origOS = Platform.OS;
  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', {value: 'android', configurable: true});
  });
  afterEach(() => {
    delete nm.InstallReferrerModule;
    Object.defineProperty(Platform, 'OS', {value: origOS, configurable: true});
    jest.restoreAllMocks();
  });

  test('모듈이 없으면(iOS·테스트) null', async () => {
    await expect(readInstallReferrerOnce()).resolves.toBeNull();
  });

  test('referrer 를 번호로, 실패는 null', async () => {
    const getOnce = jest
      .fn()
      .mockResolvedValueOnce({referrer: 'code=123456', clickTs: 0})
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new Error('x'));
    nm.InstallReferrerModule = {getOnce};
    await expect(readInstallReferrerOnce()).resolves.toEqual({code: '123456', source: 'install_referrer'});
    await expect(readInstallReferrerOnce()).resolves.toBeNull();
    await expect(readInstallReferrerOnce()).resolves.toBeNull();
  });

  test('시작 링크·실행 중 링크·referrer 를 한 구독으로', async () => {
    let onUrl: ((e: {url: string}) => void) | undefined;
    const remove = jest.fn();
    jest.spyOn(Linking, 'addEventListener').mockImplementation(((_: string, cb: (e: {url: string}) => void) => {
      onUrl = cb;
      return {remove};
    }) as never);
    jest.spyOn(Linking, 'getInitialURL').mockResolvedValue('https://example.test/c#111111');
    nm.InstallReferrerModule = {getOnce: jest.fn().mockResolvedValue({referrer: 'code=222222', clickTs: 0})};
    const got: PendingInvite[] = [];
    const unsub = subscribeInviteCodes(i => got.push(i));
    await new Promise<void>(r => setTimeout(() => r(), 0));
    onUrl?.({url: 'https://example.test/c#333333'});
    onUrl?.({url: 'https://example.test/other'});
    expect(got).toEqual(
      expect.arrayContaining([
        {code: '111111', source: 'app_link'},
        {code: '222222', source: 'install_referrer'},
        {code: '333333', source: 'app_link'},
      ]),
    );
    expect(got).toHaveLength(3);
    unsub();
    expect(remove).toHaveBeenCalled();
    onUrl?.({url: 'https://example.test/c#444444'});
    expect(got).toHaveLength(3);
  });
});
