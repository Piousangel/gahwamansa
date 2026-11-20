// R-08(v5): 누르는 파랑(action)과 정보 시멘트(info)는 명도 대비가 1.06이라 색만으로는 구분되지 않는다.
// → 파랑 글자는 밑줄·면(버튼 면/테두리)·아이콘 중 하나와 함께, info 글자(그리고 파랑이 아닌 글자)에는 밑줄이 없다.
import React from 'react';
import {StyleSheet} from 'react-native';
import {render, screen, waitFor} from '@testing-library/react-native';
import {AudienceProvider, BackLink, Banner, Button, Text} from '../src/ui/ds';
import {tokensV4 as t} from '../src/ui/tokensV4';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi} from '../src/features/fakeApi';
import {press} from '../testUtils/flow';

type Node = {type: unknown; props: Record<string, unknown>; parent: Node | null; children: unknown[]};
const ACTION = t.color.action.toUpperCase();
const st = (n: Node) => (StyleSheet.flatten(n.props.style as never) ?? {}) as Record<string, unknown>;
const up = (v: unknown) => (typeof v === 'string' ? v.toUpperCase() : v);
const hosts = (root: Node) => {
  const out: Node[] = [];
  const stack = [root];
  while (stack.length) {
    const n = stack.pop()!;
    out.push(n);
    for (const c of n.children ?? []) {
      if (c && typeof c === 'object') {
        stack.push(c as Node);
      }
    }
  }
  return out;
};
const isText = (n: Node) => typeof n.type === 'string' && n.type === 'Text';
const textOf = (n: Node) => [].concat(n.props.children as never).join('');
/** 파랑 글자의 '함께 쓰는 단서': 밑줄 / 조상 중 누름 요소의 면·테두리(파랑) / 같은 누름 요소 안의 아이콘(svg) */
function hasCue(n: Node): boolean {
  if (String(st(n).textDecorationLine ?? '').includes('underline')) {
    return true;
  }
  for (let p = n.parent; p; p = p.parent) {
    const s = st(p);
    if (up(s.backgroundColor) === ACTION || (up(s.borderColor) === ACTION && Number(s.borderWidth ?? 0) > 0)) {
      return true;
    }
    if (p.props.accessibilityRole === 'button' || p.props.accessibilityRole === 'link') {
      // 같은 누름 요소 안에 아이콘(Svg)이 있으면 단서
      return hosts(p).some(x => typeof x.type === 'string' && /^RNSVG/.test(x.type as string));
    }
  }
  return false;
}
function violations(root: Node) {
  const bad: string[] = [];
  for (const n of hosts(root).filter(isText)) {
    const s = st(n);
    const blue = up(s.color) === ACTION;
    const underline = String(s.textDecorationLine ?? '').includes('underline');
    if (blue && !hasCue(n)) {
      bad.push(`파랑 글자에 단서 없음: '${textOf(n)}'`);
    }
    if (underline && !blue) {
      bad.push(`파랑이 아닌 글자에 밑줄: '${textOf(n)}' (${String(s.color)})`);
    }
  }
  return bad;
}

test('ds 부품: 버튼(주·보조·글자)·뒤로·안내 띠·info 글자 — 파랑엔 단서, info 엔 밑줄 없음', () => {
  for (const a of ['elder', 'child'] as const) {
    render(
      <AudienceProvider value={a}>
        <Button label="다 썼어요" onPress={() => {}} />
        <Button kind="secondary" label="다시" onPress={() => {}} />
        <Button kind="text" label="나중에" onPress={() => {}} />
        <BackLink to="오늘 코스로" onPress={() => {}} />
        <Banner tone="info" text="번호를 받으면 답이 저장돼요" />
        <Text role="sub" tone="muted">보조 글</Text>
      </AudienceProvider>,
    );
    expect([a, violations(screen.root as unknown as Node)]).toEqual([a, []]);
    screen.unmount();
  }
});

test('대표 화면(코스 홈·설정): 파랑 글자 단서·info 밑줄 없음', async () => {
  render(<AppRoot api={createFakeApi({linked: true, consented: true})} role="parent" restore />);
  await waitFor(() => screen.getByTestId('date-line'));
  const home = violations(screen.root as unknown as Node);
  await press('설정');
  await waitFor(() => screen.getByText('설정'));
  const settings = violations(screen.root as unknown as Node);
  expect({home, settings}).toEqual({home: [], settings: []});
});
