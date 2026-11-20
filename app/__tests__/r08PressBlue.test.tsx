// R-08(v5): 누르는 파랑(action)과 정보 시멘트(info)는 명도 대비가 1.06이라 색만으로는 구분되지 않는다.
// → 파랑 글자는 밑줄·면(버튼 면/테두리)·아이콘 중 하나와 함께, info 글자(그리고 파랑이 아닌 글자)에는 밑줄이 없다.
import React from 'react';
import {StyleSheet} from 'react-native';
import {render, screen, waitFor} from '@testing-library/react-native';
import {AudienceProvider, BackLink, Banner, Button, Text} from '../src/ui/ds';
import {tokensV4 as t} from '../src/ui/tokensV4';
import {AppRoot} from '../src/app/AppRoot';
import {createFakeApi} from '../src/features/fakeApi';
import {press, pressCourseNext} from '../testUtils/flow';

type Node = {type: unknown; props: Record<string, unknown>; parent: Node | null; children: unknown[]};
// 누르는 파랑: action·actionPressed(눌림)(#179 리뷰 M3)
const BLUES = [t.color.action, t.color.actionPressed].map(c => c.toUpperCase());
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
const isBlue = (v: unknown) => BLUES.includes(up(v) as string);
/** 파랑 글자의 '함께 쓰는 단서'(#179 리뷰 M3 — 가장 가까운 누름 요소 자신만 본다):
 *  밑줄 / 가장 가까운 누름 요소(button·link)의 면·테두리(파랑) / 그 누름 요소의 아이콘(누름 요소 아래 첫 단계 묶음 안의 svg, 글자 묶음 밖) */
function hasCue(n: Node): boolean {
  if (String(st(n).textDecorationLine ?? '').includes('underline')) {
    return true;
  }
  let press: Node | null = n.parent;
  while (press && press.props.accessibilityRole !== 'button' && press.props.accessibilityRole !== 'link') {
    press = press.parent;
  }
  if (!press) {
    return false; // 누를 수 없는 파랑 글자
  }
  const s = st(press);
  if (isBlue(s.backgroundColor) || (isBlue(s.borderColor) && Number(s.borderWidth ?? 0) > 0)) {
    return true;
  }
  // 아이콘: 이 누름 요소 자신의 svg(다른 누름 요소 안으로는 내려가지 않는다)
  const own: Node[] = [];
  const stack = [...((press.children ?? []) as unknown[])];
  while (stack.length) {
    const x = stack.pop();
    if (!x || typeof x !== 'object') {
      continue;
    }
    const nx = x as Node;
    if (nx.props.accessibilityRole === 'button' || nx.props.accessibilityRole === 'link') {
      continue;
    }
    own.push(nx);
    stack.push(...((nx.children ?? []) as unknown[]));
  }
  return own.some(x => typeof x.type === 'string' && /^RNSVG/.test(x.type as string));
}
function violations(root: Node) {
  const bad: string[] = [];
  for (const n of hosts(root).filter(isText)) {
    const s = st(n);
    const blue = isBlue(s.color);
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

test('대표 화면(첫 화면·코스 홈·P4·P1·설정·자녀 홈): 파랑 글자 단서·파랑 아닌 글자 밑줄 없음', async () => {
  const seen: Record<string, string[]> = {};
  const look = (k: string) => (seen[k] = violations(screen.root as unknown as Node));
  render(<AppRoot api={createFakeApi()} />);
  await waitFor(() => screen.getByText('이 휴대폰은 누구 거예요?'));
  look('첫 화면');
  await press(/부모님 휴대폰이에요/);
  await waitFor(() => screen.getByLabelText('숫자 1'));
  look('P1');
  screen.unmount();
  render(<AppRoot api={createFakeApi({linked: true, consented: true})} role="parent" restore />);
  await waitFor(() => screen.getByTestId('date-line'));
  look('코스 홈');
  await pressCourseNext();
  await waitFor(() => screen.getByRole('button', {name: '다 봤어요'}));
  look('P4');
  screen.unmount();
  render(<AppRoot api={createFakeApi({linked: true, consented: true})} role="parent" restore />);
  await waitFor(() => screen.getByTestId('date-line'));
  await press('설정');
  await waitFor(() => screen.getByText('설정'));
  look('설정');
  screen.unmount();
  render(<AppRoot api={createFakeApi({consented: true, parentTitle: '엄마'})} role="child" />);
  await waitFor(() => screen.getByRole('button', {name: '응원 보내기'}));
  look('자녀 홈');
  expect(seen).toEqual({'첫 화면': [], P1: [], '코스 홈': [], P4: [], 설정: [], '자녀 홈': []});
});

test('일부러 넣은 위반을 잡는다(#179 리뷰 M3): 단서 없는 파랑 글자·바깥 컨테이너 면으로 우회·파랑 아닌 밑줄·눌림 파랑', () => {
  const {View, Pressable, Text: RNText} = require('react-native');
  render(
    <View style={{backgroundColor: t.color.action}}>
      <Pressable accessibilityRole="button" onPress={() => {}}>
        <RNText style={{color: t.color.action}}>바깥 면으로 우회</RNText>
      </Pressable>
      <RNText style={{color: t.color.actionPressed}}>눌림 파랑 단독</RNText>
      <RNText style={{color: t.color.info, textDecorationLine: 'underline'}}>info 밑줄</RNText>
    </View>,
  );
  const v = violations(screen.root as unknown as Node);
  expect(v).toHaveLength(3);
  expect(v).toEqual(expect.arrayContaining([expect.stringContaining('바깥 면으로 우회'), expect.stringContaining('눌림 파랑 단독'), expect.stringContaining('info 밑줄')]));
});
