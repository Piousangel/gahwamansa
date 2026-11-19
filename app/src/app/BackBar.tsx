import React, {useCallback} from 'react';
import {BackHandler, Pressable, StyleSheet, Text} from 'react-native';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import {color, FONT_SCALE_MAX, size} from '../ui/tokens';
import {copy} from '../copy/copy';

// 하드웨어 뒤로가기를 화면이 정한 동작으로 바꾼다(화면이 보일 때만). onBack 이 없으면 기본 동작(스택 뒤로).
export function useBackAction(onBack?: () => void) {
  useFocusEffect(
    useCallback(() => {
      if (!onBack) {
        return undefined;
      }
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        onBack();
        return true;
      });
      return () => sub.remove();
    }, [onBack]),
  );
}

// 상단 "‹ 이전" 바(터치 64 이상, 화면 읽기 "이전 화면으로 가기"). 코스 단계는 "‹ 오늘 코스"(코스 홈으로). 하드웨어 뒤로가기와 같은 동작.
// onBack 을 주지 않으면 스택에서 뒤로 갈 수 있을 때만 보인다(첫 화면에는 없음).
export function BackBar({onBack, course}: {onBack?: () => void; course?: boolean}) {
  const navigation = useNavigation();
  useBackAction(onBack);
  const action = onBack ?? (navigation.canGoBack() ? () => navigation.goBack() : undefined);
  if (!action) {
    return null;
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={course ? copy.nav.back_course_a11y : copy.nav.back_a11y}
      onPress={action}
      hitSlop={8}
      style={({pressed}) => [styles.bar, pressed ? styles.pressed : null]}>
      <Text maxFontSizeMultiplier={FONT_SCALE_MAX} style={styles.text}>
        {course ? copy.nav.back_course : copy.nav.back}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // S25 실기기(11-19) '뒤로 링크가 작다' 최소 수정: 누름 영역 64 이상(높이·폭), 글자 본문(22) 이상. 디자인 규칙 v4 결과가 나오면 맞춘다
  bar: {minHeight: size.touchMin, minWidth: size.touchMin, justifyContent: 'center', alignSelf: 'flex-start', paddingRight: 20, paddingVertical: 4},
  pressed: {opacity: 0.6},
  text: {fontSize: 24, color: color.ink, fontWeight: 'bold'},
});
