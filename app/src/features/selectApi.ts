import type {Api} from './types';
import {createFakeApi} from './fakeApi';

import type {ApiMode} from '../lib/env';
export type {ApiMode};

// 기본은 fake. 'real' 은 환경 설정(app/env/*.env 빌드 값 또는 개발 중 config.local.ts)의 Supabase 에 연결한다.
export function createApi(mode: ApiMode = 'fake'): Api {
  if (mode === 'real') {
    const {createRealApi} = require('./realApi');
    const {getSupabase} = require('../lib/supabase');
    return createRealApi(getSupabase());
  }
  return createFakeApi();
}
