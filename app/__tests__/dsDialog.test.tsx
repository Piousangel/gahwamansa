// D-04: v4 대화상자 + 덮개 큐(하루 하나, A8). 닫는 말은 세 갈래(A5·W-09)
import React from 'react';
import {act, fireEvent, render, renderHook, screen} from '@testing-library/react-native';
import {AudienceProvider, Dialog} from '../src/ui/ds';
import {createCoverQueue, useCover, type CoverStore} from '../src/ui/ds/coverQueue';
import {tokensV4 as t} from '../src/ui/tokensV4';

const noop = () => {};
const H = {includeHiddenElements: true};
const labels = () => screen.getAllByRole('button', H).map(b => b.props.accessibilityLabel);

describe('ds Dialog', () => {
  test('되돌릴 수 있는 행동: 하는 쪽이 위(주), 닫는 쪽은 아래 "닫기"', () => {
    const onDo = jest.fn();
    const onDismiss = jest.fn();
    render(<Dialog visible title="알림을 받을까요?" body="응원이 오면 알려 드려요" action={{label: '알려 주세요', onPress: onDo}} dismiss="close" onDismiss={onDismiss} returnFocusRef={null} />);
    expect(screen.getByRole('header', {name: '알림을 받을까요?', ...H})).toBeTruthy();
    expect(labels()).toEqual(['알려 주세요', '닫기']);
    fireEvent.press(screen.getByTestId('ds-dialog-action'));
    fireEvent.press(screen.getByTestId('ds-dialog-dismiss')); // 한 번 누르면 다시 그려질 때까지 무시
    expect(onDo).toHaveBeenCalledTimes(1);
    expect(onDismiss).not.toHaveBeenCalled();
  });

  test('되돌릴 수 없는 행동(danger): 닫는 쪽이 위(안전한 쪽이 주), 거절 말은 "안 ○○할게요"', () => {
    render(<Dialog visible title="모두 지울까요?" action={{label: '모두 지우기', onPress: noop, kind: 'danger'}} dismiss={{decline: '안 지울래요'}} onDismiss={noop} returnFocusRef={null} />);
    expect(labels()).toEqual(['안 지울래요', '모두 지우기']);
  });

  test("dismiss 'later' = '다음에', 하는 쪽이 없으면 닫는 쪽 하나(주)", () => {
    render(<Dialog visible title="안내" dismiss="later" onDismiss={noop} returnFocusRef={null} />);
    expect(labels()).toEqual(['다음에']);
  });

  test('안드로이드 뒤로 = 닫는 쪽, 하는 중(로딩)에는 무시', () => {
    const onDismiss = jest.fn();
    const {rerender} = render(<Dialog visible title="t" action={{label: '보내기', onPress: noop, loading: true, loadingLabel: '보내는 중'}} dismiss="close" onDismiss={onDismiss} returnFocusRef={null} />);
    const modal = () => screen.UNSAFE_getByType(require('react-native').Modal);
    act(() => modal().props.onRequestClose());
    expect(onDismiss).not.toHaveBeenCalled();
    rerender(<Dialog visible title="t" action={{label: '보내기', onPress: noop}} dismiss="close" onDismiss={onDismiss} returnFocusRef={null} />);
    act(() => modal().props.onRequestClose());
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  test('오류 한 줄은 대화상자 안(모달 위 토스트는 안 보인다), 자녀 audience 를 그대로 넘긴다', () => {
    render(
      <AudienceProvider value="child">
        <Dialog visible title="t" error="연결이 끊겼어요" dismiss="close" onDismiss={noop} returnFocusRef={null} />
      </AudienceProvider>,
    );
    expect(screen.getByTestId('ds-dialog-error', H)).toBeTruthy();
    const {StyleSheet} = require('react-native');
    const st = screen.getByTestId('ds-dialog-dismiss').props.style;
    expect(StyleSheet.flatten(typeof st === 'function' ? st({pressed: false}) : st).minHeight).toBe(t.touch.child.primary);
  });
});

describe('덮개 큐(하루 하나, A8)', () => {
  const memory = (init: string | null = null) => {
    let v = init;
    const s: CoverStore & {value: () => string | null} = {load: async () => v, save: async d => void (v = d), value: () => v};
    return s;
  };
  const at = (iso: string) => () => new Date(iso);

  test('같은 날 둘째 덮개는 거절, 다음 날(KST)은 허락', async () => {
    const store = memory();
    const q = createCoverQueue({store, now: at('2026-11-20T01:00:00Z')});
    expect(await q.request('push')).toBe(true);
    q.release('push');
    expect(await q.request('newLink')).toBe(false);
    expect(store.value()).toBe('2026-11-20');
    const tomorrow = createCoverQueue({store, now: at('2026-11-20T16:00:00Z')}); // KST 11-21 01시
    expect(await tomorrow.request('newLink')).toBe(true);
  });

  test('떠 있는 덮개가 있으면 다른 덮개는 겹치지 않는다(같은 덮개는 다시 그려도 허락)', async () => {
    const q = createCoverQueue({store: memory(), now: at('2026-11-20T01:00:00Z')});
    expect(await q.request('a')).toBe(true);
    expect(await q.request('a')).toBe(true);
    expect(await q.request('b')).toBe(false);
  });

  test('저장된 날이 오늘이면(앱을 다시 켜도) 거절, 저장소 오류는 덮개를 막지 않는다', async () => {
    const q = createCoverQueue({store: memory('2026-11-20'), now: at('2026-11-20T05:00:00Z')});
    expect(await q.request('a')).toBe(false);
    const broken = createCoverQueue({store: {load: () => Promise.reject(new Error('x')), save: () => Promise.reject(new Error('x'))}, now: at('2026-11-20T05:00:00Z')});
    expect(await broken.request('a')).toBe(true);
  });

  test('useCover: 원할 때 청하고, 허락되면 visible, close 로 닫으면 오늘은 다시 안 뜬다', async () => {
    const q = createCoverQueue({store: memory(), now: at('2026-11-20T01:00:00Z')});
    const first = renderHook(({want}: {want: boolean}) => useCover('push', want, q), {initialProps: {want: false}});
    expect(first.result.current.visible).toBe(false);
    await act(async () => first.rerender({want: true}));
    expect(first.result.current.visible).toBe(true);
    act(() => first.result.current.close());
    expect(first.result.current.visible).toBe(false);
    const second = renderHook(() => useCover('newLink', true, q));
    await act(async () => {});
    expect(second.result.current.visible).toBe(false);
  });
});

describe('덮개 큐 경합·고장(PR #148 리뷰 M1·L2·L3)', () => {
  const slow = (value: string | null) => {
    let saved: string | null = value;
    const s: CoverStore = {
      load: () => new Promise(r => setTimeout(() => r(saved), 10)),
      save: async d => void (saved = d),
    };
    return s;
  };
  const at = () => new Date('2026-11-20T01:00:00Z');

  test('M1: 첫 읽기 전에 두 덮개가 동시에 청해도 하나만 허락(두 읽기가 같은 순간에 끝나는 경우)', async () => {
    let open: () => void = () => {};
    const gate = new Promise<void>(r => (open = r));
    const store: CoverStore = {load: () => gate.then(() => null), save: async () => {}};
    const q = createCoverQueue({store, now: at});
    const both = Promise.all([q.request('a'), q.request('b')]);
    open();
    expect(await both).toEqual([true, false]);
  });

  test('M1: 같은 덮개를 동시에 두 번 청하면 둘 다 허락(같은 덮개라 겹치지 않음)', async () => {
    const q = createCoverQueue({store: slow(null), now: at});
    expect(await Promise.all([q.request('a'), q.request('a')])).toEqual([true, true]);
  });

  test('L2: 저장소가 계속 고장이면 실행마다 하나(fail-open), 같은 실행 안에서는 하나', async () => {
    const broken: CoverStore = {load: () => Promise.reject(new Error('x')), save: () => Promise.reject(new Error('x'))};
    const run1 = createCoverQueue({store: broken, now: at});
    expect(await run1.request('a')).toBe(true);
    run1.release('a');
    expect(await run1.request('b')).toBe(false);
    const run2 = createCoverQueue({store: broken, now: at}); // 앱을 다시 켬
    expect(await run2.request('b')).toBe(true);
  });

  test('L3: effect 가 다시 돌아도(StrictMode 이중 effect) 같은 덮개는 다시 청해 보인다', async () => {
    const q = createCoverQueue({store: slow(null), now: at});
    const Strict = ({children}: {children: React.ReactNode}) => <React.StrictMode>{children}</React.StrictMode>;
    const h = renderHook(() => useCover('push', true, q), {wrapper: Strict});
    await act(async () => {
      await new Promise<void>(r => setTimeout(() => r(), 40));
    });
    expect(h.result.current.visible).toBe(true);
  });
});

test('리뷰 #150 L2: 허락이 오기 전에 언마운트되면 active 를 놓는다(다음 날 다른 덮개가 막히지 않음)', async () => {
  let open: () => void = () => {};
  const gate = new Promise<void>(r => (open = r));
  let now = new Date('2026-11-20T01:00:00Z');
  const q = createCoverQueue({store: {load: () => gate.then(() => null), save: async () => {}}, now: () => now});
  const h = renderHook(() => useCover('push', true, q));
  h.unmount(); // 읽기가 끝나기 전에 화면이 내려감
  await act(async () => {
    open();
    await gate;
    await new Promise<void>(r => setTimeout(() => r(), 0));
  });
  now = new Date('2026-11-21T01:00:00Z'); // 앱을 끄지 않은 채 다음 날
  expect(await q.request('other')).toBe(true); // 수정 전: 내려간 화면의 'push' 가 active 로 남아 false
});
