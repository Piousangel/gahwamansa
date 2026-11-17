import {getAppEnv} from './env';

export type AppConfig = {SUPABASE_URL: string; SUPABASE_KEY: string};

// 앱용 Supabase 접속 값. 앱 빌드는 app/env/<flavor>.env(Gradle 생성), 로컬 개발은 config.local.ts.
// 값이 없으면 안내 메시지로 실패한다. 값은 코드에 하드코딩하지 않는다.
// 통합 테스트는 이 함수를 쓰지 않는다(빌드가 남긴 원격 값으로 붙지 않게) → loadLocalConfig
export function loadConfig(): AppConfig {
  const {SUPABASE_URL, SUPABASE_KEY} = getAppEnv();
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error(
      'Supabase 접속 값이 없어요. 앱은 staging/production 빌드(app/env/*.env)로 실행하거나, 로컬 개발이면 src/lib/config.local.example.ts 를 config.local.ts 로 복사해 SUPABASE_URL, SUPABASE_KEY 를 채워 주세요.',
    );
  }
  return {SUPABASE_URL, SUPABASE_KEY};
}

// 로컬 Supabase 주소: 루프백, 에뮬레이터(10.0.2.2), 사설망(맥 LAN IP). 그 외는 원격으로 본다
const LOCAL_HOST =
  /^(127\.0\.0\.1|localhost|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})$/;
export function isLocalSupabaseUrl(url: string): boolean {
  const m = /^https?:\/\/([^/:?#]+)(:\d+)?(\/.*)?$/.exec(url ?? '');
  return !!m && LOCAL_HOST.test(m[1]);
}

// 통합 테스트 접속 값 검사: config.local.ts 값만, 로컬 주소만. service role 키(데이터 삭제)가 원격과 섞이면 실패
export function assertLocalTarget(local: Partial<AppConfig> | undefined, serviceRoleKey?: string): AppConfig {
  if (!local?.SUPABASE_URL || !local?.SUPABASE_KEY) {
    throw new Error('통합 테스트는 src/lib/config.local.ts(로컬 Supabase)만 써요. 파일이 없거나 비어 있어요.');
  }
  if (!isLocalSupabaseUrl(local.SUPABASE_URL)) {
    const why = serviceRoleKey ? ' service role 키까지 있어 원격 데이터를 지울 수 있어요.' : '';
    throw new Error(`통합 테스트는 로컬 Supabase 에만 붙어요. 지금 주소: ${local.SUPABASE_URL}.${why}`);
  }
  return {SUPABASE_URL: local.SUPABASE_URL, SUPABASE_KEY: local.SUPABASE_KEY};
}

// 통합 테스트 전용(node). env.generated.ts·getAppEnv 를 거치지 않는다
export function loadLocalConfig(serviceRoleKey?: string): AppConfig {
  let local: Partial<AppConfig> | undefined;
  try {
    local = require('./config.local').default;
  } catch {
    local = undefined;
  }
  return assertLocalTarget(local, serviceRoleKey);
}
