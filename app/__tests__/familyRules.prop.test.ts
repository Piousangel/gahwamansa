// 속성 기반 테스트(운영 규칙 11-20): 답 공유 동의·초대 번호 — 임의 순서의 액션을 fake API(모든 화면 테스트가 쓰는 서버 대역)에 넣고
// 작은 모델(상태 전이 표)과 같은지, 서버 규칙(불변식)이 지켜지는지 본다. 서버 자체는 pgTAP(supabase/tests) 몫이고, 여기서는 fake 가 서버 규칙과
// 어긋나지 않게 지킨다(어긋나면 화면 테스트가 서버에서는 일어나지 않는 흐름을 통과시킨다).
//
// 답 공유 동의 전이 표(서버 0012 give_consent·0035 29행 버전 형식, save_answer 는 동의 없으면 consent_required):
// | 상태\액션        | give      | withdraw            | save(A/B)            |
// | 동의 안 함        | 동의함    | 그대로(답 없음)       | 실패(consent_required) |
// | 동의함·답 없음    | 그대로    | 동의 안 함            | 동의함·답 있음          |
// | 동의함·답 있음    | 그대로    | 동의 안 함·답 지움     | 답 바꿈                |
// 불변식: 자녀에게 보이는 최근 답(latest) ≠ null ⇔ 동의함 ∧ (마지막 철회 뒤 저장한 답이 있음)
//
// 초대 번호 전이 표(서버 supabase/migrations/20261116000028_history_peek_notify.sql redeem_invite_code, 0018 새 번호면 이전 번호 무효):
// | 상태\액션                 | 발급(issue)    | 맞는 번호 쓰기(지금 계정 = 쓴 사람) | 맞는 번호 쓰기(다른 계정) | 틀린 번호 | 계정 바꾸기 |
// | 안 씀                      | 안 씀(새 번호)  | 씀(쓴 사람 = 지금 계정)·연결       | 씀(쓴 사람 = 그 계정)·연결 | 실패      | 그대로      |
// | 씀                         | 안 씀(새 번호)  | ok(재시도 멱등, 226~231행)         | 실패 'used'(250~255행)     | 실패      | 그대로      |
// 불변식: 번호를 쓴 사람은 하나뿐(다른 사람은 used), 같은 사람의 재시도는 ok, 틀린 번호로는 연결되지 않는다, 연결되면 자녀에게 보내던 번호는 더 보이지 않는다
// (#181 첫 판은 '한 번 쓰면 누구든 used' 로 모델을 잘못 잡았다 — 서버 SQL 을 근거로 다시 썼다. 리뷰 H1)
import fc from 'fast-check';
import '../testUtils/fcSeed';
import {createFakeApi} from '../src/features/fakeApi';
import {CONSENT_VERSION} from '../src/copy/copy';

type ConsentAct = {k: 'give'} | {k: 'withdraw'} | {k: 'save'; choice: 'A' | 'B'};
const consentAct: fc.Arbitrary<ConsentAct> = fc.oneof(
  fc.constant({k: 'give'} as const),
  fc.constant({k: 'withdraw'} as const),
  fc.constantFrom('A' as const, 'B' as const).map(choice => ({k: 'save' as const, choice})),
);

test('답 공유 동의: 동의 없으면 답이 저장되지 않고 자녀에게 보이지 않는다, 철회하면 보이던 답도 사라진다', async () => {
  await fc.assert(
    fc.asyncProperty(fc.boolean(), fc.array(consentAct, {maxLength: 30}), async (start, acts) => {
      const api = createFakeApi({consented: start, linked: true});
      const m = {consented: start, saved: false};
      for (const a of acts) {
        if (a.k === 'give') {
          await api.giveConsent(CONSENT_VERSION);
          m.consented = true;
        } else if (a.k === 'withdraw') {
          await api.withdrawConsent();
          m.consented = false;
          m.saved = false;
        } else {
          let threw = false;
          try {
            await api.saveAnswer({choice: a.choice} as never);
          } catch (e) {
            threw = (e as {reason?: string}).reason === 'consent_required' || /consent_required/.test(String(e));
          }
          if (threw !== !m.consented) {
            return false; // 저장 실패 여부가 동의와 어긋남
          }
          if (m.consented) {
            m.saved = true;
          }
        }
        const s = await api.fetchChildSummary();
        const visible = s.latest !== null;
        if (s.shared !== m.consented || visible !== (m.consented && m.saved)) {
          return false;
        }
      }
      return true;
    }),
    {numRuns: 300},
  );
});

