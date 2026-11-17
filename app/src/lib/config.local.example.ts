// 로컬 개발용. 복사해서 config.local.ts 로 만들고 필요한 값만 채운다(config.local.ts 는 gitignore).
// 개발 빌드(__DEV__)에서만 적용되고 release(staging·production) 빌드에는 적용되지 않는다.
// 스테이징 서버로 개발하려면 이 파일을 지우고 `npm run android:staging` 으로 실행한다(docs/team/RELEASE.md).
//
// API_MODE: 'fake' = 서버 없이 화면 개발, 'real' = 아래 Supabase 에 연결
// SUPABASE_URL: 에뮬레이터 http://10.0.2.2:54321, 실기기 http://<맥 LAN IP>:54321
// SUPABASE_KEY: `npx supabase status -o env` 의 PUBLISHABLE_KEY (또는 ANON_KEY)
import type {AppEnv} from './env';

const local: Partial<AppEnv> = {
  API_MODE: 'real',
  SUPABASE_URL: '',
  SUPABASE_KEY: '',
};
export default local;
