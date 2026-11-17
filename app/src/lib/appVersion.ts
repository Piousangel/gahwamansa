import {getAppEnv, type AppEnv} from './env';

// 설정 화면 하단에 보여 줄 버전 문자열(화면 연결은 별도 작업).
// production "1.0.0 (132)" / staging "1.0.0 (132) · 테스트 · <서버 ref>" / 로컬 "… · 로컬"
// 버전 규칙: versionName 은 app/package.json 의 version, versionCode 는 git 커밋 수(docs/team/RELEASE.md)
export function versionLabel(
  env: Pick<AppEnv, 'APP_ENV' | 'VERSION_NAME' | 'VERSION_CODE' | 'SUPABASE_PROJECT_REF'> = getAppEnv(),
): string {
  const base = env.VERSION_NAME
    ? env.VERSION_CODE !== null
      ? `${env.VERSION_NAME} (${env.VERSION_CODE})`
      : env.VERSION_NAME
    : '개발 빌드';
  if (env.APP_ENV === 'staging') {
    return [base, '테스트', env.SUPABASE_PROJECT_REF].filter(Boolean).join(' · ');
  }
  if (env.APP_ENV === 'local') {
    return `${base} · 로컬`;
  }
  return base;
}
