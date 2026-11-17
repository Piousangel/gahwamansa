// 소셜 로그인 공개 값(앱에 들어가도 되는 값). 비밀값(카카오·구글 Client Secret)은 앱에 넣지 않는다(Supabase 쪽에만).
// 출처: TODO.md 28·29번 외부 설정.
export const KAKAO_NATIVE_APP_KEY = '1cd831e4a2589fb6a4f756a6553c0681';
// 구글 "웹" 클라이언트 ID(= GoogleSignin webClientId). ID 토큰의 aud 가 이 값이 되어 Supabase Google provider 와 맞는다.
export const GOOGLE_WEB_CLIENT_ID = '818070207841-o75t4oegtkuoliv37mkf78hb1ivesbbp.apps.googleusercontent.com';
