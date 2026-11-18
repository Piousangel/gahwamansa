// 앱 정보(설정 고지 행 한 목록, 마스터 계획 '설정' 행). 값이 정해지지 않은 행은 화면에서 숨긴다(자리표시 금지).
// TODO(⑤ 버전 규칙): 네이티브 versionName·versionCode 에서 읽어 "1.0.0 (n)"으로.
export const APP_VERSION = '1.0.0';
// TODO(⑥a 방침 v2 호스팅, 사용자 11/24): 처리방침 URL·문의 이메일이 정해지면 채운다.
export const PRIVACY_URL: string | null = null;
// 이용약관 주소(약관 줄 링크·앱 정보 행). 정해지면 채운다(US-03 도메인·호스팅)
export const TERMS_URL: string | null = null;
export const CONTACT_EMAIL: string | null = null;
// TODO(오픈소스 라이선스 화면): 라이선스 목록 생성 방식이 정해지면 행을 연다.
export const OSS_LICENSES_READY = false;
