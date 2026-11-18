# 앱 안 고지 반영 점검 (LG-07, L6, 2026-11-18)

> **법률 자문 아님.** `in-app-notices.md` 1~4절 각 행이 **main `f876ed6`** 앱 코드에 들어갔는지 대조. 방법: 문구 키(`app/src/copy/copy.ko.json`) 존재 + `app/src` 사용처 grep(사실). 실기기 표시 확인은 QA-02에서.
> 판정: **반영**(키+사용처 있음) · **부분** · **미반영**(키만 있거나 없음) · **브랜치**(미병합 브랜치에 있음).

## 1. 첫 실행·가입
| 위치 | 요구 | 문구 키 | main 사용처 | 판정 | 남은 일·담당 |
|---|---|---|---|---|---|
| 첫 화면 | 화면 고지 없음, 라벨 "AI가 만든 그림" | `first.polaroid_a11y` | 첫 화면 | 반영 | — |
| P1 번호 입력 하단 | 동의 한 줄 + [이용약관][개인정보처리방침] 링크 2개(터치 64) | `legal.agree_parent` "연결하면 이용약관과 개인정보 처리방침에 동의하게 돼요" | `ConnectScreen.tsx:43` 글만 | **부분** | 링크 2개 없음 — URL 상수 미정(`appInfo.ts` PRIVACY_URL=null, TERMS_URL 없음). AU-07(L4) 상수 + L2 링크화. 문구는 in-app-notices 원안("…확인한 것으로 봐요")과 다름 → 라이터 확정본 우선, 법률 이견 없음 |
| P1c 링크 확인 화면 | 같은 한 줄(링크로 들어와도 계약 성립 지점) | 같은 키 | 확인 필요 | **불명** | P1c에도 한 줄이 있는지 QA-02 캡처로 확인. 없으면 L2 |
| C0 로그인 하단 | 동의 한 줄 + 만 14세 이용 대상 + 링크 2개 | `legal.agree_child`, `legal.age_notice` | main 사용처 0 | **브랜치** | `child-ux2`의 ChildLogin에 있음(미병합). 병합 후 링크 2개 여부 재확인(L3) |
| P2 동의 화면 | 기존 고지 + 하단 [개인정보처리방침] 링크 | `consent.*` | `ConsentScreen.tsx` 본문 있음, 링크 없음 | **부분** | 방침 링크 1개 추가(L2, URL은 AU-07) |
| N1 알림 안내 | "안 받으셔도 앱은 그대로 써요", 시스템 창은 안내 뒤에만 | `push.permission.optional` | 사용처 0 | **미반영** | AU-04(L4) 미착수/진행. 구현 시 순서(안내 → 시스템 창) 확인 |

## 2. 사용 중
| 위치 | 요구 | 문구 키 | main 사용처 | 판정 | 남은 일 |
|---|---|---|---|---|---|
| 코스 사진(PhotoStep) | "AI가 만든 그림 · 실제 장소가 아니에요" 늘 보이게 | `app.ai_photo_label` + `not_real_place` | `PhotoStep.tsx:126` — **`showImage`일 때만** | 반영(조건 확인) | 사진이 숨는 조건(작은 화면·큰 글자)에서는 사진도 없으니 문제 없음(추정). QA-02에서 150·200% 확인 |
| 사진 크게 보기(B1) | 같은 고지 | `photo.zoom_a11y` 등 + `PhotoZoom.tsx` ai_photo_label | 반영 | 반영 | — |
| 지난 날(P15)·자판 화면 사진 | 사진이 보이면 같은 고지 | ai_photo_label | `HistoryDayScreen`·`KeyboardStep` | 반영 | 화면 표시 위치 QA-02 |
| 자녀 대기 화면 사진 | 같은 고지 | ai_photo_label | `ChildWaitScreen` | 반영 | — |
| BGM 첫 권유(P7) | "AI(Google Lyria)가 만든 연주곡이에요" | `bgm.offer_source` | 사용처 0 | **미반영** | AP-04(L2) BGM 구현 때 |
| C6 곧 유료 시트 | "지금은 결제되지 않아요. 관심만 표시돼요", "예정 가격" | `paid.notice`·`paid.toast` | main 사용처 0 | **미반영** | AC-01(L3). 브랜치 상태 확인 필요 |
| 약관·방침 변경 배너 | 빌드 1은 자리만 | — | — | 해당 없음(빌드 1) | 첫 변경 때 |

