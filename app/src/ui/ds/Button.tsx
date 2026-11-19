import React from 'react';
import {Pressable, StyleSheet, Text as RNText, View} from 'react-native';
import {keepAllChildren, koreanTextProps} from '../koreanText';
import {Icon, type IconName} from '../assets/icons';
import {ds, minTouch, roleText, type Tone} from './roles';
import {useAudience, type LayoutOnlyStyle} from './audience';

export type ButtonKind = 'primary' | 'secondary' | 'text' | 'danger';
export type ButtonProps = {
  kind?: ButtonKind;
  /** dock: 가로를 채움(Dock·본문 끝 행동). inline: 글자만큼(카드·행 안) */
  size?: 'dock' | 'inline';
  label: string;
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

// v4 Button(SUMMARY 3절): 높이·글자는 kind 와 audience 로만 정해진다(숫자 prop 없음). minHeight 만, 고정 height 없음.
// 갈색(action)은 누를 것 전용 — 면(주)·테두리(보조)·밑줄(text) 중 하나를 반드시 함께 쓴다.
export function Button({kind = 'primary', size = 'dock', label, onPress, icon, disabled, loading, loadingLabel, disabledReason, accessibilityHint, style, testID, buttonRef}: ButtonProps) {
  const a = useAudience();
  const blocked = !!disabled || !!loading;
  const shown = loading && loadingLabel ? loadingLabel : label;
  const primary = kind === 'primary';
  const text = roleText(primary ? 'buttonPrimary' : kind === 'text' ? 'link' : 'buttonSecondary', a);
  const minHeight = minTouch(primary ? 'primary' : kind === 'text' ? 'link' : 'secondary', a);
  const ink: Tone = disabled ? 'disabled' : primary ? 'onAction' : kind === 'danger' ? 'danger' : 'action';
  return (
    <View style={[size === 'dock' ? styles.stretch : styles.inline, style]} testID={testID ? `${testID}-wrap` : undefined}>
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
        accessibilityLabel={shown}
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
        ]}>
        <View style={styles.inner}>
          {icon ? <Icon name={icon} size={text.icon ?? 32} color={roleText('link', a, ink).style.color as string} /> : null}
          <RNText
            {...koreanTextProps}
            maxFontSizeMultiplier={text.maxFontSizeMultiplier}
            style={[roleText(primary ? 'buttonPrimary' : kind === 'text' ? 'link' : 'buttonSecondary', a, ink).style, styles.label, kind === 'text' && !disabled ? styles.underline : null]}>
            {keepAllChildren(shown)}
          </RNText>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  stretch: {alignSelf: 'stretch'},
  inline: {alignSelf: 'flex-start'},
  base: {borderRadius: ds.radius.button, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 8},
  primary: {backgroundColor: c.action},
  primaryPressed: {backgroundColor: c.actionPressed},
  secondary: {backgroundColor: c.card, borderWidth: 3, borderColor: c.action},
  secondaryPressed: {backgroundColor: c.actionSoft},
  danger: {backgroundColor: c.card, borderWidth: 3, borderColor: c.dangerInk},
  dangerPressed: {backgroundColor: c.dangerSoft},
  text: {backgroundColor: 'transparent', paddingHorizontal: 8},
  // 비활성 면은 바탕 대비 1.10이라 녹는다 → line 테두리 1.5(3:1)를 둔다(tokens-v4 colorRules)
  disabled: {backgroundColor: c.disabledBg, borderWidth: 1.5, borderColor: c.line},
  inner: {flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, flexShrink: 1},
  label: {textAlign: 'center', flexShrink: 1},
  underline: {textDecorationLine: 'underline'},
  reason: {textAlign: 'center', marginBottom: 8},
});
