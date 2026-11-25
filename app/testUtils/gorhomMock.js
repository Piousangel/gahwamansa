/* eslint-env jest */
// @gorhom/bottom-sheet jest 목(11-25). 공식 목(@gorhom/bottom-sheet/mock)을 그대로 쓰되 BottomSheet·BottomSheetScrollView·BottomSheetFooter 만 바꾼다:
// 공식 목은 children 만 그려 우리 Sheet 의 손잡이(handleComponent)·밖 누르기(backdropComponent)·바탕·아래 줄(footerComponent)을 볼 수 없다.
// 여기서는 그것들을 함께 그리고, 받은 props 와 ref 호출을 시험이 읽을 수 있게 남긴다(__last).
// 손가락 끌기·안쪽 스크롤 동시 인식·스냅 모션은 네이티브(UI 스레드)라 jest 대상이 아니다 → 에뮬레이터 증거.
const React = require('react');
const {ScrollView, StyleSheet, View} = require('react-native');
const official = jest.requireActual('@gorhom/bottom-sheet/mock');

let last = null;

const BottomSheet = React.forwardRef(function BottomSheetMock(props, ref) {
  const [index, setIndex] = React.useState(props.index ?? 0);
  // ref 메서드는 이 시트 자신의 최신 props 로 사건을 낸다(모듈 전역 last 가 아니라, 리뷰)
  const propsRef = React.useRef(props);
  propsRef.current = props;
  const api = React.useMemo(
    () => ({
      snapToIndex: jest.fn(i => {
        setIndex(i);
        propsRef.current.onChange?.(i, 0, 0);
      }),
      snapToPosition: jest.fn(),
      expand: jest.fn(),
      collapse: jest.fn(),
      close: jest.fn(() => {
        setIndex(-1);
        propsRef.current.onChange?.(-1, 0, 0);
        propsRef.current.onClose?.();
      }),
      forceClose: jest.fn(),
    }),
    [],
  );
  React.useImperativeHandle(ref, () => api, [api]);
  last = {props, api, index};
  // gorhom 처럼 칸 번호를 Reanimated 공유 값으로 넘긴다(useAnimatedStyle 이 바뀜을 따라가게). 값 쓰기는 그린 뒤에(그리는 중 쓰기 경고 방지)
  const {makeMutable} = require('react-native-reanimated');
  const animatedIndex = React.useRef(makeMutable(index)).current;
  const animatedPosition = React.useRef(makeMutable(0)).current;
  const animatedFooterPosition = React.useRef(makeMutable(0)).current;
  React.useEffect(() => {
    animatedIndex.value = index;
  }, [animatedIndex, index]);
  const {backdropComponent: Backdrop, backgroundComponent: Background, handleComponent: Handle, footerComponent: Footer} = props;
  // 그리는 순서는 실제 gorhom 5.2.14(BottomSheet.tsx render)와 같게: 배경 → 바탕 → 내용(children + footer) → 손잡이.
  // 손잡이는 맨 뒤 형제이고 화면 위치만 column-reverse 로 위에 보인다 → 화면 읽기 순서도 손잡이가 맨 뒤(QA-2 M2, DECISIONS)
  return React.createElement(
    View,
    {testID: 'gorhom-sheet', style: props.style},
    Backdrop ? React.createElement(Backdrop, {animatedIndex, animatedPosition, style: StyleSheet.absoluteFill}) : null,
    Background ? React.createElement(Background, {animatedIndex, animatedPosition, style: props.backgroundStyle}) : null,
    props.children,
    Footer ? React.createElement(Footer, {animatedFooterPosition}) : null,
    Handle ? React.createElement(Handle, {animatedIndex, animatedPosition}) : null,
  );
});

// 공식 목은 RN ScrollView 를 그대로 내보내 '시트 스크롤을 썼는지'를 가릴 수 없다 → 이름 있는 감싸개
const BottomSheetScrollView = React.forwardRef(function BottomSheetScrollView(props, ref) {
  return React.createElement(ScrollView, {...props, ref});
});

// 공식 목에 없다: 아래 줄(footerComponent 안)을 그대로 그린다
function BottomSheetFooter({children, style}) {
  return React.createElement(View, {style}, children);
}

// 공식 목에 없다: gorhom 기본 제스처 처리기. 시험이 우리 래퍼(useSheetGestureHandlers)가 넘기는 값을 보게 jest.fn
const defaultHandlers = {handleOnStart: jest.fn(), handleOnChange: jest.fn(), handleOnEnd: jest.fn(), handleOnFinalize: jest.fn()};
const useGestureEventsHandlersDefault = () => defaultHandlers;

module.exports = {
  ...official,
  BottomSheetScrollView,
  BottomSheetFooter,
  useGestureEventsHandlersDefault,
  __defaultHandlers: defaultHandlers,
  __esModule: true,
  default: BottomSheet,
  BottomSheet,
  /** 마지막으로 그린 시트의 {props, api(ref 메서드 jest.fn), index} */
  __last: () => last,
};
