/**
 * @format
 */

// 맨 먼저: 암호학적 난수(crypto.getRandomValues) 폴리필. RN(Hermes)에는 기본으로 없다. 카카오 로그인 nonce 에 필요
import 'react-native-get-random-values';
// 제스처 핸들러를 앱 코드보다 먼저 불러 등록한다(공식 설치 안내, gorhom 바텀시트 11-25)
import 'react-native-gesture-handler';

import { AppRegistry, LogBox } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import { registerBackgroundHandler } from './src/push/fcmTokenSource';

// 푸시(FCM)가 앱이 뒤에 있을 때 띄우는 머리 없는 작업을 앱보다 먼저 등록한다(RNFB 안내, #262 리뷰). Firebase 가 없는 빌드는 아무것도 안 함
registerBackgroundHandler();

// gorhom 5.2.14 가 Reanimated 4.6+ 에서 개발 빌드에만 내는 경고(훅 의존성 배열, 네이티브에서는 무시됨 — 동작 영향 없음).
// 상류 이슈 gorhom/react-native-bottom-sheet#2785(열림). gorhom 이 고치면 이 줄을 지운다. 이 문구 하나만 숨긴다
LogBox.ignoreLogs(['[Reanimated] Dependencies should only be used on the web']);

AppRegistry.registerComponent(appName, () => App);
