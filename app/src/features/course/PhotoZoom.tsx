import React, {useEffect, useRef} from 'react';
import {Animated, Image, Modal, Pressable, StyleSheet, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Text20} from '../../ui/Text20';
import {color, FONT_SCALE_MAX, size, space} from '../../ui/tokens';
import {useMotionMode} from '../../ui/motion';
import {focusLater} from '../../ui/screenTitle';
import {appCopy, copy} from '../../copy/copy';

const p = copy.photo;

// B1 사진 크게 보기(시안 P4_zoom_review, 디자인 W0 DZ-06). 한 장을 크게 보는 것만(핀치·확대 없음).
// - 닫기: 위 왼쪽 '닫기'(64)와 안드로이드 뒤로(Modal onRequestClose)만. 사진을 다시 눌러 닫지 않는다(실수 방지).
// - AI 표기는 크게 보기에서도 늘 보임(캡션 아래).
// - 모션: 300ms 페이드 + 살짝 커짐(.96→1), 동작 줄이기·화면 읽기면 페이드만.
// - 읽기: 열리면 포커스 '사진 크게 보기, {caption}, AI가 만든 그림'(11절 2c) → '닫기'. 닫히면 사진(폴라로이드)으로 복귀(호출부).
// TODO(디자인 P4_zoom_landscape): 크게 보기만 가로 허용은 화면 방향 고정을 푸는 네이티브 작업이 필요해 빌드 1 세로만.
export function PhotoZoom({visible, uri, caption, onClose}: {visible: boolean; uri: string; caption: string; onClose: () => void}) {
  const insets = useSafeAreaInsets();
  const mode = useMotionMode();
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.96)).current;
  const titleRef = useRef<React.ComponentRef<typeof View>>(null);
  useEffect(() => {
    if (!visible) {
      opacity.setValue(0);
      scale.setValue(0.96);
      return undefined;
    }
    const full = mode === 'full';
    const a = Animated.parallel([
      Animated.timing(opacity, {toValue: 1, duration: 300, useNativeDriver: true}),
      Animated.timing(scale, {toValue: 1, duration: full ? 300 : 0, useNativeDriver: true}),
    ]);
    a.start();
    const cancel = focusLater(() => titleRef.current);
    return () => {
      a.stop();
      cancel();
    };
  }, [visible, mode, opacity, scale]);
  const label = p.zoom_a11y.split('{caption}').join(caption);
  return (
    <Modal testID="zoom-modal" visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <Animated.View testID="zoom-view" style={[styles.root, {opacity, paddingTop: insets.top + space.sm + size.touchMin, paddingBottom: insets.bottom + space.lg}]}>
        {/* 사진: 누르는 요소가 아니다(다시 눌러 닫기 없음). 읽기는 한 덩어리 라벨 */}
        <Animated.View testID="zoom-photo" ref={titleRef} accessible accessibilityRole="image" accessibilityLabel={label} style={[styles.photoWrap, {transform: [{scale}]}]}>
          <Image source={{uri}} style={styles.photo} resizeMode="contain" />
          <Text20 size={28} weight="bold" style={styles.caption} accessibilityElementsHidden importantForAccessibility="no">
            {caption}
          </Text20>
          <Text20 style={styles.ai} accessibilityElementsHidden importantForAccessibility="no">
            {appCopy.ai_photo_label}
          </Text20>
        </Animated.View>
        {/* 읽기 순서: 사진 → 닫기(시안 11절 2c). 닫기는 뒤에 두고 위 왼쪽에 절대 위치(리뷰 L1) */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={p.zoom_close}
          onPress={onClose}
          hitSlop={8}
          style={({pressed}) => [styles.close, {top: insets.top + space.sm}, pressed ? styles.pressed : null]}>
          <Text20 size={22} weight="bold" maxFontSizeMultiplier={FONT_SCALE_MAX} style={styles.closeText}>
            {p.zoom_close}
          </Text20>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: color.paper, paddingHorizontal: space.screenX},
  close: {position: 'absolute', left: space.screenX, minHeight: size.touchMin, minWidth: size.touchMin, justifyContent: 'center', paddingHorizontal: space.sm},
  pressed: {opacity: 0.6},
  closeText: {color: color.ink},
  photoWrap: {flex: 1, justifyContent: 'center', gap: space.sm},
  photo: {width: '100%', aspectRatio: 272 / 236, backgroundColor: color.paperSoft},
  caption: {textAlign: 'center', color: color.inkTitle},
  ai: {textAlign: 'center', color: color.inkBody},
});
