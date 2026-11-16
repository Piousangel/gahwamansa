// 복사해서 config.local.ts 로 만들고 값을 채운다 (config.local.ts 는 gitignore).
// URL: 에뮬레이터 http://10.0.2.2:54321, 실기기 http://<맥 LAN IP>:54321
// KEY: `npx supabase status -o env` 의 PUBLISHABLE_KEY (또는 ANON_KEY)
export default {
  SUPABASE_URL: '',
  SUPABASE_KEY: '',
};
