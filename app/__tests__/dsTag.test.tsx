// ds Tag(v5 accent): 먹 면 + 흰 글자 + 글자, 반경 6. 누를 수 없음(파랑·밑줄 없음), 노랑 없음, 그림자 없음, 말줄임 없음.
import React from 'react';
import {StyleSheet} from 'react-native';
import {render, screen} from '@testing-library/react-native';
import {AudienceProvider, Tag, TAG_LOOK} from '../src/ui/ds';
import {tokensV4 as t, type Audience} from '../src/ui/tokensV4';

const flat = (s: unknown) => (StyleSheet.flatten(s as never) ?? {}) as Record<string, unknown>;

function lum(h: string) {
  const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(x => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const contrast = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

test('모양: accent(먹) 면·흰 글자·반경 row(6)·그림자 없음, 부모 폭을 넘지 않음', () => {
  render(<Tag label="지금 할 차례" testID="tag" />);
  const box = flat(screen.getByTestId('tag').props.style);
  expect(box).toMatchObject({backgroundColor: t.color.accent, borderRadius: t.radius.row, alignSelf: 'flex-start', maxWidth: '100%'});
  expect(box.boxShadow).toBeUndefined();
  expect(TAG_LOOK).toEqual({bg: t.color.accent, ink: t.color.onAction, radius: t.radius.row});
});

test('대비: 흰 글자 on accent 면이 어르신 7:1 이상', () => {
  expect(contrast(TAG_LOOK.ink, TAG_LOOK.bg)).toBeGreaterThanOrEqual(7); // 18.26
});

test.each(['elder', 'child'] as const)('%s: 글자 = label 역할 크기·굵게 700·흰색, 말줄임 없음, 파랑·노랑·밑줄 없음', (a: Audience) => {
  render(
    <AudienceProvider value={a}>
      <Tag label="지금 할 차례" testID="tag" />
    </AudienceProvider>,
  );
  const text = screen.getByText('지금 할 차례');
  const st = flat(text.props.style);
  const spec = (t.type.label as unknown as Record<Audience, {size: number}>)[a];
  expect(st).toMatchObject({fontSize: spec.size, fontWeight: '700', color: t.color.onAction, flexShrink: 1});
  expect(text.props.numberOfLines).toBeUndefined();
  expect(text.props.maxFontSizeMultiplier).toBe(t.type.label.maxFontScale);
  expect(st.textDecorationLine).toBeUndefined();
  expect([t.color.action, t.color.actionPressed, t.color.sign]).not.toContain(st.color);
  expect([t.color.action, t.color.sign]).not.toContain(flat(screen.getByTestId('tag').props.style).backgroundColor);
});

test('읽기: 따로 초점·역할을 받지 않는다(행이 제목과 함께 읽는다)', () => {
  render(<Tag label="지금 할 차례" testID="tag" />);
  const tag = screen.getByTestId('tag');
  expect(tag.props.accessible).toBeUndefined();
  expect(tag.props.accessibilityRole).toBeUndefined();
  expect(tag.props.onPress).toBeUndefined();
});
