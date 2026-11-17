// 소셜 로그인 공개 값(앱에 들어가도 되는 값). 비밀값(카카오·구글 Client Secret)은 앱에 넣지 않는다(Supabase 쪽에만).
// 값의 원본은 환경별 app/env/<flavor>.env(빌드가 env.generated.ts 로 넣음). 안드로이드 카카오 scheme 도 같은 파일에서 만든다.
import {getAppEnv} from './env';

const env = getAppEnv();
// 카카오 네이티브 앱 키(같은 앱 1653853). staging 전용 키는 추가 예정 — 지금은 두 환경이 같은 값.
export const KAKAO_NATIVE_APP_KEY = env.KAKAO_NATIVE_APP_KEY;
// 구글 "웹" 클라이언트 ID(= GoogleSignin webClientId). ID 토큰의 aud 가 이 값이 되어 그 환경 Supabase Google provider 와 맞는다.
export const GOOGLE_WEB_CLIENT_ID = env.GOOGLE_WEB_CLIENT_ID;
