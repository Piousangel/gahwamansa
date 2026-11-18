# r1 앱 엔지니어 — 기기 저장·전송 구간 (2026-11-19)

> 독립 의견. app/src, android/app/src/main, RN gradle plugin 코드를 직접 읽음.

## 1. 기기에 저장하는 것 (전수)
| 키·저장소 | 내용 | 저장 위치 | 지우는 때 | 민감도 |
|---|---|---|---|---|
| Supabase 세션(`sb-<ref>-auth-token`) | access·refresh 토큰 | AsyncStorage(앱 전용 SQLite, 평문) | 로그아웃·삭제 | **높음** — 부모님(익명)은 이 토큰이 유일한 신원. 잃으면 연결이 끊김 |
| `push_token_v1` | 이 기기 FCM 토큰 | AsyncStorage | 로그아웃 | 낮음(기기 식별자) |
| `seen_parent_ids_v1:<tag>` 등 계정별 기억값 4종 | 본 어르신 id, 관심 표시, 알림 답 | AsyncStorage, 키에 accountTag(sha256(uid) 앞 16자) | 로그아웃·삭제 | 낮음 |
| 미연결 도장 | 이번 주 완료 날짜 | AsyncStorage | 7일·연결 시 | 낮음 |
| 초대 번호 | 6자리+만료 시각 | SharedPreferences(MODE_PRIVATE, InviteModule) | 7일·사용 즉시 | 중간(짧은 수명) |
| 처리한 링크 | 원문 대신 해시 | SharedPreferences | — | 낮음 |
| 개발자 메뉴 세션(staging·local만) | 역할별 토큰 쌍 | AsyncStorage | 7일·로그아웃 | 높음이지만 production 번들에 없음(release-gates A8) |

## 2. 판단
- 사용자 기기 저장은 제7조⑤(취급자 기기)의 대상이 아니라 **법적 의무 없음**(법률 위원 확인 필요).
- 보호 수단: Android 샌드박스(다른 앱 접근 불가) + Android 10+ 기기의 파일 기반 암호화(잠금 해제 전 읽기 불가) + allowBackup=false(클라우드 백업 제외).
- **구멍 1개**: Android 공식 문서 — targetSdk 31 이상 앱은 일부 제조사 기기에서 allowBackup=false가 **기기 간 이전(D2D)을 막지 않는다**. 우리 targetSdk 36. 삼성 스마트 스위치 같은 이전에서 세션·초대 번호가 새 폰으로 갈 수 있다. 방침·데이터 보안 양식은 "기기 밖으로 안 나감"이라고 쓰고 있다.
  - 조치(빌드 1): `res/xml/data_extraction_rules.xml`(cloud-backup·device-transfer 모두 root·file·database·sharedpref·external·device_* 제외) + `android:dataExtractionRules` 지정. Android 11 이하는 allowBackup=false로 충분. 1~1.5h + 실기기 이전 확인은 QA(가능한 기기 있을 때).
  - 부작용: 폰을 바꾸면 부모님 연결이 끊김 — 이건 원래 설계(재연결 번호, DECISIONS 11-16 약점)와 같다. 오히려 refresh token이 두 폰에 복제돼 회전 충돌로 한쪽이 끊기는 이상 동작을 없앤다.
- 세션 토큰 암호화 저장(Keystore 래핑):
  - androidx.security-crypto(EncryptedSharedPreferences)는 **폐기됨**(2025, 1.1.0 계열 — 2차 자료, 공식 릴리스 노트 대조 전). 11-18 개발자 메뉴 결정에서 이 의존성을 안 넣은 것이 결과적으로 맞았다.
  - 대안은 react-native-keychain(Keystore) 또는 Tink+DataStore 자체 모듈. **위험**: Keystore 키가 화면 잠금 변경·제조사 버그로 무효화되면 부모님의 유일한 신원(익명 세션)을 잃는다 → 어르신이 이유도 모른 채 연결이 끊김. 이득(루팅 기기 방어)에 비해 손해가 크다.
  - 내 권고: **빌드 1 안 함**, 빌드 2에서 키 무효화 시 평문 폴백·실기기 매트릭스 조사 후 재판단(3~5h).
- accountTag는 솔트 없는 해시라 기기 밖으로 보내지 않는다는 기존 규칙(재검토 R3) 유지.

## 3. 전송 구간(TLS)
- release 빌드: RN gradle plugin이 `usesCleartextTraffic=false`(AgpConfiguratorUtils), debug만 true(Metro). flavor·buildType 조합 staging**Release**도 false인지 병합 매니페스트로 확인 1줄(release-gates에 추가).
- 앱이 부르는 곳: `https://<ref>.supabase.co`(env), Firebase·카카오·구글 SDK(HTTPS). 이용약관 WebView는 https 주소만(AU-07 상수).
- 인증서 고정(pinning): 하지 않는다. Supabase·Cloudflare 인증서 교체 시 앱이 통째로 멈출 위험이 이득보다 큼. 토스 mTLS는 토스 트랙에서 별도.
- 로그: `console.warn`은 reason 코드만, 토큰·번호·uid 출력 없음(grep). release에서도 logcat으로 나가므로 이 규칙을 lint로 고정하는 것은 빌드 2.

## 내가 틀릴 수 있는 이유
- "일부 제조사"가 어디인지 문서가 말하지 않는다. 대상 기기에서 실제로 D2D가 되는지 확인 못 했다.
- Keystore 무효화 빈도를 과대평가했을 수 있다(최근 기기는 안정적이라는 보고도 있음).
