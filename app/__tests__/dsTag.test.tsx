// ds Tag(v5 accent): 먹 면 + 흰 글자 + 글자, 반경 6. 누를 수 없음(파랑·밑줄 없음), 노랑 없음, 그림자 없음, 말줄임 없음.
import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {render, screen} from '@testing-library/react-native';
import {AudienceProvider, Button, Heading, Tag, TAG_LOOK, Text as DsText} from '../src/ui/ds';
import {accentUse, boldRoleCount, R04_EXEMPT} from '../testUtils/designRules';
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

// #204 리뷰: R-04 굵기 집계는 Tag 하나만 이름으로 뺀다(M), R-07 accent 집계는 Tag 를 센다(L2)
describe('R-04·R-07 집계와 Tag', () => {
  test('R-04: 어르신 화면 제목·버튼(700 두 역할) + Tag → Tag 는 세지 않아 2. 예외를 끄면 3(일부러 깨뜨린 확인)', () => {
    render(
      <View>
        <Heading level={1}>오늘 코스</Heading>
        <Tag label="지금 할 차례" />
        <DsText role="body">본문</DsText>
        <Button label="사진 보기" onPress={() => {}} />
      </View>,
    );
    expect(boldRoleCount(screen.root)).toBe(2);
    expect(boldRoleCount(screen.root, {exemptTag: false})).toBe(3);
    expect(R04_EXEMPT).toEqual(['Tag']); // 예외는 Tag 하나로 한정
  });

  test('R-04: Tag 밖의 700 글자는 Tag 와 크기가 같아도 센다(예외는 Tag 안 글자만)', () => {
    render(
      <View>
        <Tag label="지금 할 차례" />
        <Text style={{fontSize: t.type.label.elder.size, fontWeight: '700'}}>굵은 라벨</Text>
      </View>,
    );
    expect(boldRoleCount(screen.root)).toBe(1);
  });

  test('R-07: Tag 는 accent 1곳으로 센다 — Tag 둘이면 2(화면당 1곳 위반을 잡는다), dangerInk 글자도 본다', () => {
    render(
      <View>
        <Tag label="지금 할 차례" />
        <Tag label="새로" />
        <DsText role="body" tone="danger">
          못 보냈어요
        </DsText>
      </View>,
    );
    expect(accentUse(screen.root)).toEqual({accent: 2, danger: true});
  });

  test('R-07: Tag 하나만이면 accent 1, danger 없음', () => {
    render(<Tag label="지금 할 차례" />);
    expect(accentUse(screen.root)).toEqual({accent: 1, danger: false});
  });
});
