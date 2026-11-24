/* eslint-env jest */
// @gorhom/bottom-sheet jest 목(11-25). 공식 목(@gorhom/bottom-sheet/mock)을 그대로 쓰되 BottomSheet 만 바꾼다:
// 공식 목은 children 만 그려 우리 Sheet 의 손잡이(handleComponent)·밖 누르기(backdropComponent)·배경을 볼 수 없다.
// 여기서는 그 셋을 함께 그리고, 받은 props 와 ref 호출을 시험이 읽을 수 있게 남긴다(__last).
// 손가락 끌기·안쪽 스크롤 동시 인식·스냅 모션은 네이티브(UI 스레드)라 jest 대상이 아니다 → 에뮬레이터 증거.
const React = require('react');
const {ScrollView, StyleSheet, View} = require('react-native');
const official = jest.requireActual('@gorhom/bottom-sheet/mock');

let last = null;

const BottomSheet = React.forwardRef(function BottomSheetMock(props, ref) {
  const [index, setIndex] = React.useState(props.index ?? 0);
  const api = React.useMemo(
    () => ({
      snapToIndex: jest.fn(i => {
        setIndex(i);
        last.props.onChange?.(i, 0, 0);
      }),
      snapToPosition: jest.fn(),
      expand: jest.fn(),
      collapse: jest.fn(),
      close: jest.fn(() => {
        setIndex(-1);
        last.props.onChange?.(-1, 0, 0);
        last.props.onClose?.();
      }),
      forceClose: jest.fn(),
    }),
    [],
  );
  React.useImperativeHandle(ref, () => api, [api]);
  last = {props, api, index};
  // gorhom 처럼 칸 번호를 Reanimated 공유 값으로 넘긴다(useAnimatedStyle 이 바뀜을 따라가게)
  const {makeMutable} = require('react-native-reanimated');
  const animatedIndex = React.useRef(makeMutable(index)).current;
  const animatedPosition = React.useRef(makeMutable(0)).current;
  animatedIndex.value = index;
  const {backdropComponent: Backdrop, backgroundComponent: Background, handleComponent: Handle} = props;
  return React.createElement(
    View,
    {testID: 'gorhom-sheet', style: props.style},
    Backdrop ? React.createElement(Backdrop, {animatedIndex, animatedPosition, style: StyleSheet.absoluteFill}) : null,
    Background ? React.createElement(Background, {animatedIndex, animatedPosition, style: props.backgroundStyle}) : null,
    Handle ? React.createElement(Handle, {animatedIndex, animatedPosition}) : null,
    props.children,
  );
});

// 공식 목은 RN ScrollView 를 그대로 내보내 '시트 스크롤을 썼는지'를 가릴 수 없다 → 이름 있는 감싸개
const BottomSheetScrollView = React.forwardRef(function BottomSheetScrollView(props, ref) {
  return React.createElement(ScrollView, {...props, ref});
});

module.exports = {
  ...official,
  BottomSheetScrollView,
  __esModule: true,
  default: BottomSheet,
  BottomSheet,
  /** 마지막으로 그린 시트의 {props, api(ref 메서드 jest.fn), index} */
  __last: () => last,
};
