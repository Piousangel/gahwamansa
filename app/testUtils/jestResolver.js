// jest 리졸버 사슬(11-25 gorhom): Reanimated 공식 리졸버(→ worklets 리졸버) 다음에 RN preset 리졸버를 부른다.
// jest 설정의 resolver 는 하나라 Reanimated 것만 두면 preset 리졸버(react-native 패키지 exports 지우기)가 빠진다(리뷰 xhigh).
const presetResolver = require('@react-native/jest-preset/jest/resolver.js');
const reanimatedResolver = require('react-native-reanimated/jest/resolver');

/** @type {import('jest-resolve').SyncResolver} */
module.exports = (request, options) =>
  reanimatedResolver(request, {
    ...options,
    defaultResolver: (req, opts) => presetResolver(req, {...opts, defaultResolver: options.defaultResolver}),
  });