## 3. 설정 "앱 정보"
| 순 | 요구 | 부모님 P13(`ParentSettings.tsx`) | 자녀 C7(`ChildAppInfo.tsx`·`ChildSettings.tsx`) | 남은 일 |
|---|---|---|---|---|
| 1 | 이용약관 | **미반영**(`app_info.terms` 키만) | **미반영**(행 없음) | AU-07 TERMS_URL + AP-06·L3 |
| 2 | 개인정보처리방침 | **미반영** | 행 있음, URL null이라 **숨김** | US-03·AU-07 |
| 3 | 오픈소스 라이선스 | **미반영** | 키 있음, `OSS_LICENSES_READY=false`라 숨김 | AU-06 |
| 4 | AI 안내(사진, 부모님은 음악 포함) | **부분**(정정 11-18: `ParentSettings.tsx:123` "앱 정보" 행 보조 글로 `settings.ai_notice` 사진 고지 있음 — 처음 grep이 `t.` 별칭을 놓침. 음악 고지 `app_info.ai_music`은 BGM과 함께) | 반영(`child.app_info.ai_*`) | AP-06 P13 v2(음악 줄) |
| 5 | "병원 앱 아님·안부/안전 확인 아님" | **미반영**(`app_info.not_medical` 사용처 0) | 반영(`child.settings.not_safety`) — 단 "병원 앱 아님" 부분 없음 | AP-06, C7은 라이터 판단(약관 제13조 문구와 맞춤) |
| 6 | 사업자 정보 | **미반영**(`app_info.business_*` 키만) | **미반영** | US-04 값 → AU-07 상수 한 곳 → 두 화면 |
| 7 | 문의하기 | **미반영** | 행 있음, CONTACT_EMAIL null이라 숨김 | US-04 |
| 8 | 앱 버전 | 반영(`settings.version`, APP_VERSION 하드코딩 '1.0.0') | 반영 | AU-07 네이티브 versionName·versionCode로 |
| 그 외 | 알림 끄기 토글 | **미반영**(서버 `set_push_enabled` 있음, 앱 토글 없음) | **미반영** | AU-04·AP-06 |
| 그 외 | 도장 소리 토글·배경 음악 토글 | 도장 소리 키(`settings.sfx`) 있음 — 사용처는 AP-06에서 확인 | — | AP-06 |
| 그 외 | 그만 보여 주기·모두 지우기/내 계정 지우기 | 반영 | 반영 | — |

## 4. 앱 밖
| 위치 | 상태 |
|---|---|
| Play 등록정보(방침·삭제 URL, AI·의료기기 아님 줄) | 문구 초안 있음(store §3), URL 미정(US-03) |
| 웹 3페이지 서로 링크·시행일·운영자 정보 | 게시본 초안 완료(`publish-drafts/`), 게시는 P1~P16 조건 뒤 |
| 카카오·구글 콘솔 방침 URL | US-22, URL 미정 |

## 5. 요약
- 사진 AI 고지·자녀 설정 일부·삭제 경로는 반영, 약관·방침 링크·부모님 설정 앱 정보·N1·C6·BGM은 미반영(C0는 브랜치, P1c는 불명). 미반영 대부분은 **URL·사업자 값(US-03·04) → AU-07 상수 → AP-06 P13 v2·L3 C7** 한 줄로 풀린다.
- G-INT 조건(13 §1.1 법률 칸 "in-app-notices 전 행 반영")을 막는 핵심: ① 약관·방침 링크(P1·C0·P2·설정) ② 부모님 설정 AI·병원 아님·사업자 정보 ③ N1 거부 고지 ④ C6 결제 안 됨 고지.
- 리드 제안: AU-07을 W2 앞쪽으로 당기고, 값이 없을 때 행을 숨기는 지금 방식(자리표시 금지)은 유지하되 **G-INT 전 release-gates에 "앱 정보 행 숨김 0" 확인을 추가**.
- 재점검: AP-06·AU-04·AU-07·AC-01·child-ux2 병합 뒤 이 표를 다시 돈다(L6).
