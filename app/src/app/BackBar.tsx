import React, {useCallback} from 'react';
import {BackHandler, Pressable, StyleSheet, Text} from 'react-native';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import {color, FONT_SCALE_MAX, size} from '../ui/tokens';
import {copy} from '../copy/copy';
import {backDestination} from './backDestination';

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

// 상단 뒤로 바(터치 64 이상). 보이는 글 = 목적지('‹ 설정으로'), 화면 읽기는 화살표 없이 같은 말(전문가 리뷰 W-09·R-14, '‹ 이전' 없앰).
// 목적지: to(onBack 이 스택 밖으로 갈 때 화면이 준다) → course(코스 홈) → 스택 바로 아래 화면(backDestination). 하드웨어 뒤로가기와 같은 동작.
// onBack 을 주지 않으면 스택에서 뒤로 갈 수 있을 때만 보인다(첫 화면에는 없음). 목적지를 모르면 숨는다('이전'으로 돌아가지 않음).
export function BackBar({onBack, course, to}: {onBack?: () => void; course?: boolean; to?: string}) {
  const navigation = useNavigation();
  useBackAction(onBack);
  const action = onBack ?? (navigation.canGoBack() ? () => navigation.goBack() : undefined);
  const dest = to ?? (course ? copy.nav.to.CourseHome : backDestination(navigation.getState() as never));
  if (!action || !dest) {
    return null;
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={dest}
      onPress={action}
      hitSlop={8}
      style={({pressed}) => [styles.bar, pressed ? styles.pressed : null]}>
      <Text maxFontSizeMultiplier={FONT_SCALE_MAX} style={styles.text}>
        {`‹ ${dest}`}
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
