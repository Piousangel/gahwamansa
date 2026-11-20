import React from 'react';
import {Pressable, StyleSheet, Text as RNText, View} from 'react-native';
import {keepAllChildren, koreanTextProps} from '../koreanText';
import {Icon, type IconName} from '../assets/icons';
import {ds, minTouch, roleText, type Tone} from './roles';
import {pickLayout, useAudience, type LayoutOnlyStyle} from './audience';

export type ButtonKind = 'primary' | 'secondary' | 'text' | 'danger';
/** buttonRef 가 가리키는 것(화면이 RN Pressable 을 import 하지 않고 포커스 되돌림 ref 를 만들 때) */
export type ButtonHandle = React.ComponentRef<typeof Pressable>;
export type ButtonProps = {
  kind?: ButtonKind;
  /** dock: 가로를 채움(Dock·본문 끝 행동). inline: 글자만큼(카드·행 안) */
  size?: 'dock' | 'inline';
  label: string;
  /** 읽기 이름이 보이는 글과 달라야 할 때만(예: '·' 같은 기호를 읽지 않게, C0a 출구 #163). 없으면 label */
  accessibilityLabel?: string;
  /** 글자 정렬. 기본 가운데, start = 왼쪽(본문 글과 같은 줄에 놓이는 글자 링크) */
  align?: 'center' | 'start';
  onPress: () => void;
  icon?: IconName;
  disabled?: boolean;
  /** 누르기 막고 loadingLabel 로 바꾼다(busy) */
  loading?: boolean;
  /** ui 는 문구를 모른다 — 호출부가 copy 에서 넘긴다 */
  loadingLabel?: string;
  /** 비활성 이유. 버튼 위 한 줄 + TalkBack 힌트 */
  disabledReason?: string;
  accessibilityHint?: string;
  style?: LayoutOnlyStyle;
  testID?: string;
  buttonRef?: React.Ref<React.ComponentRef<typeof Pressable>>;
};

const c = ds.color;

/** 눌림 모양(tokens-v4 states.pressed). 면 색과 글자 tone — dsComponents 테스트가 어르신 7:1 을 계산한다(디자인 시스템 패널 r1) */
export const PRESSED_LOOK: Record<ButtonKind, {bg: string; ink: Tone}> = {
  primary: {bg: c.actionPressed, ink: 'onAction'},
  secondary: {bg: c.actionSoft, ink: 'actionPressed'}, // action 이면 6.03 → actionPressed 8.15
  text: {bg: c.actionSoft, ink: 'actionPressed'},
  danger: {bg: c.card, ink: 'danger'}, // dangerSoft 면이면 6.80 → card 8.31, 대신 테두리를 굵게
};

