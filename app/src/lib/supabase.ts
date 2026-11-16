import {createClient, SupabaseClient} from '@supabase/supabase-js';
import {loadConfig} from './config';

type Storage = {
  getItem(k: string): Promise<string | null> | string | null;
  setItem(k: string, v: string): Promise<void> | void;
  removeItem(k: string): Promise<void> | void;
};

// 테스트(node)와 앱에서 같은 팩토리를 쓴다. 앱은 AsyncStorage 를 넘긴다.
export function createSupabase(url: string, key: string, storage?: Storage): SupabaseClient {
  return createClient(url, key, {
    auth: {
      storage,
      persistSession: !!storage,
      autoRefreshToken: !!storage,
      detectSessionInUrl: false,
    },
  });
}

let appClient: SupabaseClient | null = null;
export function getSupabase(): SupabaseClient {
  if (!appClient) {
    // RN 에서만 필요한 것들은 여기서 늦게 불러온다(통합 테스트는 node 라 불필요)
    require('react-native-url-polyfill/auto');
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    const {SUPABASE_URL, SUPABASE_KEY} = loadConfig();
    appClient = createSupabase(SUPABASE_URL, SUPABASE_KEY, AsyncStorage);
  }
  return appClient;
}
