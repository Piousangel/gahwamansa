import React, {useRef, useState, type RefObject} from 'react';
import {Animated, Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View} from 'react-native';
import Svg, {Path} from 'react-native-svg';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {color as v3color, shadow} from '../tokens';
import {useModalFocus} from '../a11y';
import {useToastModalGuard} from '../toastPlacement';
import {useFadeIn} from '../useFadeIn';
import {AudienceProvider, useAudience} from './audience';
import {Heading, Text} from './Text';
import {MoreBand} from './MoreBand';
import {ds} from './roles';

const c = ds.color;
/** 시트 높이 상한(화면 높이 비율, 시안 C4_cheer_sheet_ds4) */
export const SHEET_MAX_RATIO = 0.88;
/** 닫기 알약 최소 크기(48×48) */
const CLOSE_MIN = 48;

export type SheetProps = {
  visible: boolean;
  title: string;
  /** 제목 아래 보조 한 줄(sub) */
  sub?: string;
  /** X·밖 누르기·안드로이드 뒤로 */
  onClose: () => void;
  /** X 읽는 이름(ui 는 문구를 모른다 — 호출부가 copy 에서) */
  closeLabel: string;
  /** 닫히면 포커스를 돌려줄 요소(이 시트를 연 버튼, R12) */
  returnFocusRef?: RefObject<unknown>;
  children?: React.ReactNode;
  testID?: string;
};

/**
 * v4 아래 시트(시안 child/C4_cheer_sheet_ds4, UX 깊이 V14). 자녀 전용(어르신은 Dialog).
 * - 머리: 제목(Heading 2) + 닫기 48×48 알약. 끌리지 않는 손잡이 막대는 없다(끌어서 닫기를 쓰지 않음, V14 ①).
 * - 높이는 화면의 88%까지, 넘치면 시트 안에서만 스크롤 + 아래 '더 있음' 띠(R-19, 넘칠 때만).
 * - 글자는 역할 상한(선택지 bodyLg 2.0) — 150%로 묶지 않는다(V14 ③).
 * - 닫는 길: X · 밖 누르기 · 안드로이드 뒤로. 열리면 포커스가 제목으로, 닫히면 연 버튼으로. 모션은 불투명도만(옛 BottomSheet 와 같음).
 */
export function Sheet(props: SheetProps) {
  // 시트는 Modal(별도 창)이라 화면의 AudienceProvider 가 닿지 않을 수 있어 바깥 audience 를 그대로 넘긴다
  const a = useAudience();
  return (
    <AudienceProvider value={a}>
      <SheetInner {...props} />
    </AudienceProvider>
  );
}

function SheetInner({visible, title, sub, onClose, closeLabel, returnFocusRef, children, testID = 'ds-sheet'}: SheetProps) {
  const titleRef = useRef<React.ComponentRef<typeof View>>(null);
  const openFocus = useModalFocus(visible, titleRef, returnFocusRef);
  useToastModalGuard(visible); // 열려 있는 동안 토스트를 띄우지 않는다(UX U2)
  const insets = useSafeAreaInsets();
  const {height} = useWindowDimensions();
  const {opacity, start} = useFadeIn(visible);
  const [view, setView] = useState(0);
  const [content, setContent] = useState(0);
  const more = content > view + 1;

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
        {/* 밖 누르기 = 닫기. 화면 읽기에서는 X 가 같은 일을 하므로 숨긴다 */}
        <Pressable testID="sheet-scrim" style={styles.scrim} onPress={onClose} accessible={false} importantForAccessibility="no" />
        <View testID={testID} accessibilityViewIsModal style={[styles.panel, {maxHeight: Math.floor(height * SHEET_MAX_RATIO)}]}>
          <ScrollView
            testID={`${testID}-scroll`}
            style={styles.scroll}
            onLayout={e => setView(Math.round(e.nativeEvent.layout.height))}
            onContentSizeChange={(_w, h) => setContent(Math.round(h))}
            contentContainerStyle={[styles.body, {paddingBottom: Math.max(28, 16 + insets.bottom)}]}>
            <View style={styles.head}>
              <View ref={titleRef} accessible accessibilityRole="header" style={styles.titleWrap}>
                <Heading level={2}>{title}</Heading>
              </View>
              <Pressable
                testID="sheet-close"
                accessibilityRole="button"
                accessibilityLabel={closeLabel}
                onPress={onClose}
                style={({pressed}) => [styles.close, pressed ? styles.closePressed : null]}>
                <Svg width={24} height={24} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no">
                  <Path d="M6 6l12 12M18 6L6 18" stroke={c.action} strokeWidth={3} strokeLinecap="round" fill="none" />
                </Svg>
              </Pressable>
            </View>
            {sub ? (
              <Text role="sub" tone="muted">
                {sub}
              </Text>
            ) : null}
            {children}
          </ScrollView>
          {more ? <MoreBand /> : null}
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, justifyContent: 'flex-end'},
  scrim: {...StyleSheet.absoluteFill, backgroundColor: v3color.scrim},
  panel: {backgroundColor: c.paper, borderTopLeftRadius: ds.radius.sheet, borderTopRightRadius: ds.radius.sheet, boxShadow: shadow.lifted, overflow: 'hidden'},
  scroll: {flexGrow: 0},
  body: {gap: 12, paddingTop: 12, paddingHorizontal: 20},
  head: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12},
  titleWrap: {flex: 1},
  close: {
    minWidth: CLOSE_MIN, minHeight: CLOSE_MIN, borderRadius: ds.radius.button, borderWidth: 1.5, borderColor: c.line,
    backgroundColor: c.card, alignItems: 'center', justifyContent: 'center',
  },
  closePressed: {backgroundColor: c.actionSoft},
});
