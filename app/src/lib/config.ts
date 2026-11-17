import {getAppEnv} from './env';

export type AppConfig = {SUPABASE_URL: string; SUPABASE_KEY: string};

// Supabase 접속 값. 앱 빌드는 app/env/<flavor>.env(Gradle 생성), 로컬 개발·통합 테스트는 config.local.ts.
// 값이 없으면 안내 메시지로 실패한다. 값은 코드에 하드코딩하지 않는다.
export function loadConfig(): AppConfig {
  const {SUPABASE_URL, SUPABASE_KEY} = getAppEnv();
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error(
      'Supabase 접속 값이 없어요. 앱은 staging/production 빌드(app/env/*.env)로 실행하거나, 로컬 개발이면 src/lib/config.local.example.ts 를 config.local.ts 로 복사해 SUPABASE_URL, SUPABASE_KEY 를 채워 주세요.',
    );
  }
  return {SUPABASE_URL, SUPABASE_KEY};
}