// v4 Button(SUMMARY 3절): 높이·글자는 kind 와 audience 로만 정해진다(숫자 prop 없음). minHeight 만, 고정 height 없음.
// 갈색(action)은 누를 것 전용 — 면(주)·테두리(보조)·밑줄(text) 중 하나를 반드시 함께 쓴다.
export function Button({kind = 'primary', size = 'dock', label, accessibilityLabel, align = 'center', onPress, icon, disabled, loading, loadingLabel, disabledReason, accessibilityHint, style, testID, buttonRef}: ButtonProps) {
  const a = useAudience();
  const blocked = !!disabled || !!loading;
  const shown = loading && loadingLabel ? loadingLabel : label;
  const primary = kind === 'primary';
  const text = roleText(primary ? 'buttonPrimary' : kind === 'text' ? 'link' : 'buttonSecondary', a);
  const minHeight = minTouch(primary ? 'primary' : kind === 'text' ? 'link' : 'secondary', a);
  const ink: Tone = disabled ? 'disabled' : primary ? 'onAction' : kind === 'danger' ? 'danger' : 'action';
  // 눌림 글자(tokens-v4 states.pressed, 디자인 시스템 패널 r1): 보조·text 는 actionSoft 면 위 action 이 6.03 이라 actionPressed(8.15).
  // 위험은 dangerSoft 면 위 dangerInk 가 6.80 이라 면을 card 로 두고(8.31) 테두리를 굵게 한다(안쪽 여백을 같이 줄여 크기는 그대로)
  const pressedInk = (pressed: boolean): Tone => (pressed && !disabled ? PRESSED_LOOK[kind].ink : ink);
  return (
    <View style={[size === 'dock' ? styles.stretch : styles.inline, pickLayout(style)]} testID={testID ? `${testID}-wrap` : undefined}>
      {disabled && disabledReason ? (
        // 이유는 버튼 힌트로도 읽으므로 이 줄은 화면 읽기에서 숨긴다(TalkBack R8)
        <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <RNText {...koreanTextProps} maxFontSizeMultiplier={roleText('sub', a).maxFontSizeMultiplier} style={[roleText('sub', a, 'muted').style, styles.reason]}>
            {keepAllChildren(disabledReason)}
          </RNText>
        </View>
      ) : null}
      <Pressable
        ref={buttonRef}
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={loading && loadingLabel ? shown : accessibilityLabel ?? shown}
        accessibilityHint={disabled && disabledReason ? disabledReason : accessibilityHint}
        accessibilityState={{disabled: blocked, busy: !!loading}}
        disabled={blocked}
        onPress={onPress}
        style={({pressed}) => [
          styles.base,
          {minHeight},
          kind === 'text' ? styles.text : primary ? styles.primary : kind === 'danger' ? styles.danger : styles.secondary,
          primary && (pressed || loading) ? styles.primaryPressed : null,
          !primary && kind !== 'text' && pressed ? (kind === 'danger' ? styles.dangerPressed : styles.secondaryPressed) : null,
          kind === 'text' && pressed ? styles.secondaryPressed : null,
          disabled ? styles.disabled : null,
          align === 'start' ? styles.baseStart : null,
        ]}>
        {({pressed}) => (
          <View style={[styles.inner, align === 'start' ? styles.innerStart : null]}>
            {icon ? <Icon name={icon} size={text.icon ?? 32} color={roleText('link', a, pressedInk(pressed)).style.color as string} /> : null}
            <RNText
              {...koreanTextProps}
              maxFontSizeMultiplier={text.maxFontSizeMultiplier}
              style={[roleText(primary ? 'buttonPrimary' : kind === 'text' ? 'link' : 'buttonSecondary', a, pressedInk(pressed)).style, styles.label, align === 'start' ? styles.labelStart : null, kind === 'text' && !disabled ? styles.underline : null]}>
              {keepAllChildren(shown)}
            </RNText>
          </View>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  stretch: {alignSelf: 'stretch'},
  inline: {alignSelf: 'flex-start'},
  base: {borderRadius: ds.radius.button, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 8},
  primary: {backgroundColor: c.action},
  primaryPressed: {backgroundColor: PRESSED_LOOK.primary.bg},
  secondary: {backgroundColor: c.card, borderWidth: 3, borderColor: c.action},
  secondaryPressed: {backgroundColor: PRESSED_LOOK.secondary.bg},
  danger: {backgroundColor: c.card, borderWidth: 3, borderColor: c.dangerInk},
  dangerPressed: {backgroundColor: PRESSED_LOOK.danger.bg, borderWidth: 5, paddingHorizontal: 18, paddingVertical: 6}, // 테두리 +2 만큼 안쪽 여백 −2(크기 그대로)
  text: {backgroundColor: 'transparent', paddingHorizontal: 8},
  // 비활성 면은 바탕 대비 1.10이라 녹는다 → line 테두리 1.5(3:1)를 둔다(tokens-v4 colorRules)
  disabled: {backgroundColor: c.disabledBg, borderWidth: 1.5, borderColor: c.line},
  inner: {flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, flexShrink: 1},
  label: {textAlign: 'center', flexShrink: 1},
  // align start: 본문 글과 왼쪽 끝을 맞춘다(글자 링크 좌우 여백 8 을 빼서 제목·안내 줄과 같은 선)
  baseStart: {alignItems: 'flex-start', paddingHorizontal: 0},
  innerStart: {justifyContent: 'flex-start'},
  labelStart: {textAlign: 'left'},
  underline: {textDecorationLine: 'underline'},
  reason: {textAlign: 'center', marginBottom: 8},
});
