import React from 'react';
import {AppRoot} from './src/app/AppRoot';
import {ApiMode, createApi} from './src/features/selectApi';

const API_MODE: ApiMode = 'fake'; // 'real' 로 바꾸면 로컬 Supabase 사용
const api = createApi(API_MODE);
// 6a: 서버 없이 mock. 역할은 임시로 'parent' 고정(자녀 화면 확인은 'child'로 바꿔서).
export default function App() {
  return <AppRoot api={api} role="parent" restore={API_MODE === 'real'} />;
}
