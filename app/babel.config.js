module.exports = {
  presets: ['module:@react-native/babel-preset'],
  // Reanimated 4 의 worklet 변환(useAnimatedStyle 등 UI 스레드 함수). 공식 안내대로 plugins 맨 마지막에 둔다(gorhom 바텀시트, 11-25)
  plugins: ['react-native-worklets/plugin'],
};
