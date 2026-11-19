// ui/ds v4 컴포넌트 단위 테스트(SUMMARY 3절 RNTL): 역할 → 크기·색·상한, minHeight(고정 높이 없음), 말줄임 없음, TalkBack 역할·라벨.
// 값은 tokensV4(생성물)에서 읽어 비교한다 — 원본 값이 바뀌어도 테스트는 고칠 일이 없다.
import React from 'react';
import {StyleSheet} from 'react-native';
import {fireEvent, render, screen} from '@testing-library/react-native';
import {AudienceProvider, BackLink, Banner, Button, Card, Choice, Field, Heading, Section, SocialButton, StateView, Text} from '../src/ui/ds';
import {BANNER_ACTION, BANNER_LOOK} from '../src/ui/ds/Banner';
import {CARD_SURFACE} from '../src/ui/ds/Card';
import {tokensV4 as t, type Audience} from '../src/ui/tokensV4';

const flat = (s: unknown) => (StyleSheet.flatten(s as never) ?? {}) as Record<string, unknown>;
const c = t.color as Record<string, string>;
const child = (ui: React.ReactElement) => <AudienceProvider value="child">{ui}</AudienceProvider>;
const noop = () => {};
type Spec = {size: number; lineHeight: number; tone: string};
const spec = (role: keyof typeof t.type, a: Audience) => (t.type[role] as unknown as Record<Audience, Spec>)[a];
/** 눌리는 요소의 스타일(Pressable 은 함수 style → 렌더된 View 의 style) */
const pressStyle = (id: string) => flat(screen.getByTestId(id).props.style);

describe('Text·Heading', () => {
  test.each(['elder', 'child'] as const)('%s: 역할이 크기·줄높이·굵기·색·상한을 정한다', a => {
    const wrap = (ui: React.ReactElement) => (a === 'child' ? child(ui) : ui);
    render(wrap(<>{(['display', 'title', 'heading', 'bodyLg', 'body', 'sub'] as const).map(r => <Text key={r} role={r} testID={r}>{r}</Text>)}</>));
    for (const r of ['display', 'title', 'heading', 'bodyLg', 'body', 'sub'] as const) {
      const el = screen.getByTestId(r);
      const st = flat(el.props.style);
      expect([r, st.fontSize, st.lineHeight, st.fontWeight, st.color]).toEqual([
        r, spec(r, a).size, spec(r, a).lineHeight, t.type[r].weight >= 700 ? '700' : '400', c[spec(r, a).tone],
      ]);
      expect(el.props.maxFontSizeMultiplier).toBe(t.type[r].maxFontScale);
      expect(el.props.numberOfLines).toBeUndefined();
    }
  });
  test('tone: muted 는 audience 의 보조색(어르신 inkSub / 자녀 inkSubChild), accent·danger 는 그 색', () => {
    render(
      <>
        <Text role="body" tone="muted" testID="e">a</Text>
        {child(<Text role="body" tone="muted" testID="c">b</Text>)}
        <Text role="body" tone="danger" testID="d">c</Text>
      </>,
    );
    expect(flat(screen.getByTestId('e').props.style).color).toBe(c.inkSub);
    expect(flat(screen.getByTestId('c').props.style).color).toBe(c.inkSubChild);
    expect(flat(screen.getByTestId('d').props.style).color).toBe(c.dangerInk);
  });
  test('말줄임은 예외 prop 으로만(이유 필수)', () => {
    render(<Text role="numeral" ellipsisException={{lines: 1, reason: 'numberCell'}} testID="n">1234</Text>);
    expect(screen.getByTestId('n').props.numberOfLines).toBe(1);
  });
  test('Heading: level 1 = title + 머리글, level 2 = heading + 머리글', () => {
    render(
      <>
        <Heading level={1} testID="h1">오늘 코스</Heading>
        <Heading level={2} testID="h2">사진</Heading>
      </>,
    );
    expect(screen.getByTestId('h1').props.accessibilityRole).toBe('header');
    expect(flat(screen.getByTestId('h1').props.style).fontSize).toBe(spec('title', 'elder').size);
    expect(flat(screen.getByTestId('h2').props.style).fontSize).toBe(spec('heading', 'elder').size);
  });
});

