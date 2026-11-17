import React, {useRef, type RefObject} from 'react';
import {Animated, Modal, Pressable, ScrollView, StyleSheet, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {FONT_SCALE_MAX, color, font, radius, shadow, touch} from './tokens';
import {Text20} from './Text20';
import {Icon} from './assets/icons';
import {useModalFocus} from './a11y';
import {useFadeIn} from './useFadeIn';

type SheetAction = {
  label: string;
  onPress: () => void;
  /** TalkBack R8: 비활성이면 이유를 힌트로 읽는다(보이는 이유 줄은 중복 읽기 막음) */
  disabled?: boolean;
  disabledReason?: string;
};
type Props = {
  visible: boolean;
  title: string;
  body?: string;
  /** 본문 대신(또는 아래) 넣을 내용 */
  children?: React.ReactNode;
  primary?: SheetAction;
  /** 보조 버튼(예: "다음에 볼게요"). 누르면 그 함수만 부른다(닫기는 호출부가 결정). */
  secondary?: SheetAction;
  /** X·밖 누르기·안드로이드 뒤로 */
  onClose: () => void;
  /** X 버튼 읽는 이름(예: "닫기"). ui/ 는 문구를 모르므로 호출부가 copy 에서 넘긴다 */
  closeLabel: string;
  /** TalkBack R12: 닫히면 포커스를 돌려줄 요소(이 시트를 연 버튼) */
  returnFocusRef?: RefObject<unknown>;
  /** 모달 안 오류 한 줄(리뷰 M2: 모달 위 토스트는 Modal 창 밑에 그려져 안 보인다). 버튼 바로 위, 화면 읽기 polite */
  error?: string | null;
  testID?: string;
};

/**
 * 자녀 전용 아래 시트(README §12). 어르신에게는 쓰지 않는다(어르신은 Dialog). 겹쳐 열지 않는다.
 * 닫는 길: X(56 터치) · 보조 버튼 · 밖 누르기 · 안드로이드 뒤로. 열리면 포커스가 제목으로, 닫히면 연 버튼으로(R12).
 * Android 는 Modal 이 별도 창이라 바깥 화면을 읽지 않는다(iOS 는 accessibilityViewIsModal).
 * 모션: 불투명도만 300ms(위치 이동 없음, 동작 줄이기면 바로).
 */
export function BottomSheet({visible, title, body, children, primary, secondary, onClose, closeLabel, returnFocusRef, error, testID}: Props) {
  const titleRef = useRef<React.ComponentRef<typeof View>>(null);
  const openFocus = useModalFocus(visible, titleRef, returnFocusRef);
  const insets = useSafeAreaInsets();
  const {opacity, start} = useFadeIn(visible);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onShow={() => {
        start();
        openFocus();
      }}
      onRequestClose={onClose}>
      <Animated.View style={[styles.root, {opacity}]}>
        {/* 밖 누르기 = 닫기. 화면 읽기에서는 X 버튼이 같은 일을 하므로 숨긴다 */}
        <Pressable testID="sheet-scrim" style={styles.scrim} onPress={onClose} accessible={false} importantForAccessibility="no" />
        <View
          testID={testID ?? 'sheet-panel'}
          accessibilityViewIsModal
          style={[styles.panel, {paddingBottom: Math.max(28, 16 + insets.bottom)}]}>
          <View testID="sheet-handle" style={styles.handle} importantForAccessibility="no" accessibilityElementsHidden />
          <View style={styles.head}>
            <View ref={titleRef} accessible accessibilityRole="header" style={styles.titleWrap}>
              <Text20 size={24} weight="bold" maxFontSizeMultiplier={FONT_SCALE_MAX} style={styles.title}>
                {title}
              </Text20>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={closeLabel}
              onPress={onClose}
              style={({pressed}) => [styles.close, pressed ? styles.pressedSoft : null]}>
              <Icon name="icon-close" size={28} color={color.inkTitle} />
            </Pressable>
          </View>
          <ScrollView style={styles.bodyScroll}>
            {body ? <Text20 size={20}>{body}</Text20> : null}
            {children}
          </ScrollView>
          {error ? (
            <Text20 testID="sheet-error" size={20} weight="bold" accessibilityLiveRegion="polite" style={styles.error}>
              {error}
            </Text20>
          ) : null}
          {primary ? <SheetButton action={primary} kind="primary" /> : null}
          {secondary ? <SheetButton action={secondary} kind="secondary" /> : null}
        </View>
      </Animated.View>
    </Modal>
  );
}

function SheetButton({action, kind}: {action: SheetAction; kind: 'primary' | 'secondary'}) {
  const {label, onPress, disabled, disabledReason} = action;
  const primary = kind === 'primary';
  return (
    <View>
      {disabled && disabledReason ? (
        <Text20 size={20} style={styles.reason} importantForAccessibility="no" accessibilityElementsHidden>
          {disabledReason}
        </Text20>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={disabled ? disabledReason : undefined}
        accessibilityState={{disabled: !!disabled}}
        disabled={disabled}
        onPress={onPress}
        style={({pressed}) => [
          styles.button,
          primary ? (pressed ? styles.primaryPressed : styles.primary) : pressed ? styles.pressedSoft : null,
          disabled ? styles.disabled : null,
        ]}>
        <Text20
          size={20}
          weight="bold"
          maxFontSizeMultiplier={FONT_SCALE_MAX}
          style={[primary ? styles.primaryText : styles.secondaryText, disabled ? styles.disabledText : null]}>
          {label}
        </Text20>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, justifyContent: 'flex-end'},
  scrim: {...StyleSheet.absoluteFill, backgroundColor: color.scrim},
  panel: {
    backgroundColor: color.card, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet,
    paddingHorizontal: 20, paddingTop: 10, gap: 12, maxHeight: '90%', boxShadow: shadow.lifted,
  },
  handle: {alignSelf: 'center', width: 48, height: 5, borderRadius: 3, backgroundColor: color.lineGhost},
  head: {flexDirection: 'row', alignItems: 'flex-start', gap: 8},
  titleWrap: {flex: 1, paddingTop: 12},
  title: {fontFamily: font.title, color: color.inkTitle},
  close: {minWidth: touch.childRecommended, minHeight: touch.childRecommended, alignItems: 'center', justifyContent: 'center', borderRadius: 28},
  bodyScroll: {flexGrow: 0, flexShrink: 1},
  button: {minHeight: touch.childButton, borderRadius: radius.childCard, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16},
  primary: {backgroundColor: color.action},
  primaryPressed: {backgroundColor: color.actionPressed},
  primaryText: {color: color.onAction, textAlign: 'center'},
  secondaryText: {color: color.action, textAlign: 'center', textDecorationLine: 'underline'},
  pressedSoft: {backgroundColor: color.actionSoft},
  disabled: {backgroundColor: color.disabledBg},
  disabledText: {color: color.disabledInk, textDecorationLine: 'none'},
  reason: {textAlign: 'center', marginBottom: 6, color: color.inkSub},
  error: {color: color.dangerInk},
});
