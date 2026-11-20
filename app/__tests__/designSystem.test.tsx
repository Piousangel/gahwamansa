// 디자인 시스템 v3 최소 적용(E-최소) 회귀 테스트: 토큰 값, 접근성 최소 크기(어르신 글자 20·터치 64), 한국어 줄바꿈, 표준 화면 틀
import React from 'react';
import {Dimensions, KeyboardAvoidingView, Platform, StyleSheet, Text} from 'react-native';
import {render, screen} from '@testing-library/react-native';
import v3 from '../../design-system/tokens-v3.json';
import {color, fontSize, labelLineHeight, layout, lineHeight, lineHeightFor, radius, size, space, tokensV4, touch, typeScale, FONT_SCALE_MAX, FONT_SCALE_MAX_BODY, MIN_BODY_FONT, MIN_TOUCH} from '../src/ui/tokens';
import {keepAll, keepAllChildren, WORD_JOINER} from '../src/ui/koreanText';
import {BigButton} from '../src/ui/BigButton';
import {SelectCard} from '../src/ui/SelectCard';
import {StepRow} from '../src/ui/StepRow';
import {CodeInput} from '../src/ui/CodeInput';
import {Text20} from '../src/ui/Text20';
import {Screen} from '../src/ui/Screen';

const omit = (o: Record<string, unknown>, k: string) => Object.fromEntries(Object.entries(o).filter(([key]) => key !== k));
const flat = (s: unknown) => StyleSheet.flatten(s as never) ?? {};

describe('tokens = tokens-v3.json', () => {
  test('색은 v3 역할 값과 같다', () => {
    // v5(11-20, B2 v2): v3 이름은 모두 남고 값은 생성물(v5)을 따른다. tokens-v3.json 은 이름 목록으로만 쓴다
    for (const name of Object.keys(v3.color)) {
      expect([name, typeof (color as Record<string, string>)[name]]).toEqual([name, 'string']);
    }
  });
  test('v3 색은 tokensV4 에서 파생된다(원본 하나): 같은 이름은 같은 값, ink 는 v3ColorAlias(action)', () => {
    const c4 = tokensV4.color as Record<string, string>;
    const dep = tokensV4.deprecatedColor as Record<string, string>;
    for (const name of Object.keys(v3.color)) {
      const v4Name = name === 'ink' ? tokensV4.v3ColorAlias.ink : name;
      // v5 에서 지운 장식 색(O-8)은 deprecatedColor — 화면 레인이 걷어 낼 때까지
      expect([name, (color as Record<string, string>)[name]]).toEqual([name, c4[v4Name] ?? dep[name]]);
    }
    expect(color.inkBody).toBe(tokensV4.color.inkBody);
  });
  test('옛 이름은 v3 역할의 별칭으로 남는다(호출부 호환)', () => {
    expect(color.actionDark).toBe(color.actionPressed);
    expect(color.disabled).toBe(color.disabledBg);
    expect(color.handwrite).toBe(color.ink);
  });
  test('글자 스케일·간격·반경·터치·레이아웃', () => {
    expect(typeScale.elder).toEqual(v3.typeScale.elder);
    expect(typeScale.child).toEqual(v3.typeScale.child);
    expect(lineHeight).toEqual(omit(v3.lineHeight, 'rule'));
    // 줄 높이 표: 원본(tokens-v3.json lineHeightTable)과 앱 사본이 같다(ARCHITECTURE §6)
    const table = v3.lineHeightTable as Record<string, number | string>;
    for (const [k, v] of Object.entries(table)) {
      if (/^\d+$/.test(k)) {
        expect(lineHeightFor(Number(k))).toBe(v);
      }
    }
    expect(labelLineHeight(20)).toBe(20 + (table.labelExtra as number));
    expect(lineHeightFor(72)).toBe(94); // 큰 글자는 윗획이 잘리지 않게 여유(리뷰 M6)
    expect(space).toMatchObject(omit(v3.space, 'note'));
    expect(radius).toMatchObject(omit(v3.radius, 'note'));
    expect(touch).toEqual(omit(v3.touch, 'rule'));
    expect(layout.bodyPadding).toEqual(v3.layout.bodyPadding);
    expect(FONT_SCALE_MAX).toBe(v3.typeScale.fontScaling.maxFontSizeMultiplier);
    expect(FONT_SCALE_MAX_BODY).toBe(2); // 리드 결정: 본문은 200%까지 막지 않음
  });
  test('접근성 최소값: 어르신 글자 20, 터치 64', () => {
    expect(MIN_BODY_FONT).toBe(20);
    expect(MIN_TOUCH).toBe(64);
    expect(size.buttonPrimary).toBe(72);
    expect(fontSize.body).toBe(20);
  });
});