describe('Button', () => {
  test.each(['elder', 'child'] as const)('%s: 주·보조·글자 링크의 최소 높이와 글자 역할, 고정 높이 없음', a => {
    const wrap = (ui: React.ReactElement) => (a === 'child' ? child(ui) : ui);
    render(
      wrap(
        <>
          <Button label="다 썼어요" onPress={noop} testID="p" />
          <Button kind="secondary" label="다시" onPress={noop} testID="s" />
          <Button kind="text" label="나중에" onPress={noop} testID="tx" />
        </>,
      ),
    );
    const min = a === 'elder' ? {p: t.touch.elder.primary, s: t.touch.elder.secondary, tx: t.touch.elder.link} : {p: t.touch.child.primary, s: t.touch.child.min, tx: t.touch.child.min};
    for (const id of ['p', 's', 'tx'] as const) {
      const st = pressStyle(id);
      expect([id, st.minHeight, st.height, st.maxHeight]).toEqual([id, min[id], undefined, undefined]);
    }
    const label = screen.getByText('다 썼어요');
    const b = t.type.button[a] as unknown as {primary: Spec};
    expect(flat(label.props.style)).toMatchObject({fontSize: b.primary.size, fontWeight: '700', color: c.onAction});
    expect(label.props.maxFontSizeMultiplier).toBe(t.type.button.maxFontScale);
    expect(flat(screen.getByText('나중에').props.style)).toMatchObject({textDecorationLine: 'underline', color: c.action});
  });
  test('비활성: 이유 한 줄 + 힌트 + 상태, 면에 line 테두리(3:1)', () => {
    render(<Button label="다 썼어요" onPress={noop} disabled disabledReason="한 글자 이상 써 주세요" testID="p" />);
    const btn = screen.getByTestId('p');
    expect(btn.props.accessibilityState).toMatchObject({disabled: true});
    expect(btn.props.accessibilityHint).toBe('한 글자 이상 써 주세요');
    expect(pressStyle('p')).toMatchObject({borderColor: c.line, backgroundColor: c.disabledBg});
    expect(screen.getByText('한 글자 이상 써 주세요', {includeHiddenElements: true})).toBeTruthy();
  });
  test('loading: busy·눌림 막음·문구 바꿈', () => {
    const onPress = jest.fn();
    render(<Button label="보내기" loading loadingLabel="잠시만요" onPress={onPress} testID="p" />);
    expect(screen.getByTestId('p').props.accessibilityState).toMatchObject({busy: true, disabled: true});
    fireEvent.press(screen.getByTestId('p'));
    expect(onPress).not.toHaveBeenCalled();
    expect(screen.getByText('잠시만요')).toBeTruthy();
  });
});

describe('SocialButton(브랜드 예외)', () => {
  test('minHeight 만, 글자 500·자녀 button 크기·상한, 말줄임 없음, 라벨 = 보이는 글', () => {
    render(<SocialButton provider="kakao" label="카카오 로그인" onPress={noop} />);
    const btn = screen.getByTestId('social-kakao');
    expect(btn.props.accessibilityLabel).toBe('카카오 로그인');
    expect(pressStyle('social-kakao').height).toBeUndefined();
    expect(pressStyle('social-kakao').minHeight).toBeGreaterThanOrEqual(t.touch.child.primary);
    const label = screen.getByText('카카오 로그인');
    const b = t.type.button.child as unknown as {primary: Spec};
    expect(flat(label.props.style)).toMatchObject({fontWeight: '500', fontSize: b.primary.size});
    expect(label.props.maxFontSizeMultiplier).toBe(t.type.button.maxFontScale);
    expect(label.props.numberOfLines).toBeUndefined();
  });
});

describe('BackLink', () => {
  test('어르신: 링크 역할, 보이는 글 = 라벨, 64×120 이상, 흰 알약 + line 테두리, 화살표', () => {
    const onPress = jest.fn();
    render(<BackLink to="오늘 코스로" onPress={onPress} />);
    const el = screen.getByTestId('back-link');
    expect(el.props.accessibilityRole).toBe('link');
    expect(el.props.accessibilityLabel).toBe('오늘 코스로');
    expect(screen.getByText('오늘 코스로')).toBeTruthy();
    expect(pressStyle('back-link')).toMatchObject({minHeight: 64, minWidth: 120, backgroundColor: c.card, borderColor: c.line, borderWidth: t.backLink.borderWidth});
    expect(pressStyle('back-link').height).toBeUndefined();
    expect(screen.getByTestId('back-link-arrow', {includeHiddenElements: true})).toBeTruthy();
    const label = flat(screen.getByText('오늘 코스로').props.style);
    expect(label).toMatchObject({fontSize: spec('backLink', 'elder').size, color: c.action});
    fireEvent.press(el);
    expect(onPress).toHaveBeenCalled();
  });
  test('자녀 높이 56, 접힌 위 영역의 단계 정보는 힌트로', () => {
    render(child(<BackLink to="설정으로" onPress={noop} context="3단계 중 2단계" />));
    expect(pressStyle('back-link').minHeight).toBe(56);
    expect(screen.getByTestId('back-link').props.accessibilityHint).toBe('3단계 중 2단계');
  });
});

