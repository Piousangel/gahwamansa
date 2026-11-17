/* 자녀 흐름 통합 테스트(로컬 Supabase + Mailpit).
 * 메일 인증번호 시나리오는 로컬 메일 템플릿에 6자리 번호({{ .Token }})가 있어야 통과한다. */
import {loadConfig} from '../src/lib/config';
import {createSupabase} from '../src/lib/supabase';
import {createRealApi} from '../src/features/realApi';

const {SUPABASE_URL, SUPABASE_KEY} = loadConfig();
const MAILPIT = 'http://127.0.0.1:54324';
const rid = () => `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

async function latestCodeFor(email: string): Promise<{text: string; code: string | null}> {
  for (let i = 0; i < 10; i++) {
    const s = await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`)).json();
    if (s.messages?.length) {
      const m = await (await fetch(`${MAILPIT}/api/v1/message/${s.messages[0].ID}`)).json();
      const text: string = m.Text ?? '';
      return {text, code: text.match(/(?<![0-9a-f])(\d{6})(?![0-9a-f])/)?.[1] ?? null};
    }
    await new Promise(r => setTimeout(() => r(null), 300));
  }
  throw new Error(`메일을 찾지 못했어요: ${email}`);
}

test('메일 인증번호로 자녀 로그인(Mailpit 에서 번호를 읽어 확인)', async () => {
  const email = `child-otp-${rid()}@example.test`;
  const api = createRealApi(createSupabase(SUPABASE_URL, SUPABASE_KEY));
  await api.sendEmailCode(email);
  const {code} = await latestCodeFor(email);
  if (!code) {
    throw new Error('메일 본문에 6자리 번호가 없어요. supabase 메일 템플릿(magic_link)에 {{ .Token }} 이 필요합니다.');
  }
  await api.verifyEmailCode(email, code);
  expect(await api.getChildState()).toEqual({kind: 'no_family'});
});

test('자녀 상태: 가족 없음 -> 가족·호칭·번호(대기) -> 어르신 연결 후 연결됨', async () => {
  const childSb = createSupabase(SUPABASE_URL, SUPABASE_KEY);
  const child = createRealApi(childSb);
  await child.signUpChild(`child-flow-${rid()}@example.test`, `Pw-${rid()}`);
  expect(await child.getChildState()).toEqual({kind: 'no_family'});
  await child.createFamily();
  expect(await child.setParentTitle('아빠')).toEqual({ok: true});
  const code = await child.issueInviteCode();
  const waiting = await child.getChildState();
  expect(waiting).toMatchObject({kind: 'family', parentTitle: '아빠', linked: false, code: {code}});
  const parent = createRealApi(createSupabase(SUPABASE_URL, SUPABASE_KEY));
  expect(await parent.redeemInviteCode(code)).toMatchObject({ok: true});
  expect(await child.getChildState()).toMatchObject({kind: 'family', linked: true});
  // 정리: 어르신·자녀(마지막 자녀 -> 가족 전체)
  await parent.deleteMyAccount();
  await child.deleteMyAccount();
});

test('whoAmI: 세션 없음 none / 익명+프로필 없음 none / 연결된 어르신 parent / 자녀 child', async () => {
  const fresh = createRealApi(createSupabase(SUPABASE_URL, SUPABASE_KEY));
  expect(await fresh.whoAmI()).toBe('none');
  await fresh.getTodayContent(); // 미연결 열람: 익명 세션만 생김
  expect(await fresh.whoAmI()).toBe('none');

  const child = createRealApi(createSupabase(SUPABASE_URL, SUPABASE_KEY));
  await child.signUpChild(`child-who-${rid()}@example.test`, `Pw-${rid()}`);
  expect(await child.whoAmI()).toBe('child');
  await child.createFamily();
  const code = await child.issueInviteCode();
  const parent = createRealApi(createSupabase(SUPABASE_URL, SUPABASE_KEY));
  await parent.redeemInviteCode(code);
  expect(await parent.whoAmI()).toBe('parent');
  await parent.deleteMyAccount();
  await child.deleteMyAccount();
});