type InviteAct = {k: 'issue'} | {k: 'switch'; who: 'A' | 'B' | 'C'} | {k: 'peek'} | {k: 'redeem'; right: boolean; wrong: string};
const inviteAct: fc.Arbitrary<InviteAct> = fc.oneof(
  fc.constant({k: 'issue'} as const),
  fc.constantFrom('A' as const, 'B' as const, 'C' as const).map(who => ({k: 'switch' as const, who})),
  fc.constant({k: 'peek'} as const),
  fc.record({k: fc.constant('redeem' as const), right: fc.boolean(), wrong: fc.stringMatching(/^[0-9]{6}$/).filter(c => !['123456', '000000', '111111', '222222', '333333', '444444', '555555'].includes(c))}),
);

test('초대 번호: 쓴 사람만 다시 써도 ok(멱등), 다른 사람은 used, 틀린 번호로는 연결되지 않고, 연결되면 보내던 번호가 사라진다', async () => {
  await fc.assert(
    fc.asyncProperty(fc.array(inviteAct, {maxLength: 30}), async acts => {
      const api = createFakeApi({childFamily: true});
      await api.createFamily();
      const m: {usedBy: string | null; me: string; linked: boolean} = {usedBy: null, me: 'A', linked: false};
      api.__dev.switchParentAccount('A');
      for (const a of acts) {
        if (a.k === 'issue') {
          await api.issueInviteCode();
          m.usedBy = null;
          continue;
        }
        if (a.k === 'switch') {
          api.__dev.switchParentAccount(a.who);
          m.me = a.who;
          continue;
        }
        if (a.k === 'peek') {
          // 서버 0028 peek 157~161행: 쓴 번호는 누가 확인하든 used(같은 계정 예외 없음)
          const p = await api.peekInviteCode('123456');
          if (p.ok === (m.usedBy !== null) || (!p.ok && p.reason !== 'used')) {
            return false;
          }
          continue;
        }
        const r = await api.redeemInviteCode(a.right ? '123456' : a.wrong);
        if (!a.right) {
          if (r.ok) {
            return false; // 틀린 번호로 연결됨
          }
          continue;
        }
        if (m.usedBy === null || m.usedBy === m.me) {
          if (!r.ok) {
            return false; // 안 쓴 번호·같은 사람의 재시도는 ok
          }
          m.usedBy = m.me;
          m.linked = true;
        } else if (r.ok || r.reason !== 'used') {
          return false; // 다른 사람이 쓴 번호를 씀
        }
        const child = await api.getChildState();
        if (m.linked && child.kind === 'family' && child.code !== null) {
          return false; // 연결됐는데 자녀 화면에 보내던 번호가 남음
        }
      }
      return true;
    }),
    {numRuns: 300},
  );
});

test('답 공유 동의 버전 형식: v + 숫자 1~3자리만(서버 0035 29행), 아니면 invalid_version', async () => {
  await fc.assert(
    fc.asyncProperty(fc.oneof(fc.stringMatching(/^v[0-9]{1,3}$/), fc.string({maxLength: 6})), async version => {
      const api = createFakeApi({linked: true});
      let threw = false;
      try {
        await api.giveConsent(version);
      } catch (e) {
        threw = /invalid_version/.test(String((e as {reason?: string}).reason ?? e));
      }
      return threw === !/^v[0-9]{1,3}$/.test(version);
    }),
    {numRuns: 300},
  );
});