describe('Field(placeholder 없음)', () => {
  test('label·hint 가 칸 위에 보이고, 칸의 라벨·힌트로 읽힌다. 입력 글자 fieldInput(상한 1.5), label·hint 상한 2', () => {
    render(<Field label="이름" hint={'예: 김영희\n두 줄도 괜찮아요'} value="" onChangeText={noop} />);
    const input = screen.getByTestId('field');
    expect(input.props.placeholder).toBeUndefined();
    expect(input.props.accessibilityLabel).toBe('이름');
    expect(input.props.accessibilityHint).toContain('예: 김영희');
    expect(input.props.maxFontSizeMultiplier).toBe(t.type.fieldInput.maxFontScale);
    expect(flat(input.props.style)).toMatchObject({fontSize: spec('fieldInput', 'elder').size, minHeight: t.touch.elder.primary});
    expect(flat(input.props.style).height).toBeUndefined();
    expect(screen.getByText('이름').props.maxFontSizeMultiplier).toBe(2);
    expect(screen.getByTestId('field-hint').props.maxFontSizeMultiplier).toBe(2);
    expect(screen.getByTestId('field-hint').props.numberOfLines).toBeUndefined();
  });
  test('kind: email 자판·자동 대문자 끔, otp 숫자 자판, text 는 여러 줄', () => {
    render(
      <>
        <Field kind="email" label="이메일" value="" onChangeText={noop} testID="em" />
        <Field kind="otp" label="번호" value="" onChangeText={noop} testID="otp" />
        <Field kind="text" label="한마디" value="" onChangeText={noop} testID="tx" />
      </>,
    );
    expect(screen.getByTestId('em').props).toMatchObject({keyboardType: 'email-address', autoCapitalize: 'none'});
    expect(screen.getByTestId('otp').props.keyboardType).toBe('number-pad');
    expect(screen.getByTestId('tx').props.multiline).toBe(true);
  });
  test('오류: 문구 + 테두리(색만으로 알리지 않음), 힌트로도 읽힘', () => {
    render(<Field label="이메일" error="주소를 다시 봐 주세요" value="a" onChangeText={noop} />);
    expect(screen.getByTestId('field-error')).toBeTruthy();
    expect(screen.getByTestId('field').props.accessibilityHint).toContain('주소를 다시 봐 주세요');
  });
});

describe('Choice(응원 선택지)', () => {
  const items = [
    {key: 'a', label: '오늘도 잘 봤어요', icon: 'icon-photo' as const},
    {key: 'b', label: '두 줄이 되어도 괜찮은 아주 긴 응원 문장이에요', hint: '사진에 붙어요'},
  ];
  test('radio: 묶음·라디오 역할, 고른 것은 checked + 테두리 4 + 체크 아이콘, 1열·말줄임 없음', () => {
    const onSelect = jest.fn();
    render(<Choice mode="radio" items={items} value="a" onSelect={onSelect} accessibilityLabel="응원 고르기" />);
    expect(screen.getByTestId('choice').props.accessibilityRole).toBe('radiogroup');
    const a = screen.getByTestId('choice-a');
    expect(a.props.accessibilityRole).toBe('radio');
    expect(a.props.accessibilityState).toMatchObject({checked: true});
    expect(pressStyle('choice-a')).toMatchObject({borderWidth: 4, borderColor: c.action});
    expect(screen.getAllByTestId('icon-check', {includeHiddenElements: true})).toHaveLength(1);
    expect(screen.getByText(items[1].label).props.numberOfLines).toBeUndefined();
    fireEvent.press(screen.getByTestId('choice-b'));
    expect(onSelect).toHaveBeenCalledWith('b');
  });
  test('action: 버튼 역할, 자녀 최소 56, 테두리 line(3:1)', () => {
    render(child(<Choice mode="action" items={items} onSelect={noop} />));
    expect(screen.getByTestId('choice-a').props.accessibilityRole).toBe('button');
    expect(pressStyle('choice-a')).toMatchObject({minHeight: t.touch.child.choice, borderColor: c.line});
  });
});

