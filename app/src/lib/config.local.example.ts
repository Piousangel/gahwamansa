// 로컬 개발용. 복사해서 config.local.ts 로 만들고 필요한 값만 채운다(config.local.ts 는 gitignore).
// 개발 빌드(__DEV__)에서만 적용되고 release(staging·production) 빌드에는 적용되지 않는다.
// 스테이징 서버로 개발하려면 이 파일을 지우고 `npm run android:staging` 으로 실행한다(docs/team/RELEASE.md).
//
// API_MODE: 'fake' = 서버 없이 화면 개발, 'real' = 아래 Supabase 에 연결
// SUPABASE_URL: 에뮬레이터 http://10.0.2.2:54321, 실기기 http://<맥 LAN IP>:54321
// SUPABASE_KEY: `npx supabase status -o env` 의 PUBLISHABLE_KEY (또는 ANON_KEY)
import type {AppEnv} from './env';

// 기본은 fake: 복사만 하고 값을 안 채워도 원격(빌드 값)에 조용히 붙지 않게. 아래 두 값을 채운 뒤 'real' 로 바꾼다
const local: Partial<AppEnv> = {
  API_MODE: 'fake',
  SUPABASE_URL: '',
  SUPABASE_KEY: '',
};
export default local;

// 선택(개발자 메뉴 "테스트 가족 만들기"): 이메일·비밀번호로 로그인할 테스트 자녀 계정. 사용자가 정한 계정만, 이 파일(gitignore)에만 둔다.
// 개발 빌드(__DEV__)에서만 읽는다. release(staging·production) 번들에는 이 파일 자체가 들어가지 않는다(Metro 가 빈 모듈로 바꿈,
// Gradle release 번들 검사가 확인). 테스트 도메인 이메일(@example.test 등)만 받는다. 없으면 보관된 자녀 세션(소셜 로그인 등)을 쓴다.
// export const devTestChild = {email: 'kid@example.test', password: '...'};