describe('한국어 줄바꿈(keep-all 동등)', () => {
  test('어절 안 글자 사이에 단어 결합자를 넣고 띄어쓰기는 그대로 둔다', () => {
    const J = WORD_JOINER;
    expect(keepAll('오늘 코스예요')).toBe(`오${J}늘 코${J}스${J}예${J}요`);
    expect(keepAll('봄')).toBe('봄');
    expect(keepAll('한 줄\n두 줄')).toBe(`한 줄\n두 줄`);
    expect(keepAll('')).toBe('');
  });
  test('Android에서만 문자열 children을 변환한다(iOS는 hangul-word)', () => {
    expect(keepAllChildren('다 봤어요', 'android')).toBe(keepAll('다 봤어요'));
    expect(keepAllChildren(['나', 1], 'android')).toEqual(['나', 1]);
    expect(keepAllChildren('다 봤어요', 'ios')).toBe('다 봤어요');
  });
  test('Text20 확대 상한: 본문 2.0, 큰 제목(28 이상) 1.5', () => {
    render(
      <>
        <Text20>안녕하세요</Text20>
        <Text20 size={32}>오늘의 코스</Text20>
      </>,
    );
    const t = screen.getByText('안녕하세요');
    expect(t.props.lineBreakStrategyIOS).toBe('hangul-word');
    expect(t.props.maxFontSizeMultiplier).toBe(2);
    expect(screen.getByText('오늘의 코스').props.maxFontSizeMultiplier).toBe(1.5);
  });
  test('NFC 정규화 후 인접한 한글 음절 사이에만 넣는다(이모지·국기·영문·숫자 보존)', () => {
    const J = WORD_JOINER;
    expect(keepAll('오늘'.normalize('NFD'))).toBe(`오${J}늘`);
    const emoji = '👨‍👩‍👧 ❤️ 1️⃣ 🇰🇷 👍🏽';
    expect(keepAll(emoji)).toBe(emoji);
    expect(keepAll('OK 2026년')).toBe(`OK 2026년`);
    expect(keepAll('가족👨‍👩‍👧')).toBe(`가${J}족👨‍👩‍👧`);
    expect(keepAll('ㅋㅋ')).toBe('ㅋㅋ');
  });
  test('멱등: 두 번 적용해도 같다', () => {
    const once = keepAll('오늘 코스예요');
    expect(keepAll(once)).toBe(once);
  });
  describe('Android', () => {
    const os = Platform.OS;
    beforeEach(() => {
      Platform.OS = 'android';
    });
    afterEach(() => {
      Platform.OS = os;
    });
    test('Text20은 결합자 섞인 글자 대신 원문을 화면 읽기 라벨로 준다', () => {
      render(<Text20 testID="t">다 봤어요</Text20>);
      const t = screen.getByTestId('t');
      expect(t.props.children).toBe(keepAll('다 봤어요'));
      expect(t.props.accessibilityLabel).toBe('다 봤어요');
    });
    test('키보드 회피를 Android에서도 켠다(edge-to-edge)', () => {
      render(
        <Screen>
          <Text20>본문</Text20>
        </Screen>,
      );
      expect(screen.UNSAFE_getByType(KeyboardAvoidingView).props.behavior).toBe('padding');
    });
  });
});

