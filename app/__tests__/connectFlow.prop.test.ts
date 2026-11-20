// 속성 기반 테스트(운영 규칙 11-20, 조사 #169): 연결·재연결 흐름(connectReducer) — 임의 순서의 이벤트에도 불변식이 지켜진다.
//
// 상태 전이 표(요약, 원본은 src/features/link/connectMachine.ts):
// | 상태 \ 이벤트 | edit(다른 번호) | peek(6자리) | peeked ok/invalid/기타 | redeem | redeemed ok/실패 | error | other | retry | prefill |
// | idle          | idle           | peeking     | -                      | -      | -                | -     | idle(빈) | -   | idle(새 번호) |
// | peeking       | idle           | -           | confirm/idle·inline/failed(peek) | - | -          | failed(peek) | idle(빈) | - | idle |
// | confirm       | -              | -           | -                      | redeeming | -             | -     | idle(빈) | -   | idle |
// | redeeming     | -              | -           | -                      | -      | ok/failed(redeem)| failed(redeem) | -(유지) | - | -(유지) |
// | ok            | -              | -           | -                      | -      | -                | -     | idle(빈)* | -   | -(유지) |
// | failed        | -              | (peek 단계면) peeking | -              | (redeem 단계면) redeeming | - | - | idle(빈) | 같은 단계/빈 | idle |
// (* 연결 뒤 '다른 번호'는 화면에 없다 — 표에만 남김)
import fc from 'fast-check';
import '../testUtils/fcSeed';
import {connectReducer, initialConnect, shouldAutoCheck, type ConnectEvent, type ConnectState} from '../src/features/link/connectMachine';
import type {FailReason} from '../src/copy/copy';

const REASONS: FailReason[] = ['invalid', 'used', 'expired', 'rate_limited', 'busy', 'already_linked', 'not_parent_device'];
const code = fc.oneof(fc.constantFrom('123456', '000000', '12345', ''), fc.stringMatching(/^[0-9]{0,6}$/));
const event: fc.Arbitrary<ConnectEvent> = fc.oneof(
  code.map(c => ({type: 'edit' as const, code: c})),
  fc.constant({type: 'peek' as const}),
  fc.oneof(
    fc.constant({type: 'peeked' as const, result: {ok: true as const, parentTitle: '엄마'}}),
    fc.constantFrom(...REASONS).map(reason => ({type: 'peeked' as const, result: {ok: false as const, reason}})),
  ),
  fc.constant({type: 'redeem' as const}),
  fc.oneof(
    fc.constant({type: 'redeemed' as const, result: {ok: true as const, family_id: 'f', profile_id: 'p'}}),
    fc.constantFrom(...REASONS).map(reason => ({type: 'redeemed' as const, result: {ok: false as const, reason}})),
  ),
  fc.boolean().map(offline => ({type: 'error' as const, offline})),
  fc.constant({type: 'other' as const}),
  fc.constant({type: 'retry' as const}),
  code.map(c => ({type: 'prefill' as const, code: c})),
) as fc.Arbitrary<ConnectEvent>;

// 임의 이벤트만으로는 연결 중(redeeming)까지 가기 드물다 → 정상 경로 조각을 섞어 깊은 상태에 자주 닿게 한다
const happy: ConnectEvent[] = [{type: 'edit', code: '123456'}, {type: 'peek'}, {type: 'peeked', result: {ok: true, parentTitle: '엄마'}} as ConnectEvent, {type: 'redeem'}];
const events = fc
  .array(fc.oneof({weight: 3, arbitrary: event.map(e => [e])}, {weight: 1, arbitrary: fc.integer({min: 1, max: happy.length}).map(n => happy.slice(0, n))}), {maxLength: 25})
  .map(chunks => chunks.flat());

const run = (events: ConnectEvent[]) => {
  const trail: [ConnectState, ConnectEvent, ConnectState][] = [];
  let s = initialConnect();
  for (const e of events) {
    const n = connectReducer(s, e as never);
    trail.push([s, e, n]);
    s = n;
  }
  return trail;
};

test('자동 연결 금지: 연결 중(redeeming)은 확인 화면(confirm)이나 연결 단계 실패에서 사람이 누른 redeem·다시 하기로만 시작한다', () => {
  fc.assert(
    fc.property(events, events => {
      for (const [from, e, to] of run(events)) {
        if (to.kind === 'redeeming' && from.kind !== 'redeeming') {
          const ok =
            (e.type === 'redeem' && (from.kind === 'confirm' || (from.kind === 'failed' && from.step === 'redeem'))) ||
            (e.type === 'retry' && from.kind === 'failed' && from.step === 'redeem');
          if (!ok) {
            return false;
          }
        }
      }
      return true;
    }),
    {numRuns: 500},
  );
});

test('연결됨(ok)은 연결 중(redeeming)에서 redeemed ok 로만 된다', () => {
  fc.assert(
    fc.property(events, events =>
      run(events).every(([from, e, to]) => to.kind !== 'ok' || from.kind === 'ok' || (from.kind === 'redeeming' && e.type === 'redeemed' && e.result.ok)),
    ),
    {numRuns: 500},
  );
});

test('연결 중에는 다른 번호·새 링크·고치기로 상태를 버리지 않는다(서버만 연결되는 구멍 방지, 리뷰 M1)', () => {
  fc.assert(
    fc.property(events, events =>
      run(events).every(([from, e, to]) => !(from.kind === 'redeeming' && (e.type === 'other' || e.type === 'prefill' || e.type === 'edit')) || to === from),
    ),
    {numRuns: 500},
  );
});

test('같은 번호로 고치기(6자리 뒤 숫자 키 연타)는 상태를 바꾸지 않는다(시도 한도 보호, 리뷰 H1)', () => {
  fc.assert(
    fc.property(events, events => {
      for (const [from, , to] of run(events).filter(([s, e]) => e.type === 'edit' && e.code === s.code)) {
        if (to !== from) {
          return false;
        }
      }
      return true;
    }),
    {numRuns: 500},
  );
});

test('자동 확인은 6자리·안내 줄 없음일 때만, 확인(peeking)은 그때나 확인 단계 실패의 다시 하기·peek 에서만', () => {
  fc.assert(
    fc.property(events, events =>
      run(events).every(([from, e, to]) => {
        if (to.kind !== 'peeking' || from.kind === 'peeking') {
          return true;
        }
        return (e.type === 'peek' && (shouldAutoCheck(from) || (from.kind === 'failed' && from.step === 'peek'))) || (e.type === 'retry' && from.kind === 'failed' && from.step === 'peek');
      }),
    ),
    {numRuns: 500},
  );
});

test('번호 문제(쓴 번호·기간 지남·잠김 등)의 다시 하기는 빈 번호 쓰기로(같은 번호를 다시 보내지 않음)', () => {
  fc.assert(
    fc.property(events, events =>
      run(events).every(([from, e, to]) => {
        if (e.type !== 'retry' || from.kind !== 'failed' || ['offline', 'server', 'busy'].includes(from.reason)) {
          return true;
        }
        return to.kind === 'idle' && to.code === '';
      }),
    ),
    {numRuns: 500},
  );
});
