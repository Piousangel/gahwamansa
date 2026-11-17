import React, {useRef, useState} from 'react';
import {Animated, ImageSourcePropType, ImageURISource, StyleProp, StyleSheet, View, ViewStyle} from 'react-native';
import {color, radius} from './tokens';
import {Icon} from './assets/icons';
import {isPrefetched} from './imageCache';
import {fadeMs, useReduceMotion} from './motion';

type Props = {
  source: ImageSourcePropType;
  /** 가로/세로. 불러오기 전에도 자리를 지켜 레이아웃이 움직이지 않게 한다 */
  aspectRatio: number;
  /** TalkBack R6: 뜻이 있는 사진은 한 번 읽는다. 예: "오늘 사진, 가을 마을, AI가 만든 그림" */
  accessibilityLabel: string;
  onError?: () => void;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

type Status = 'loading' | 'loaded' | 'error';

const uriOf = (s: ImageSourcePropType) => (s && typeof s === 'object' && !Array.isArray(s) ? (s as ImageURISource).uri : undefined);

/**
 * 사진 자리표시 + 페이드 인. 불러오는 동안·실패 시 종이색 면에 사진 아이콘(장식, R13 읽지 않음).
 * 다 불러오면 300ms 불투명도로 나타남. 동작 줄이기·이미 받아 둔 사진(imageCache)은 바로.
 */
export function Photo({source, aspectRatio, accessibilityLabel, onError, borderRadius = radius.chip, style, testID}: Props) {
  const reduce = useReduceMotion();
  const instant = reduce || isPrefetched(uriOf(source));
  const opacity = useRef(new Animated.Value(instant ? 1 : 0)).current;
  const [status, setStatus] = useState<Status>('loading');

  const onLoad = () => {
    setStatus('loaded');
    const ms = instant ? 0 : fadeMs(reduce);
    if (ms === 0) {
      opacity.setValue(1);
      return;
    }
    Animated.timing(opacity, {toValue: 1, duration: ms, useNativeDriver: true}).start();
  };

  return (
    <View testID={testID ?? 'photo'} style={[styles.frame, {aspectRatio, borderRadius}, style]}>
      {status !== 'loaded' ? (
        <View
          testID="photo-placeholder"
          style={[StyleSheet.absoluteFill, styles.placeholder]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants">
          <Icon name="icon-photo" size={40} color={color.line} />
        </View>
      ) : null}
      <Animated.Image
        testID="photo-image"
        source={source}
        accessible
        accessibilityRole="image"
        accessibilityLabel={accessibilityLabel}
        onLoad={onLoad}
        onError={() => {
          setStatus('error');
          onError?.();
        }}
        resizeMode="cover"
        style={[StyleSheet.absoluteFill, {opacity: status === 'error' ? 0 : opacity}]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {width: '100%', overflow: 'hidden', backgroundColor: color.paperSoft},
  placeholder: {alignItems: 'center', justifyContent: 'center', backgroundColor: color.paperSoft},
});