describe('공용 컴포넌트 명세 수치', () => {
  test.each(['primary', 'secondary', 'danger'] as const)('BigButton %s: 터치 64 이상, 글자 20 이상', variant => {
    render(<BigButton label="정했어요" variant={variant} onPress={() => {}} />);
    const btn = flat(screen.getByRole('button', {name: '정했어요'}).props.style);
    expect(btn.minHeight).toBeGreaterThanOrEqual(variant === 'primary' ? 72 : 64);
    expect(btn.height).toBeUndefined();
    const t = flat(screen.getByText('정했어요').props.style);
    expect(t.fontSize).toBeGreaterThanOrEqual(variant === 'primary' ? 32 : 26);
  });
  test('BigButton 비활성 이유를 글자로 알린다', () => {
    render(<BigButton label="정했어요" disabled disabledReason="하나를 골라 주세요" onPress={() => {}} />);
    // 화면엔 글자로 보이고, 화면 읽기는 버튼 힌트로 한 번만 읽는다(TalkBack R8)
    expect(screen.getByText('하나를 골라 주세요', {includeHiddenElements: true})).toBeTruthy();
    expect(screen.getByRole('button', {name: '정했어요'}).props.accessibilityHint).toBe('하나를 골라 주세요');
  });
  test('BigButton 로딩이면 "잠시만요"와 누르기 막음', () => {
    const fn = jest.fn();
    render(<BigButton label="정했어요" loading onPress={fn} />);
    expect(screen.getByRole('button', {name: '잠시만요'})).toBeDisabled();
  });
  test('SelectCard: 높이 132 이상, 글자 32, 저장 중이면 잠금', () => {
    render(<SelectCard label="봄" selected={false} state="saving" onPress={() => {}} />);
    const card = screen.getByRole('radio', {name: '봄'}); // 화면 읽기는 라디오(talkback-spec R9)
    expect(flat(card.props.style).minHeight).toBeGreaterThanOrEqual(132);
    expect(flat(screen.getByText('봄').props.style).fontSize).toBe(32);
    expect(card).toBeDisabled();
  });
  test('StepRow: 상태를 글자로도 알리고 글자 20 이상', () => {
    render(<StepRow title="둘 중 고르기" status="now" statusLabel="지금 할 차례" />);
    expect(screen.getByLabelText('둘 중 고르기, 지금 할 차례')).toBeTruthy();
    for (const t of screen.UNSAFE_getAllByType(Text)) {
      expect(flat(t.props.style).fontSize).toBeGreaterThanOrEqual(20);
    }
  });
  test('CodeInput: 번호 칸 68, 키 64 이상', () => {
    render(<CodeInput value="12" onDigit={() => {}} onDelete={() => {}} onClear={() => {}} />);
    expect(flat(screen.getByLabelText('숫자 3').props.style).minHeight).toBeGreaterThanOrEqual(64);
    for (const t of screen.UNSAFE_getAllByType(Text)) {
      expect(flat(t.props.style).fontSize).toBeGreaterThanOrEqual(20);
    }
  });
});

describe('표준 화면 틀', () => {
  test('하단 고정 영역은 스크롤 본문 밖(형제)에 있다', () => {
    render(
      <Screen top={<Text20>위</Text20>} bottom={<BigButton label="다음" onPress={() => {}} />}>
        <Text20>본문</Text20>
      </Screen>,
    );
    const scroll = screen.getByTestId('screen-body');
    expect(scroll).toContainElement(screen.getByText('본문'));
    expect(scroll).not.toContainElement(screen.getByText('다음'));
    expect(scroll).not.toContainElement(screen.getByText('위'));
  });
  test('하단 고정 영역은 화면 높이 40% 이하(넘치면 안에서 스크롤)', () => {
    render(
      <Screen bottom={<BigButton label="다음" onPress={() => {}} />}>
        <Text20>본문</Text20>
      </Screen>,
    );
    const dock = flat(screen.getByTestId('screen-dock').props.style);
    expect(dock.maxHeight).toBe(Math.floor(Dimensions.get('window').height * 0.4));
  });
  test('버튼 바깥 여백(위아래 6)이 있어 붙지 않는다', () => {
    render(<BigButton label="다음" onPress={() => {}} />);
    expect(flat(screen.getByTestId('big-button').props.style).marginVertical).toBe(6);
  });
  test('top·bottom 없이 쓰던 기존 호출도 그대로 스크롤된다', () => {
    render(
      <Screen>
        <Text20>본문</Text20>
      </Screen>,
    );
    expect(screen.getByTestId('screen-body')).toContainElement(screen.getByText('본문'));
  });
});