describe('Card·Section·Banner·StateView', () => {
  const allowedText = (fg: string, bg: string) => t.textOnSurface.some(p => p.fg === fg && p.bg === bg && p.audience.length === 2);
  const allowedNonText = (fg: string, bg: string) => t.nonText.some(p => p.fg === fg && p.bg === bg);
  test('Card 면은 tone 이 정하고, 그 위 본문·제목 글자는 허용 목록 안', () => {
    render(<Card tone="notice"><Text role="body">안내</Text></Card>);
    expect(flat(screen.getByTestId('card-notice').props.style).backgroundColor).toBe(c[CARD_SURFACE.notice]);
    for (const bg of Object.values(CARD_SURFACE)) {
      expect([bg, allowedText('inkBody', bg), allowedText('inkTitle', bg)]).toEqual([bg, true, true]);
    }
  });
  test('Section: 제목은 Heading 2', () => {
    render(<Section title="지난 기록"><Text role="body">x</Text></Section>);
    expect(screen.getByText('지난 기록').props.accessibilityRole).toBe('header');
  });
  test('Banner 4종의 글자·아이콘·테두리 × 면 조합은 허용 목록 안(어르신·자녀 모두)', () => {
    for (const [tone, look] of Object.entries(BANNER_LOOK)) {
      expect([tone, allowedText(look.text, look.surface), allowedNonText(look.icon, look.surface), allowedNonText(look.border, look.surface)]).toEqual([tone, true, true, true]);
    }
  });
  test('Banner 행동(리뷰 M2): 흰 알약 위 action 글자 — 어르신 허용 목록 안, 옅은 띠 면 위 글자 링크가 아님', () => {
    const elderOk = (fg: string, bg: string) => t.textOnSurface.some(p => p.fg === fg && p.bg === bg && (p.audience as readonly string[]).includes('elder'));
    expect(elderOk(BANNER_ACTION.text, BANNER_ACTION.surface)).toBe(true);
    render(<Banner tone="offline" text="인터넷이 끊겼어요" action={{label: '다시 하기', onPress: noop}} />);
    expect(screen.getByTestId('icon-wifi-off', {includeHiddenElements: true})).toBeTruthy();
    const label = flat(screen.getByText('다시 하기').props.style);
    expect(label.color).toBe(c[BANNER_ACTION.text]);
    expect(label.textDecorationLine).toBeUndefined();
    const btn = screen.getByRole('button', {name: '다시 하기'});
    expect(flat(btn.props.style).backgroundColor).toBe(c[BANNER_ACTION.surface]);
  });
  test('StateView: 로딩은 busy·스피너 없음, 오류는 아이콘 + 할 일 1개', () => {
    const {rerender} = render(<StateView kind="loading" title="불러오고 있어요" />);
    expect(screen.getByTestId('state-view').props.accessibilityState).toMatchObject({busy: true});
    rerender(<StateView kind="error" title="잠시 문제가 있어요" body="다시 해 볼까요" action={{label: '다시 하기', onPress: noop}} />);
    expect(screen.getByTestId('icon-warning', {includeHiddenElements: true})).toBeTruthy();
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByText('잠시 문제가 있어요').props.accessibilityRole).toBe('header');
  });
});

