import React from 'react';
import {AppRoot} from './src/app/AppRoot';
import {createApi} from './src/features/selectApi';
import {getAppEnv} from './src/lib/env';

// fake/real 은 환경 설정이 정한다: staging·production 빌드 = real(app/env/*.env), 개발 중 전환은 config.local.ts 의 API_MODE
const {API_MODE} = getAppEnv();
const api = createApi(API_MODE);
// 첫 화면에서 역할을 고른다. real 모드는 시작 시 이 기기 상태(연결된 어르신/로그인한 자녀)를 복원한다.
export default function App() {
  return <AppRoot api={api} restore={API_MODE === 'real'} />;
}
