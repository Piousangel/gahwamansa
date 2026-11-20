// 속성 기반 테스트(운영 규칙 11-20): 답 공유 동의·초대 번호 — 임의 순서의 액션을 fake API(모든 화면 테스트가 쓰는 서버 대역)에 넣고
// 작은 모델(상태 전이 표)과 같은지, 서버 규칙(불변식)이 지켜지는지 본다. 서버 자체는 pgTAP(supabase/tests) 몫이고, 여기서는 fake 가 서버 규칙과
// 어긋나지 않게 지킨다(어긋나면 화면 테스트가 서버에서는 일어나지 않는 흐름을 통과시킨다).
//
// 동의 전이 표(서버 0006·0019 consent, save_answer 는 동의 없으면 consent_required):
// | 상태\액션        | give      | withdraw            | save(A/B)            |
// | 동의 안 함        | 동의함    | 그대로(답 없음)       | 실패(consent_required) |
// | 동의함·답 없음    | 그대로    | 동의 안 함            | 동의함·답 있음          |
// | 동의함·답 있음    | 그대로    | 동의 안 함·답 지움     | 답 바꿈                |
// 불변식: 자녀에게 보이는 최근 답(latest) ≠ null ⇔ 동의함 ∧ (마지막 철회 뒤 저장한 답이 있음)
//
// 초대 번호 전이 표(서버 0004 redeem·0018 새 번호면 이전 번호 무효):
// | 상태\액션            | 발급(issue)        | 맞는 번호 쓰기          | 틀린 번호 쓰기 |
// | 살아 있음·안 씀       | 새 번호(안 씀)      | 연결됨·씀              | 실패, 연결 그대로 |
// | 씀                   | 새 번호(안 씀)      | 실패 'used'(다시 못 씀) | 실패 |
// 불변식: 한 번호로 연결은 한 번뿐, 틀린 번호로는 연결되지 않는다, 연결되면 자녀에게 보내던 번호는 더 보이지 않는다
import fc from 'fast-check';
import {createFakeApi} from '../src/features/fakeApi';

type ConsentAct = {k: 'give'} | {k: 'withdraw'} | {k: 'save'; choice: 'A' | 'B'};
const consentAct: fc.Arbitrary<ConsentAct> = fc.oneof(
  fc.constant({k: 'give'} as const),
  fc.constant({k: 'withdraw'} as const),
  fc.constantFrom('A' as const, 'B' as const).map(choice => ({k: 'save' as const, choice})),
);

test('동의: 동의 없으면 답이 저장되지 않고 자녀에게 보이지 않는다, 철회하면 보이던 답도 사라진다', async () => {
  await fc.assert(
    fc.asyncProperty(fc.boolean(), fc.array(consentAct, {maxLength: 30}), async (start, acts) => {
      const api = createFakeApi({consented: start, linked: true});
      const m = {consented: start, saved: false};
      for (const a of acts) {
        if (a.k === 'give') {
          await api.giveConsent('v1');
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

type InviteAct = {k: 'issue'} | {k: 'redeem'; right: boolean; wrong: string};
const inviteAct: fc.Arbitrary<InviteAct> = fc.oneof(
  fc.constant({k: 'issue'} as const),
  fc.record({k: fc.constant('redeem' as const), right: fc.boolean(), wrong: fc.stringMatching(/^[0-9]{6}$/).filter(c => !['123456', '000000', '111111', '222222', '333333', '444444', '555555'].includes(c))}),
);

test('초대 번호: 쓴 번호는 다시 쓸 수 없고(used), 틀린 번호로는 연결되지 않으며, 연결되면 보내던 번호가 사라진다', async () => {
  await fc.assert(
    fc.asyncProperty(fc.array(inviteAct, {maxLength: 30}), async acts => {
      const api = createFakeApi({childFamily: true});
      await api.createFamily();
      const m = {used: false, linked: false};
      for (const a of acts) {
        if (a.k === 'issue') {
          await api.issueInviteCode();
          m.used = false;
          continue;
        }
        const r = await api.redeemInviteCode(a.right ? '123456' : a.wrong);
        if (!a.right) {
          if (r.ok) {
            return false; // 틀린 번호로 연결됨
          }
          continue;
        }
        if (m.used) {
          if (r.ok || r.reason !== 'used') {
            return false; // 쓴 번호를 다시 씀
          }
        } else {
          if (!r.ok) {
            return false;
          }
          m.used = true;
          m.linked = true;
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