describe('Choice columns(디자인 결정 a)', () => {
  const {fitsTwoColumns} = require('../src/ui/ds/Choice');
  const names = ['엄마', '아빠', '어머니', '아버지', '할머니', '할아버지', '부모님'].map(label => ({label}));
  test('360(목록 312)·100%면 호칭 7개가 2열, 150% 이상이면 1열', () => {
    expect(fitsTwoColumns(names, 312, 18, 1)).toBe(true);
    // 130%: 360(목록 312)에서는 '할아버지'가 칸에서 꺾여 1열 — 150% 는 꺾임 조건과 별개의 기준(디자인 확인 11-20, #115 L4). 412(목록 364)에서는 150% 직전까지 2열
    expect(fitsTwoColumns(names, 312, 18, 1.3)).toBe(false);
    expect(fitsTwoColumns(names, 364, 18, 1.3)).toBe(true);
    expect(fitsTwoColumns(names, 364, 18, 1.49)).toBe(true);
    expect(fitsTwoColumns(names, 364, 18, 1.5)).toBe(false);
    expect(fitsTwoColumns(names, 312, 18, 1.5)).toBe(false);
    expect(fitsTwoColumns(names, 312, 18, 2)).toBe(false);
  });
  test('한 칸에서 글이 줄바꿈되면 1열(긴 이름·긴 보조 줄)', () => {
    expect(fitsTwoColumns([{label: '아주아주 긴 이름입니다'}], 272, 18, 1)).toBe(false);
    expect(fitsTwoColumns([{label: '엄마', hint: '이미 쓰는 이름', disabled: true}], 312, 18, 1, 16)).toBe(true);
    expect(fitsTwoColumns([{label: '엄마', hint: '이미 쓰는 이름이라 고를 수 없어요', disabled: true}], 312, 18, 1, 16)).toBe(false);
  });
  test('2열이면 칸 폭을 나누고, 고른 칸은 ✓ + 굵은 테두리(색만으로 구분하지 않음), 막힌 칸은 disabled', () => {
    jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({width: 360, height: 640, scale: 2.75, fontScale: 1});
    render(
      <AudienceProvider value="child">
        <Choice mode="radio" columns={2} items={[{key: 'a', label: '엄마'}, {key: 'b', label: '아빠', disabled: true, a11yLabel: '아빠, 이미 쓰는 이름'}]} value="a" onSelect={() => {}} />
      </AudienceProvider>,
    );
    fireEvent(screen.getByTestId('choice'), 'layout', {nativeEvent: {layout: {x: 0, y: 0, width: 312, height: 400}}});
    expect(StyleSheet.flatten(screen.getByTestId('choice').props.style)).toMatchObject({flexDirection: 'row', flexWrap: 'wrap'});
    const [a, b] = screen.getAllByRole('radio');
    const st = StyleSheet.flatten(typeof a.props.style === 'function' ? a.props.style({pressed: false}) : a.props.style);
    expect(st.width).toBeCloseTo((312 - 12) / 2);
    expect(st.borderWidth).toBe(4);
    expect(b.props.accessibilityState).toMatchObject({disabled: true});
    expect(b.props.accessibilityLabel).toBe('아빠, 이미 쓰는 이름');
    jest.restoreAllMocks();
  });
});

describe('어르신 답 역할(디자인 #103 R-21, 자녀 전용)', () => {
  const {roleText} = require('../src/ui/ds/roles');
  test('answer = 대표 1개 40/52·400·상한 1.3, answerRow = 목록 행 26/36·400·상한 1.5 — 굵기 700 이 아니라 2역할 집계에서 빠진다', () => {
    const a = roleText('answer', 'child');
    expect(a.style).toMatchObject({fontSize: 40, lineHeight: 52, fontWeight: '400'});
    expect(a.maxFontSizeMultiplier).toBe(1.3);
    const r = roleText('answerRow', 'child');
    expect(r.style).toMatchObject({fontSize: 26, lineHeight: 36, fontWeight: '400'});
    expect(r.maxFontSizeMultiplier).toBe(1.5);
  });
  test('어르신 값이 없어도 깨지지 않고 자녀 값(어르신 화면에서는 쓰지 않음)', () => {
    expect(roleText('answer', 'elder').style.fontSize).toBe(40);
  });
});

describe('Choice columns 판정 순서(#115 리뷰 L1·L2)', () => {
  const two = () => StyleSheet.flatten(screen.getByTestId('choice').props.style).flexDirection === 'row';
  const items = [{key: 'a', label: '엄마'}, {key: 'b', label: '아빠'}];
  test('L1: 첫 그림은 1열, 폭을 잰 뒤에만 2열(한 방향)', () => {
    jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({width: 360, height: 640, scale: 2.75, fontScale: 1});
    render(
      <AudienceProvider value="child">
        <Choice mode="radio" columns={2} items={items} value="a" onSelect={() => {}} />
      </AudienceProvider>,
    );
    expect(two()).toBe(false);
    fireEvent(screen.getByTestId('choice'), 'layout', {nativeEvent: {layout: {x: 0, y: 0, width: 312, height: 400}}});
    expect(two()).toBe(true);
    jest.restoreAllMocks();
  });
  test('L2: 어림으로 2열을 골랐어도 실제 줄 수가 2 이상이면 1열로 내리고 다시 올리지 않는다', () => {
    jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({width: 360, height: 640, scale: 2.75, fontScale: 1});
    render(
      <AudienceProvider value="child">
        <Choice mode="radio" columns={2} items={items} value="a" onSelect={() => {}} />
      </AudienceProvider>,
    );
    fireEvent(screen.getByTestId('choice'), 'layout', {nativeEvent: {layout: {x: 0, y: 0, width: 312, height: 400}}});
    expect(two()).toBe(true);
    fireEvent(screen.getByText('아빠'), 'textLayout', {nativeEvent: {lines: [{}, {}]}});
    expect(two()).toBe(false);
    fireEvent(screen.getByTestId('choice'), 'layout', {nativeEvent: {layout: {x: 0, y: 0, width: 312, height: 400}}});
    expect(two()).toBe(false);
    jest.restoreAllMocks();
  });
});
