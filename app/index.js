/**
 * @format
 */

// 맨 먼저: 암호학적 난수(crypto.getRandomValues) 폴리필. RN(Hermes)에는 기본으로 없다. 카카오 로그인 nonce 에 필요
import 'react-native-get-random-values';

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
