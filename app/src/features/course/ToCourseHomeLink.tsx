import React from 'react';
import {Pressable, StyleSheet, useWindowDimensions} from 'react-native';
import {Text20} from '../../ui/Text20';
import {color, size} from '../../ui/tokens';
import {copy} from '../../copy/copy';
import {useScreenReader} from '../../ui/a11y';

// UX U13(DECISIONS 11-18): 단계 화면 주 버튼 아래 보조 링크 "오늘 코스로". 위 왼쪽 '‹ 오늘 코스'가 한 손으로 멀어서.
// 기록 없이 코스 홈으로(상단 바·뒤로가기와 같은 동작). DECISIONS '100%만': 글자 배율이 1 보다 크면 넣지 않는다.
// 읽기는 라이터 11-9 확정 "오늘 코스로 돌아가기"(상단 바와 같은 이름. 화면 읽기가 켜지면 그리지 않으므로 두 번 읽히지 않아 구분하지 않는다 — 라이터 11-19 확정). 저장 중에는 누를 수 없다.
export function ToCourseHomeLink({onPress, disabled}: {onPress: () => void; disabled?: boolean}) {
  const {fontScale} = useWindowDimensions();
  // 라이터 11-9 추가: 화면 읽기가 켜져 있으면 그리지 않는다(상단 바 '오늘 코스로 돌아가기'와 같은 이름이 두 번 읽히지 않게)
  const reader = useScreenReader();
  if (fontScale > 1 || reader) {
    return null;
  }
  return (
    <Pressable
      testID="to-course-home"
      accessibilityRole="button"
      accessibilityLabel={copy.nav.back_course_a11y}
      accessibilityState={{disabled: !!disabled}}
      disabled={disabled}
      onPress={onPress}
      style={({pressed}) => [styles.link, pressed ? styles.pressed : null]}>
      <Text20 weight="bold" style={styles.text}>{copy.course.to_home}</Text20>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: {minHeight: size.touchMin, alignItems: 'center', justifyContent: 'center'},
  pressed: {opacity: 0.6},
  text: {color: color.inkSub, textDecorationLine: 'underline'},
});
