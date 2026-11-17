// 앱 환경 설정(공개 값만). 출처 우선순위(뒤가 앞을 덮음):
//   1) DEFAULT_ENV: 아무 설정이 없을 때 = 로컬 + fake(서버 없이 화면 개발)
//   2) env.generated.ts: Android 빌드 때 Gradle 이 app/env/<flavor>.env 로 만든다(gitignore, 직접 고치지 않음)
//   3) config.local.ts: 개발 빌드(__DEV__)에서만. 로컬 Supabase·fake 전환용(gitignore). release 에는 적용하지 않는다
// 설계: docs/plans/09-environments.md, 사용법: docs/team/RELEASE.md

export type AppEnvName = 'local' | 'staging' | 'production';
export type ApiMode = 'fake' | 'real';

export type AppEnv = {
  APP_ENV: AppEnvName;
  API_MODE: ApiMode;
  SUPABASE_PROJECT_REF: string;
  SUPABASE_URL: string;
  SUPABASE_KEY: string; // publishable(또는 로컬 anon) 키. 비밀 키 아님
  KAKAO_NATIVE_APP_KEY: string;
  GOOGLE_WEB_CLIENT_ID: string;
  VERSION_NAME: string; // 빌드가 없으면 ''
  VERSION_CODE: number | null;
  GIT_SHA: string;
};

export const DEFAULT_ENV: AppEnv = {
  APP_ENV: 'local',
  API_MODE: 'fake',
  SUPABASE_PROJECT_REF: '',
  SUPABASE_URL: '',
  SUPABASE_KEY: '',
  KAKAO_NATIVE_APP_KEY: '',
  GOOGLE_WEB_CLIENT_ID: '',
  VERSION_NAME: '',
  VERSION_CODE: null,
  GIT_SHA: '',
};

const ENV_NAMES: readonly string[] = ['local', 'staging', 'production'];
const API_MODES: readonly string[] = ['fake', 'real'];

// 빈 값·알 수 없는 값은 버린다(설정 파일 오타가 조용히 이상한 상태를 만들지 않게)
function clean(src: Partial<AppEnv> | undefined): Partial<AppEnv> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(src ?? {})) {
    if (!(k in DEFAULT_ENV) || v === '' || v === undefined || v === null) {
      continue;
    }
    if (k === 'APP_ENV' && !ENV_NAMES.includes(String(v))) {
      continue;
    }
    if (k === 'API_MODE' && !API_MODES.includes(String(v))) {
      continue;
    }
    out[k] = v;
  }
  return out as Partial<AppEnv>;
}

export function resolveAppEnv(
  generated: Partial<AppEnv> | undefined,
  local: Partial<AppEnv> | undefined,
  isDev: boolean,
): AppEnv {
  const gen = clean(generated);
  const loc = isDev ? clean(local) : {};
  const env: AppEnv = {...DEFAULT_ENV, ...gen, ...loc};
  // config.local.ts 로 서버 주소를 바꿨는데 환경 이름을 안 정했으면 로컬로 본다(스테이징 표시가 남지 않게)
  if (loc.SUPABASE_URL && !loc.APP_ENV) {
    env.APP_ENV = 'local';
    env.SUPABASE_PROJECT_REF = loc.SUPABASE_PROJECT_REF ?? '';
  }
  return env;
}

let cached: AppEnv | null = null;
export function getAppEnv(): AppEnv {
  if (!cached) {
    // Metro 는 try 블록 "바로 안"의 require 만 선택적 의존성으로 다룬다(파일이 없어도 번들 성공).
    // 함수로 감싸면 필수 의존성이 되어 번들이 실패하므로 아래 모양을 유지한다. 파일이 없으면 기본값
    let generated: Partial<AppEnv> | undefined;
    try {
      generated = require('./env.generated').default;
    } catch {
      generated = undefined;
    }
    let local: Partial<AppEnv> | undefined;
    try {
      local = require('./config.local').default;
    } catch {
      local = undefined;
    }
    const isDev = typeof __DEV__ === 'undefined' ? true : __DEV__;
    cached = resolveAppEnv(generated, local, isDev);
  }
  return cached;
}
