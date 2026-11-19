import {Linking, NativeModules, Platform} from 'react-native';
import {
  EMPTY_INVITE_STORE,
  INVITE_KEEP_SEC,
  INVITE_TTL_SEC,
  applyInvite,
  codeFromInstallReferrer,
  codeFromInviteLink,
  consumeInviteStore,
  familyCodeBanner,
  inviteAnalyticsEvent,
  inviteLinkId,
  normalizeInviteCode,
  parseInviteStore,
  serializeInviteStore,
  type InviteStore,
  type PendingInvite,
} from '../src/lib/linkSources/inviteCode';
import {
  __resetInviteSourcesForTests,
  consumeInvite,
  readInstallReferrerOnce,
  startInviteSources,
  subscribeInvite,
} from '../src/lib/linkSources/native';

declare const __dirname: string;
const fs: {readFileSync(f: string, e: 'utf8'): string} = require('fs');
const root = `${__dirname}/..`;

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

describe('codeFromInviteLink: https://<도메인>/c#번호 (조각만, 허용 도메인만)', () => {
  const H = 'example.test';
  test.each([
    'https://example.test/c#123456',
    'https://example.test/c/#123456',
    'https://example.test/c?utm_source=kakao#123456',
    'https://Example.Test/c#123%20456',
    'https://example.test:443/c#123-456',
  ])('%s → 123456', url => expect(codeFromInviteLink(url, H)).toBe('123456'));

  test.each([
    'http://example.test/c#123456', // https 만
    'https://example.test/c', // 조각 없음
    'https://example.test/c?code=123456', // 쿼리는 서버로 가므로 받지 않는다(조각만)
    'https://example.test/x#123456', // 다른 경로
    'https://example.test/cx#123456',
    'https://example.test/c#12345',
    'https://example.test/c#%E0%A4%A', // 깨진 인코딩
    'bumojasik://c#123456',
    'kakao0000://oauth?code=123456', // 카카오 로그인 복귀 URL 과 섞이지 않게
    'https://evil.test/c#999999', // 명시적 인텐트로 온 다른 도메인(리뷰 M3)
    'https://sub.example.test/c#123456',
  ])('%s → null', url => expect(codeFromInviteLink(url, H)).toBeNull());

  test('허용 도메인이 비었으면(도메인 미정) 링크 출처를 끈다', () => {
    expect(codeFromInviteLink('https://example.test/c#123456', '')).toBeNull();
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

describe('기기 저장 상태(리뷰 H1·M2): 만료 시각과 함께 저장, 쓰면·만료되면 삭제, 처리한 시작 링크 무시', () => {
  const now = 2_000_000_000;
  const link: PendingInvite = {code: '111111', source: 'app_link'};
  const ref: PendingInvite = {code: '222222', source: 'referrer'};

  test('처음엔 띠 없음', () =>
    expect(familyCodeBanner(EMPTY_INVITE_STORE, now)).toEqual({visible: false, code: null, source: null}));

  test('받으면 만료 시각과 함께 저장되고 띠에 번호', () => {
    const s = applyInvite(EMPTY_INVITE_STORE, link, {nowSec: now});
    expect(s.pending).toEqual({...link, expiresAt: now + INVITE_KEEP_SEC});
    expect(familyCodeBanner(s, now)).toEqual({visible: true, code: '111111', source: 'app_link'});
  });

  test('referrer 는 Play 클릭 시각 + 7일까지만', () => {
    const s = applyInvite(EMPTY_INVITE_STORE, ref, {nowSec: now, clickTs: now - 100});
    expect(s.pending?.expiresAt).toBe(now - 100 + INVITE_KEEP_SEC);
  });

  test('만료되면 띠가 사라지고, 읽을 때 저장소에서도 지운다', () => {
    const s = applyInvite(EMPTY_INVITE_STORE, link, {nowSec: now});
    const later = now + INVITE_KEEP_SEC + 1;
    expect(familyCodeBanner(s, later).visible).toBe(false);
    expect(parseInviteStore(serializeInviteStore(s), later).pending).toBeNull();
  });

  test('저장 → 재시작(파싱) 후 같은 번호가 다시 나온다', () => {
    const s = applyInvite(EMPTY_INVITE_STORE, ref, {nowSec: now});
    const back = parseInviteStore(serializeInviteStore(s), now + 60);
    expect(familyCodeBanner(back, now + 60)).toEqual({visible: true, code: '222222', source: 'referrer'});
  });

  test('consumed 면 번호를 지운다(같은 객체 아님 → 저장 갱신)', () => {
    const s = applyInvite(EMPTY_INVITE_STORE, link, {nowSec: now});
    const c = consumeInviteStore(s);
    expect(c.pending).toBeNull();
    expect(consumeInviteStore(c)).toBe(c);
  });

  test('링크 번호가 있으면 늦게 온 referrer 로 덮지 않고, referrer 뒤 링크는 링크로 바꾼다', () => {
    let s = applyInvite(EMPTY_INVITE_STORE, link, {nowSec: now});
    expect(applyInvite(s, ref, {nowSec: now})).toBe(s);
    s = applyInvite(EMPTY_INVITE_STORE, ref, {nowSec: now});
    expect(applyInvite(s, link, {nowSec: now}).pending?.code).toBe('111111');
  });

  test('처리한 시작 링크는 다시 와도(최근 앱에서 재실행) 무시. 저장에는 번호가 아니라 해시만', () => {
    const url = 'https://example.test/c#111111';
    const id = inviteLinkId(url);
    let s = applyInvite(EMPTY_INVITE_STORE, link, {nowSec: now, initialLinkId: id});
    s = consumeInviteStore(s);
    expect(applyInvite(s, link, {nowSec: now + 10, initialLinkId: id})).toBe(s);
    // 실행 중 새로 누른 링크(initialLinkId 없음)는 다시 받는다
    expect(applyInvite(s, link, {nowSec: now + 10}).pending?.code).toBe('111111');
    expect(serializeInviteStore(s)).not.toContain('111111');
    expect(id).toMatch(/^[0-9a-f]{64}$/);
  });

  test('처리 목록은 20개까지, 만료된 건 버린다', () => {
    let s: InviteStore = EMPTY_INVITE_STORE;
    for (let i = 0; i < 30; i++) {
      s = applyInvite(s, {code: String(100000 + i), source: 'app_link'}, {nowSec: now, initialLinkId: `id${i}`});
    }
    expect(s.handled).toHaveLength(20);
    expect(parseInviteStore(serializeInviteStore(s), now + INVITE_KEEP_SEC + 1).handled).toHaveLength(0);
  });

  test.each([[null], [''], ['{'], ['[]'], ['{"v":2}'], ['{"v":1,"pending":{"code":"12","source":"app_link","expiresAt":1}}']])(
    '깨진 저장값 %j 는 빈 상태',
    raw => expect(parseInviteStore(raw, now)).toEqual(EMPTY_INVITE_STORE),
  );
});

test('분석 이벤트에는 번호 값이 없다(출처만)', () => {
  const ev = inviteAnalyticsEvent({code: '987654', source: 'referrer'});
  expect(ev).toEqual({name: 'code_prefilled', params: {source: 'referrer'}});
  expect(JSON.stringify(ev)).not.toMatch(/\d{6}/);
});

describe('네이티브 연결(앱 전용 저장소·Install Referrer·Linking)', () => {
  const nm = NativeModules as {InviteModule?: unknown};
  const origOS = Platform.OS;
  let saved: string | null;
  let urlCb: ((e: {url: string}) => void) | undefined;
  const flush = () => new Promise<void>(r => setTimeout(() => r(), 0));

  function mockNative(referrer: {referrer: string; clickTs: number} | null, initialUrl: string | null) {
    nm.InviteModule = {
      getReferrerOnce: jest.fn().mockResolvedValue(referrer),
      readStore: jest.fn(async () => saved),
      writeStore: jest.fn(async (v: string | null) => {
        saved = v;
      }),
    };
    jest.spyOn(Linking, 'addEventListener').mockImplementation(((_: string, cb: (e: {url: string}) => void) => {
      urlCb = cb;
      return {remove: jest.fn()};
    }) as never);
    jest.spyOn(Linking, 'getInitialURL').mockResolvedValue(initialUrl);
  }

  beforeEach(() => {
    jest.clearAllMocks(); // RN jest 프리셋의 Linking 은 이미 jest.fn 이라 spyOn 이 호출 수를 이어받는다
    saved = null;
    urlCb = undefined;
    Object.defineProperty(Platform, 'OS', {value: 'android', configurable: true});
    __resetInviteSourcesForTests({appLinkHost: 'example.test'});
  });
  afterEach(() => {
    delete nm.InviteModule;
    Object.defineProperty(Platform, 'OS', {value: origOS, configurable: true});
    jest.restoreAllMocks();
  });

  test('모듈이 없으면(iOS·테스트) referrer null, 시작해도 오류 없음', async () => {
    await expect(readInstallReferrerOnce()).resolves.toBeNull();
    jest.spyOn(Linking, 'getInitialURL').mockResolvedValue(null);
    await expect(startInviteSources()).resolves.toBeUndefined();
  });

  test('referrer 를 번호로, 실패는 null', async () => {
    const getReferrerOnce = jest
      .fn()
      .mockResolvedValueOnce({referrer: 'code=123456', clickTs: 0})
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new Error('x'));
    nm.InviteModule = {getReferrerOnce};
    await expect(readInstallReferrerOnce()).resolves.toEqual({
      invite: {code: '123456', source: 'referrer'},
      clickTs: 0,
    });
    await expect(readInstallReferrerOnce()).resolves.toBeNull();
    await expect(readInstallReferrerOnce()).resolves.toBeNull();
  });

  test('시작은 한 번만(여러 번 불러도 네이티브·Linking 1회), 받은 번호는 앱 전용 저장소에', async () => {
    mockNative({referrer: 'code=222222', clickTs: 0}, null);
    await Promise.all([startInviteSources(), startInviteSources()]);
    await flush();
    const mod = nm.InviteModule as {getReferrerOnce: jest.Mock};
    expect(mod.getReferrerOnce).toHaveBeenCalledTimes(1);
    expect(Linking.addEventListener).toHaveBeenCalledTimes(1);
    expect(JSON.parse(saved as string).pending.code).toBe('222222');
  });

  test('재구독해도 같은 시작 링크를 다시 띄우지 않고, consumed 뒤에는 띠가 돌아오지 않는다', async () => {
    mockNative(null, 'https://example.test/c#111111');
    await startInviteSources();
    await flush();
    const seen: Array<string | null> = [];
    const off1 = subscribeInvite(b => seen.push(b.code));
    off1();
    await consumeInvite();
    const off2 = subscribeInvite(b => seen.push(b.code));
    off2();
    expect(seen).toEqual(['111111', null]);
    expect(JSON.parse(saved as string).pending).toBeNull();

    // 프로세스 재시작 + 최근 앱에서 같은 인텐트 재전달 → 저장된 처리 ID 로 무시
    __resetInviteSourcesForTests({appLinkHost: 'example.test'});
    await startInviteSources();
    await flush();
    const after: Array<string | null> = [];
    subscribeInvite(b => after.push(b.code))();
    expect(after).toEqual([null]);
  });

  test('구독자가 없던 사이 온 번호도 저장소에서 다시 나온다(H1: 프로세스 종료·재마운트)', async () => {
    mockNative({referrer: 'code=333333', clickTs: 0}, null);
    await startInviteSources();
    await flush();
    __resetInviteSourcesForTests({appLinkHost: 'example.test'});
    (nm.InviteModule as {getReferrerOnce: jest.Mock}).getReferrerOnce.mockResolvedValue(null);
    await startInviteSources();
    await flush();
    const got: Array<string | null> = [];
    subscribeInvite(b => got.push(b.code))();
    expect(got).toEqual(['333333']);
  });

  test('실행 중 새 링크는 받고, 다른 도메인·도메인 미정이면 무시', async () => {
    mockNative(null, null);
    await startInviteSources();
    const got: Array<string | null> = [];
    const off = subscribeInvite(b => got.push(b.code));
    urlCb?.({url: 'https://evil.test/c#999999'});
    await flush();
    urlCb?.({url: 'https://example.test/c#444444'});
    await flush();
    off();
    expect(got).toEqual([null, '444444']);

    __resetInviteSourcesForTests({appLinkHost: ''});
    saved = null;
    await startInviteSources();
    urlCb?.({url: 'https://example.test/c#555555'});
    await flush();
    expect(saved).toBeNull();
  });
});

describe('build.gradle·매니페스트·안내 페이지 규칙(리뷰 M1·M3·L1)', () => {
  const g = fs.readFileSync(`${root}/android/app/build.gradle`, 'utf8');
  test('host 원본은 env 파일, -P 덮어쓰기는 debug 빌드 타입에만', () => {
    expect(g).not.toMatch(/findProperty\("appLinkHost"\)/);
    expect(g).toMatch(/appLinkHostDebug/);
    expect(g).toMatch(/buildTypes[\s\S]*debug[\s\S]*manifestPlaceholders/);
  });
  // 검사·생성은 공통 스크립트(scripts/appEnv.js, iOS 준비 N2)
  const envScript = fs.readFileSync(`${root}/scripts/appEnv.js`, 'utf8');
  test('production 에 테스트 도메인이면 빌드 실패, staging·production 같은 도메인 금지', () => {
    expect(envScript).toMatch(/TEST_HOST_RE/);
    expect(envScript).toMatch(/APP_LINK_HOST 가 staging 과 production 에서 같아요/);
  });
  test('APP_LINK_HOST 를 env.generated.ts 로 JS 에 넘긴다', () => {
    expect(envScript).toMatch(/APP_LINK_HOST: linkHost/);
  });

  const page = fs.readFileSync(`${root}/../site/c/index.html`, 'utf8');
  test('안내 페이지: 번호는 조각·intent 엑스트라로만(쿼리 ?code= 금지), 동결 시안 문구', () => {
    expect(page).not.toMatch(/\?code=/);
    expect(page).toMatch(/S\.code=/);
    expect(page).toMatch(/가족이 보낸 연결 번호예요/);
    expect(page).toMatch(/가화만사성 앱에서 열기/);
    expect(page).toMatch(/Play 스토어에서 받기/);
    expect(page).toMatch(/이 앱은 돈이나 은행 번호를 묻지 않아요/);
    expect(page).not.toMatch(/7일/);
    expect(page).toMatch(/textContent/);
    expect(page).not.toMatch(/innerHTML/);
  });
});

describe('안내 페이지 스크립트 동작(가짜 DOM)', () => {
  const page = fs.readFileSync(`${root}/../site/c/index.html`, 'utf8');
  const script = (/<script>([\s\S]*?)<\/script>/.exec(page) as RegExpExecArray)[1];
  type El = {hidden: boolean; href: string; textContent: string; addEventListener: jest.Mock};
  const GahwaPlatform = require('../../site/c/platform.js') as {detectPlatform: (ua: string, t?: number) => string};
  function run(hash: string, ua: string, withPlatformJs = true) {
    const els: Record<string, El> = {};
    const get = (id: string) =>
      els[id] || (els[id] = {hidden: true, href: '', textContent: '', addEventListener: jest.fn()});
    const doc = {getElementById: get, querySelectorAll: () => [], visibilityState: 'visible'};
    const win = withPlatformJs ? {GahwaPlatform} : {};
    // eslint-disable-next-line no-new-func
    new Function('document', 'location', 'navigator', 'window', script)(doc, {hash}, {userAgent: ua}, win);
    return els;
  }
  const PLAY = 'https://play.google.com/store/apps/details?id=com.bumojasik.app';
  // 가짜 DOM 은 스크립트가 건드린 요소만 만든다. 안 건드린 요소는 HTML 의 hidden 그대로
  const shown = (els: Record<string, El>, id: string) => els[id]?.hidden === false;

  test('Android: 번호 3·3 표시, intent 는 S.code 엑스트라 + Play(referrer) 폴백, 쿼리에 번호 없음', () => {
    const els = run('#123456', 'Mozilla/5.0 (Linux; Android 14) KAKAOTALK');
    expect(els.code.textContent).toBe('123 456');
    expect(shown(els, 'state-open')).toBe(true);
    expect(shown(els, 'state-install')).toBe(false);
    const href = els['open-app'].href;
    expect(href).toMatch(/^intent:\/\/example\.test\/c#Intent;scheme=https;package=com\.bumojasik\.app;S\.code=123456;/);
    expect(href).toContain(encodeURIComponent(`${PLAY}&referrer=code%3D123456`));
    expect(href).not.toMatch(/\?code=/);
    expect(els.install.href).toBe(`${PLAY}&referrer=code%3D123456`);
  });

  test('iPhone: 아이폰 안내(Play 링크·버튼 없음), 번호는 보인다', () => {
    const els = run('#123%20456', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)');
    expect(els.code.textContent).toBe('123 456');
    expect(shown(els, 'state-ios')).toBe(true);
    expect(shown(els, 'state-open')).toBe(false);
    expect(shown(els, 'state-install')).toBe(false);
    expect(els.install?.href ?? '').toBe('');
  });

  test('데스크톱: 휴대폰 안내, Play 링크 없음', () => {
    const els = run('#123456', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
    expect(shown(els, 'state-desktop')).toBe(true);
    expect(shown(els, 'state-open')).toBe(false);
    expect(els.install?.href ?? '').toBe('');
  });

  test('platform.js 를 못 읽어도 Android 는 앱 열기 + 번호', () => {
    const els = run('#123456', 'Mozilla/5.0 (Linux; Android 14)', false);
    expect(els.code.textContent).toBe('123 456');
    expect(shown(els, 'state-open')).toBe(true);
  });

  test.each(['#abc', '', '#<img src=x onerror=alert(1)>', '#1234567'])(
    '번호 없음·조작 %j → 손 입력 안내, 번호 표시 없음',
    h => {
      const els = run(h, 'Android');
      expect(shown(els, 'no-code')).toBe(true);
      expect(els.code).toBeUndefined();
      expect(els['install-plain'].href).toBe(PLAY);
    },
  );
});
