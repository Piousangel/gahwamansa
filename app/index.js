/**
 * @format
 */

// 맨 먼저: 암호학적 난수(crypto.getRandomValues) 폴리필. RN(Hermes)에는 기본으로 없다. 카카오 로그인 nonce 에 필요
import 'react-native-get-random-values';
// 제스처 핸들러를 앱 코드보다 먼저 불러 등록한다(공식 설치 안내, gorhom 바텀시트 11-25)
import 'react-native-gesture-handler';

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
