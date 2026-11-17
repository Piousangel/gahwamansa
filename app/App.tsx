import React from 'react';
import {AppRoot} from './src/app/AppRoot';
import {ApiMode, createApi} from './src/features/selectApi';

const API_MODE: ApiMode = 'fake'; // 'real' 로 바꾸면 로컬 Supabase 사용
const api = createApi(API_MODE);
// 첫 화면에서 역할을 고른다. real 모드는 시작 시 이 기기 상태(연결된 어르신/로그인한 자녀)를 복원한다.
export default function App() {
  return <AppRoot api={api} restore={API_MODE === 'real'} />;
}
