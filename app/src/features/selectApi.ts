import type {Api} from './types';
import {createFakeApi} from './fakeApi';

export type ApiMode = 'fake' | 'real';

// 기본은 fake. 'real' 은 로컬 Supabase(src/lib/config.local.ts 필요)에 연결한다.
export function createApi(mode: ApiMode = 'fake'): Api {
  if (mode === 'real') {
    const {createRealApi} = require('./realApi');
    const {getSupabase} = require('../lib/supabase');
    return createRealApi(getSupabase());
  }
  return createFakeApi();
}
