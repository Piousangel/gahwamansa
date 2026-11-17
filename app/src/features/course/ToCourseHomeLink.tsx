import React from 'react';
import {Pressable, StyleSheet, useWindowDimensions} from 'react-native';
import {Text20} from '../../ui/Text20';
import {color, size} from '../../ui/tokens';
import {copy} from '../../copy/copy';

// UX U13(DECISIONS 11-18): 단계 화면 주 버튼 아래 보조 링크 "오늘 코스로". 위 왼쪽 '‹ 오늘 코스'가 한 손으로 멀어서.
// 기록 없이 코스 홈으로(상단 바·뒤로가기와 같은 동작). 글자 150% 이상이면 하단이 밀리므로 넣지 않는다.
// 읽기는 보이는 글 그대로 "오늘 코스로"(상단 바 "오늘 코스로 돌아가기"와 구분).
export function ToCourseHomeLink({onPress}: {onPress: () => void}) {
  const {fontScale} = useWindowDimensions();
  if (fontScale >= 1.5) {
    return null;
  }
  return (
    <Pressable
      testID="to-course-home"
      accessibilityRole="button"
      accessibilityLabel={copy.course.to_home}
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
