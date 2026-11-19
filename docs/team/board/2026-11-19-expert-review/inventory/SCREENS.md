# 화면 전수 목록 (전문가 리뷰 0a, 2026-11-19)

리뷰 패널이 보는 **현재 앱 화면·상태 목록**과 캡처, 그리고 짝이 되는 시안 렌더의 색인이다. 출처는 앱 코드(`app/src/app/*Stack.tsx`·`features/**`·`copy.ko.json`)이고 ID는 `docs/design/SCREENS.md`·`docs/design/V4-INDEX.md` 체계를 따른다. 기준 커밋은 main `6aa07a9`이다(캡처 빌드도 이 커밋). 그 뒤 main 에 들어온 화면 변경(예: PR #102 C4 홈 v4 부품)은 이 캡처에 없다 — 해당 화면은 재캡처가 필요하다.

## 폴더
| 폴더 | 내용 |
|---|---|
| `app/` | 현재 앱 캡처 `<id>-<상태>-<배율>[-411].png`. 상태바는 잘라냈다(위 24dp). 배율 100 = 시스템 글자 1.0, 200 = 2.0 |
| `a11y/` | 같은 이름의 접근성 트리 `.txt`(uiautomator dump 변환). 줄마다 `[누름/초점/글자] 폭×높이dp @(x,y) 라벨="…" 글자="…"` |
| `design/` | v4 시안 보드 PNG(`<시안 파일>-<보드 번호>.png`), `boards.json` = 보드 제목·크기 |
| `design/v3/` | v4 시안이 없는 화면의 v3 시안 보드(토큰만 v4로 바뀌는 화면의 비교 기준) |

## 캡처 방법과 한계
- **기기**: 에뮬레이터 `gahwa_review`(Android 15, google_apis arm64, 720×1280 @320dpi = **360×640dp**, 제스처 내비). 411×914dp는 같은 AVD에 `wm size 822x1828`(파일 끝 `-411`). 실기기(S25)·다른 레인 에뮬레이터는 쓰지 않았다.
- **두 빌드**
  - `stg-` 접두 상태 = **staging release**(`scripts/build-staging.sh`, 실제 staging 서버). 실서버 사진·문구가 그대로 나온다. 로그인·번호가 필요 없는 경로만: FS, P1(맞지 않음 포함), 미연결 코스 P3~P7, P13 미연결, C0-a·b.
  - 접두 없음 = **stagingDebug + fake API**(`config.local.ts` 기본값 fake, Metro 8093). 연결·자녀·오류 패널 상태를 서버 없이 재현한다. fake 사진은 늘 '준비 중' 칸이라 사진 모습은 `stg-` 캡처를 본다.
  - staging release에서 자녀 쪽은 소셜 로그인(카카오·구글) 실계정이 있어야 해서 쓰지 않았다(테스트 가족 '만들기'는 release에서 자녀 세션이 먼저 필요). 이메일 인증번호도 실제 메일이 가므로 보내지 않았다.
- **자판**: 에뮬레이터 Gboard 영문 자판이다(한국어 자판 아님). P6 한글 일치 상태는 adb로 한글을 넣을 수 없어 캡처하지 못했다(아래 '막힌 상태').
- **스크롤**: 첫 화면 밖 내용은 `-scrolled` 캡처로. 접근성 트리의 '작음(<48dp)' 표시는 스크롤 영역에 잘려 일부만 보이는 요소도 포함한다(실제 크기는 스크롤 전 캡처의 같은 요소로 확인).
- 상태바는 데모 모드(9:00, 알림 아이콘 숨김)로 찍은 뒤 위 24dp를 잘라 냈다. 개인 알림 아이콘은 없다. **접근성 트리 좌표(@(x,y))는 자르기 전 화면 기준**이라 y에서 24를 빼면 캡처 위치다.
- 캡처는 2026-11-19 밤~11-20 새벽에 걸쳐 찍었다. staging 콘텐츠는 날짜가 바뀌어 411×914 회차는 다른 날 사진·질문(라디오가 있던 방)이 나온다. fake 콘텐츠는 1일차(마을 입구 나무·봄/가을·'나무').
- 411×914 회차는 staging release 의 FS·P1·미연결 P3(0/3·1/3)·P4·P5·C0 만 남겼다(나머지는 자동 탭이 어긋나 지움).
- 같은 이름에 `-scrolled`가 없으면 첫 화면(스크롤 전), `-scrolledN`은 아래로 N번째 화면이다. 내용이 스크롤 전과 같은 캡처는 지웠다.
- 자동 캡처 뒤 이름과 접근성 트리 글자를 대조해 어긋난 캡처를 지웠다(예: P5 캡처에 '2 / 3'이 없으면 삭제).

## v4 이전 여부 표기
- **v4 시안**: V4-INDEX '시안 있음, 빌드 1' 화면(시안 파일이 v4·ds4).
- **v4 토큰만**: 시안은 v3이고 v4 값은 토큰으로만 반영(V4-INDEX '시안 없음, 토큰 효과만').
- **시안 없음**: 그린 적 없는 화면.

## 1. 어르신(P)
| id | 이름 | 진입 경로 | 상태 변형(코드 분기) | v4 | 대응 시안 |
|---|---|---|---|---|---|
| P0 | 시작(스플래시 이어받기·대기) | 앱 실행 | 대기 심볼(2초 넘으면 '잠시만요'), 첫 화면으로 날아가기(full·reduce·none), 시작 복원 실패 오프라인 화면 | 토큰만 | `docs/design/v3/screens/parent/P0_start.dc.html` → `design/v3/P0_start-page.png`, 스플래시 `v3/splash/SPL_*.dc.html` |
| FS | 역할 고르기 | 앱 실행 직후(미연결) | 기본, 번호 띠 '가족이 보낸 번호가 있어요'(App Link·설치 경로), 글자 130%↑ 사진 숨김·150%↑ 기능 줄 숨김, 높이 부족 시 기능 줄 하나씩 숨김·전체 스크롤, 등장 모션 1회 | v4 시안 | `parent/FS_P1_ds4.dc.html` → `design/FS_P1_ds4-01~04.png` |
| P1 | 번호 쓰기 | FS '부모님 휴대폰이에요' / P3 띠 '번호 쓰기' / P13·P16 '번호 쓰기' | 0~5자리 입력 중, 확인 중, 맞지 않음 줄(숫자 유지), '번호가 없어요' 도움 줄, 공간 단계 0~4(제목 축소·약관 줄 이동·키 64), 실패 패널 8종(used·expired·locked·busy·already_linked·not_parent_device·offline·server) | v4 시안 | `parent/FS_P1_ds4.dc.html` → `design/FS_P1_ds4-05~08.png`, `parent/P1_connect_v4.dc.html` → `design/P1_connect_v4-01~06.png` |
| P1c | 연결 확인 | P1 6자리 맞음(300ms 뒤 자동) | 손 입력 '이 번호가 맞나요?' / 링크 '가족이 보낸 번호예요', 호칭 줄 유무, 연결 중(이전·다른 번호 막힘) | 토큰만 | `parent/P1c_confirm.dc.html` → `design/v3/P1c_confirm-01~11.png` |
| P2 | 공개 동의 | P1c '이 번호로 연결하기' | 기본, 처리 중, 오류 상자, 거부 뒤 안내('괜찮아요. 앱은 그대로 써요'), 이미 동의면 건너뜀 | v4 시안(점) | `parent/P6_P7_N1_P2_ds4b.dc.html` → `design/P6_P7_N1_P2_ds4b-13·14.png` |
| P3 | 오늘의 코스 홈 | P2 이후·P1 '코스 보기'·P7 '알겠어요' | 로딩, 첫 로딩 실패, 콘텐츠 없음, 미연결 띠, 동의 거부 띠('다시 정하기'), 다시 받기 실패 알림, 해님 첫 인사(연결 첫 1회), 0/3·1/3·2/3·3/3(연결·미연결 문구 다름), 이번 주 도장 줄, 음악 켜기/끄기, P8 응원 대화상자 | v4 시안 | `parent/P3_P4_P5_ds4b.dc.html` → `design/P3_P4_P5_ds4b-01~06.png`, `parent/P3_course_home_v4.dc.html` → `design/P3_course_home_v4-01~14.png` |
| P4 | 사진 보기 | P3 '사진 보기' | 사진 있음(힌트 '사진을 누르면 크게 보여요'·AI 표기), 사진 준비 중, 로드 실패, 읽어 주기 재생 중, 기록 실패(StepError), 다시 보기 모드('돌아가기') | v4 시안 | `design/P3_P4_P5_ds4b-07·08.png`, `parent/P4_photo_ds4c.dc.html` → `design/P4_photo_ds4c-01~04.png` |
| P4z | 사진 크게 보기(모달) | P4 사진 누름 | 기본(닫기·캡션·AI 표기), 동작 줄이기면 페이드만 | 토큰만 | `parent/P4_zoom_review.dc.html`·`P4_zoom_landscape.dc.html`(렌더 안 함) |
| P5 | 둘 중 고르기 | P3 '둘 중 고르기' | 선택 전('정했어요' 비활성·이유 줄), A/B 선택('골랐어요'), 이미 고른 답, 질문 없음 폴백, 저장 중·실패, 동의 없음·미연결은 저장 없이, 공간 단계 0~4, 다시 보기 모드 | v4 시안 | `design/P3_P4_P5_ds4b-09·10.png` |
| P6 | 자판으로 쓰기 | P3 '자판으로 쓰기' | 쓰기 전('다 썼어요' 비활성), 자판 열림(위 영역 접힘), 맞은 음절 하늘 칸, 일치(✓·1.5초 뒤 '마칠게요'), 다른 낱말 대화상자('낱말을 한 번 더 볼까요?'), 20초·2회·화면 읽기면 '넘어갈게요' 큰 버튼, 기록 실패, 다시 보기 모드 | v4 시안 | `design/P6_P7_N1_P2_ds4b-01~08.png` |
| P7 | 코스 완료 | P6 끝(3/3) | 도장 연출(full·reduce), 첫 1회 '화면을 누르면 바로 넘어가요', 연결 첫 도장 / 평소 / 미연결 둘째 줄, 도장 응답 늦으면 줄 없음, 음악 권유·미리 듣기 대화상자(첫 완료일 제외) | v4 시안 | `design/P6_P7_N1_P2_ds4b-09·10.png`, `parent/P7_album_ds4.dc.html` → `design/P7_album_ds4-01~04.png` |
| P8 | 응원 도착(대화상자) | 연결된 P3 진입(첫 인사 없는 방문) | 1개, 여러 개('응원이 n개 왔어요'), 읽어 주기 | v4 시안 | `child/C3_C4_P8_ds4.dc.html` → `design/C3_C4_P8_ds4-09·10.png`, 이전 `parent/P8_cheer.dc.html` → `design/v3/P8_cheer-page.png` |
| N1 | 어르신 알림 안내 | 연결·동의·3/3 뒤 P3, 서버 받기 꺼짐 | 기본(예시 카드·'알려 주세요'·'안 받을게요'), 시스템 창 막힘 → '휴대폰 설정 열기' | v4 시안 | `design/P6_P7_N1_P2_ds4b-11·12.png` |
| P13 | 설정(어르신) | P3 '설정' / 거부 띠 '다시 정하기' | 미연결(번호 쓰기만), 연결(보여 주는 중/아닌 중), 그만 보여 주기 확인 펼침·완료 줄, 다시 보여 주기 펼침, 알림 스위치·권한 거부 줄·채널 꺼짐, 배경 음악 행(음원 있을 때), 도장 소리, 약관·방침([설정 필요] 배지), 오픈소스, AI·병원 아님 상자, 사업자 정보, 문의, 버전 줄, 모두 지우기 | 토큰만 | `parent/P13_more.dc.html` → `design/v3/P13_more-01~14.png`, `parent/P13_settings.dc.html` → `design/v3/P13_settings-page.png` |
| P13p | 가족에게 이렇게 보여요 | P13 행 | 보여 주는 중(답 있음·없음), 나누지 않음, 로딩, 실패 Banner | 토큰만 | (P13_more 안) |
| P15 | 지난 날 | 연결된 P3 '지난 날 보기' | 로딩, 오류, 빈('사진을 보면 여기에 모여요'), 목록 | 토큰만 | `parent/P15_history.dc.html` → `design/v3/P15_history-01~08.png` |
| P15d | 지난 날 · 한 날 | P15 카드 | 사진·캡션·AI 표기·고른 답·낱말 | 토큰만 | (P15_history 안) |
| P16 | 연결된 가족 | P13 '연결된 가족' | 로딩, 오류, 빈, 목록, 그만두기 시트(동의 중 두 갈래 / 거부 중 한 갈래), 시트 오류, 완료 Banner | 토큰만 | `parent/P16_family.dc.html` → `design/v3/P16_family-01~07.png` |
| P9 | 모두 지우기 | P13 '모두 지우기' / P16 시트 | 1단계, 2단계 대화상자('정말 모두 지울까요?'), 삭제 중, 실패 | 토큰만 | `parent/P9_delete.dc.html` → `design/v3/P9_delete-page.png` |
| P10 | 모두 지웠어요 | P9 완료 | 기본('처음으로' → P1) | 토큰만 | `parent/P10_deleted.dc.html` → `design/v3/P10_deleted-page.png` |
| P14 | 연결이 끊긴 폰 | (코드에 화면 없음 — `copy.disconnected.parent` 미사용) | — | 시안만 | `common/P14_disconnected.dc.html` → `design/v3/P14_disconnected-page.png` |

## 2. 자녀(C)
| id | 이름 | 진입 경로 | 상태 변형 | v4 | 대응 시안 |
|---|---|---|---|---|---|
| C0a | 로그인 고르기 | FS '자녀 휴대폰이에요' | 기본, 로그인 중, 실패, 오프라인, 부모님 폰 막힘, 키 760↑ '이런 앱이에요' 카드, 200%에서 이메일 링크 본문으로, 출구 '부모님이시면 처음으로'(스크롤 아래) | v4 시안 | `child/C0_login_ds4.dc.html` → `design/C0_login_ds4-01~05.png`, iOS `design/C0_login_ios-01~04.png` |
| C0b | 이메일 | C0a '이메일로 시작하기' | 기본, 자판 열림(위 접힘), 형식 오류, 요청 많음·오프라인·실패, 보내는 중 | v4 시안 | `design/C0_login_ds4-06~09.png` |
| C0c | 인증번호 | C0b '인증번호 받기' | 기본, 자판 열림, 확인 중, 맞지 않음, 시간 지남(10분), 다시 보냄, '다시 받기' 60초 잠금 | v4 시안 | `design/C0_login_ds4-10~13.png` |
| CG | 자녀 시작 결정 / 부모님 폰 막힘 | 자녀 스택 시작·로그인 뒤 | 잠시만요, 오류, '이 폰은 부모님 휴대폰으로 쓰고 있어요' | 시안 없음 | — |
| C1 | 호칭 고르기 | 로그인 뒤 가족 없음 | 기본(부모님), 선택, 처리 중, 실패·오프라인·같은 이름 | 토큰만 | `child/C1_relation.dc.html` → `design/v3/C1_relation-01~05.png` |
| C2 | 번호가 만들어졌어요 | C1 '번호 만들기' / C7 '새 폰 연결 번호' | 기본(7일), 지난 번호 바뀜(renewed) | 토큰만(삭제 후보) | `child/C2_code.dc.html` → `design/v3/C2_code-01~04.png` |
| C3 | 연결 기다리는 중 | C2 '연결 기다리기' | 로딩, 기본(번호 카드·복사), 복사됨 띠, 공유에서 돌아옴, 만료 → 새 번호, 번호 없음, 오류, 알림 꺼짐 '알림 켜기'(카드 안), 연결됨 '앨범으로' | v4 시안 | `child/C3_C4_P8_ds4.dc.html` → `design/C3_C4_P8_ds4-01~06.png` |
| C4 | 앨범(자녀 홈) | 연결 뒤 Gate / C3 '앨범으로' | 로딩, 전체 오류, 받은 뒤 오류 줄, 연결 풀림 상자, 호칭 겹침(칩·시트), 답 있음(오늘·지난 날·이야기 꺼내기), 답 없음(첫날 빈 상태), 나누지 않음, 여러 어르신 | 빈 상태만 v4 시안 | `design/C3_C4_P8_ds4-07·08.png`(첫날 빈), `child/C4_home_states.dc.html` → `design/v3/C4_home_states-01~05.png` |
| C4s | 응원 시트·토스트 | C4 '응원 보내기' | 시트(문장 4개), 보냄 토스트+취소(4~6초), 취소됨, 일부 실패·한도·오류 토스트 | v4 시안 | `child/C4_cheer_sheet_ds4.dc.html` → `design/C4_cheer_sheet_ds4-01~03.png` |
| C5 | 지난 답 | C4 탭 '지난 답' | 로딩, 오류, 빈, 나누지 않음, 목록 + '이야기 주제 추천 · 곧 유료' | 토큰만 | `child/C5_history.dc.html` → `design/v3/C5_history-01~08.png`, `child/C5_report.dc.html` → `design/v3/C5_report-01~05.png` |
| C6 | 곧 유료 시트 | C5 '이야기 주제 추천' | 기본(예정 가격 3종), 관심 남김 | 토큰만 | `child/C6_paid_sheet.dc.html` → `design/v3/C6_paid_sheet-01~03.png` |
| C7 | 설정(자녀) | C3·C4·C5 '설정' | 로딩, 오류, 어르신 구역(부르는 이름 시트·새 폰 연결 번호), 가족 연결 알림 행, 로그인 방식, 로그아웃 대화상자, 내 계정 지우기, 앱 정보 | 토큰만 | `child/C7_settings_v2.dc.html` → `design/v3/C7_settings_v2-01~06.png` |
| C7i | 앱 정보(자녀) | C7 '앱 정보' | 버전 행(staging 7번 → 개발자 메뉴), 방침·문의(값 있을 때), AI 상자 | 토큰만 | (C7_settings_v2 안) |
| C8 | 내 계정 지우기 | C7 '내 계정 지우기' | 범위 조회 중, none·keep·family(강한 경고·'지우기' 입력), 2단계, 실패 | 토큰만 | `child/C8_delete_child.dc.html` → `design/v3/C8_delete_child-01~04.png`, `child/C8_delete_family.dc.html` → `design/v3/C8_delete_family-01~05.png` |
| C9 | 계정 지워짐 | C8 완료 | keep, family | 토큰만 | `child/C9_done.dc.html` → `design/v3/C9_done-01~03.png` |
| N3 | 새 연결 배너 | 자녀 탭 화면 위 | 6초 배너 | 토큰만 | `common/N3_connected.dc.html` → `design/v3/N3_connected-01~05.png` |

## 3. 공통
| id | 이름 | 진입 | 상태 | v4 | 대응 시안 |
|---|---|---|---|---|---|
| WEB | 앱 안 웹(약관·방침) | P13·P1·C0 약관 링크 | 로딩, 오류, 주소 없음 | 시안 없음 | `v3/web/C_page.dc.html`(렌더 안 함) |
| OSS | 오픈소스 라이선스 | P13 '오픈소스 라이선스' | 목록·펼침 | 시안 없음 | — |
| S1 | 공통 오류 | 각 화면 | 오프라인, 서버 오류, 다시 하기 | 토큰만 | `common/S1_error.dc.html` → `design/v3/S1_error-page.png` |
| S2 | 로딩·빈 공통 | 각 화면 | 잠시만요, 빈 상태 | 토큰만 | `design/v3/S2_loading-page.png`, `design/v3/S2_empty-page.png` |
| DEV | 개발자 메뉴 | 버전 줄 7번(staging·개발 빌드) | **리뷰 제외**(참고 캡처 1장만) | — | — |

## 4. 현재 앱 ↔ 시안 짝 (리뷰 패널 바로 보기)
아래 표의 왼쪽 캡처와 오른쪽 시안 보드를 나란히 놓고 본다. 시안 보드 제목은 `design/boards.json`.

<!-- PAIRS -->
| 화면 | 현재 앱 캡처 | 시안 보드 |
|---|---|---|
| FS 번호 띠 없음 | `app/FS-stg-default-100.png`<br>`app/FS-stg-default-200.png` | `design/FS_P1_ds4-01.png` FS 역할 고르기 · 번호 띠 없음 · 360×640 · 100%<br>`design/FS_P1_ds4-02.png` FS 역할 고르기 · 번호 띠 없음 · 320×640 · 글자 200% |
| P1 기본 | `app/P1-stg-idle-100.png`<br>`app/P1-stg-idle-200.png` | `design/FS_P1_ds4-05.png` P1 번호 쓰기 · 손 입력 한 줄·번호 없이 먼저 해 볼게요 · 360×640 · 100%<br>`design/FS_P1_ds4-06.png` P1 번호 쓰기 · 손 입력 한 줄·번호 없이 먼저 해 볼게요 · 320×640 · 글자 200%<br>`design/P1_connect_v4-01.png` P1 · 기본(다음 버튼 없음)<br>`design/P1_connect_v4-06.png` 글자 200% · P1 · 기본(다음 버튼 없음) |
| P1 스크롤 아래 | `app/P1-stg-idle-scrolled-100.png`<br>`app/P1-stg-idle-scrolled-200.png` | `design/FS_P1_ds4-07.png` P1 번호 쓰기 · 글자 200% · 스크롤한 뒤(번호 칸·키 1~9·0 줄, 링크는 더 아래)<br>`design/FS_P1_ds4-08.png` P1 번호 쓰기 · 글자 200% · 맨 아래까지 스크롤(0·지움 줄·링크 두 개) |
| P1 쓰는 중 | `app/P1-stg-partial3-100.png`<br>`app/P1-stg-partial3-200.png` | `design/P1_connect_v4-02.png` P1 · 쓰는 중(3자리) |
| P1 맞지 않음 | `app/P1-invalid-100.png`<br>`app/P1-invalid-200.png`<br>`app/P1-invalid-scrolled-200.png`<br>`app/P1-stg-invalid-100.png`<br>`app/P1-stg-invalid-200.png` | `design/P1_connect_v4-04.png` P1 · 맞지 않음(숫자 유지) |
| P1c 확인 | `app/P1c-confirm-100.png`<br>`app/P1c-confirm-200.png`<br>`app/P1c-confirm-scrolled-100.png`<br>`app/P1c-confirm-scrolled-200.png` | `design/v3/P1c_confirm-01.png` P1c · 링크로 열림(호칭 단서) |
| P2 동의 | `app/P2-consent-100.png`<br>`app/P2-consent-200.png`<br>`app/P2-consent-scrolled-100.png`<br>`app/P2-consent-scrolled-200.png` | `design/P6_P7_N1_P2_ds4b-13.png` P2 동의 · ✓ 대신 점(V4) · 360×640 · 100%<br>`design/P6_P7_N1_P2_ds4b-14.png` P2 동의 · ✓ 대신 점(V4) · 320×640 · 글자 200% |
| P3 첫날 0/3 해님 인사 | `app/P3-linked-first-greeting-100.png`<br>`app/P3-linked-first-greeting-200.png`<br>`app/P3-linked-first-greeting-scrolled-100.png`<br>`app/P3-linked-first-greeting-scrolled-200.png` | `design/P3_P4_P5_ds4b-01.png` P3 첫날 0/3 · 해님 인사 덮개 1개만(list) · 360×640 · 100%<br>`design/P3_P4_P5_ds4b-02.png` P3 첫날 0/3 · 해님 인사 덮개 1개만(list) · 320×640 · 글자 200%<br>`design/P3_course_home_v4-09.png` 연결 첫 진입 · 해님 첫 인사(1회, 72) |
| P3 1/3 | `app/P3-linked-1of3-100.png`<br>`app/P3-linked-1of3-200.png`<br>`app/P3-linked-1of3-scrolled-100.png`<br>`app/P3-stg-unlinked-1of3-100.png`<br>`app/P3-stg-unlinked-1of3-200.png` | `design/P3_P4_P5_ds4b-03.png` P3 1/3 · 눌리는 now 행(›) · 소리 날 때만 음악 끄기 · 360×640 · 100%<br>`design/P3_P4_P5_ds4b-04.png` P3 1/3 · 눌리는 now 행(›) · 소리 날 때만 음악 끄기 · 320×640 · 글자 200%<br>`design/P3_course_home_v4-03.png` 1/3 · 둘 남았어요 |
| P3 2/3 | `app/P3-linked-2of3-100.png`<br>`app/P3-linked-2of3-200.png`<br>`app/P3-linked-2of3-scrolled-100.png`<br>`app/P3-stg-unlinked-2of3-100.png`<br>`app/P3-stg-unlinked-2of3-200.png` | `design/P3_course_home_v4-04.png` 2/3 · 하나 남았어요 |
| P3 3/3(연결·미연결) | `app/P3-linked-3of3-100.png`<br>`app/P3-linked-3of3-200.png`<br>`app/P3-linked-3of3-scrolled-100.png`<br>`app/P3-linked-3of3-scrolled-200.png`<br>`app/P3-stg-unlinked-3of3-100.png`<br>`app/P3-stg-unlinked-3of3-200.png`<br>외 2장 | `design/P3_P4_P5_ds4b-05.png` P3 3/3 완료 · 했어요 ✓(획, 오른쪽, 원·박스 없음) · 360×640 · 100%<br>`design/P3_P4_P5_ds4b-06.png` P3 3/3 완료 · 했어요 ✓(획, 오른쪽, 원·박스 없음) · 320×640 · 글자 200%<br>`design/P3_course_home_v4-05.png` 3/3 · 완료(행 ›, 오늘 코스 다시 보기)<br>`design/P3_course_home_v4-07.png` 미연결 3/3 · 도장은 기기에, 고른 답은 연결 뒤부터(11-7 #18) |
| P3 미연결 띠 | `app/P3-stg-unlinked-0of3-100.png`<br>`app/P3-stg-unlinked-0of3-200.png`<br>`app/P3-stg-unlinked-0of3-scrolled-100.png`<br>`app/P3-stg-unlinked-0of3-scrolled-200.png` | `design/P3_course_home_v4-06.png` 미연결 · 띠 바닥선 정렬 |
| P3 동의 거부 | `app/P3-declined-100.png`<br>`app/P3-declined-200.png` | `design/P3_course_home_v4-08.png` 동의 거부 · 한 줄 |
| P4 사진 보기 | `app/P4-photo-pending-100.png`<br>`app/P4-photo-pending-200.png`<br>`app/P4-photo-pending-scrolled-100.png`<br>`app/P4-stg-photo-100.png`<br>`app/P4-stg-photo-200.png`<br>`app/P4-stg-photo-scrolled-100.png`<br>외 1장 | `design/P3_P4_P5_ds4b-07.png` P4 사진 보기 · 하단 오늘 코스로 삭제(U-8 확정) · 360×640 · 100%<br>`design/P3_P4_P5_ds4b-08.png` P4 사진 보기 · 하단 오늘 코스로 삭제(U-8 확정) · 320×640 · 글자 200%<br>`design/P4_photo_ds4c-01.png` P4 현재 안(#38, 비교) · 360×640 · 100%<br>`design/P4_photo_ds4c-03.png` P4 사진 중심 안 · 360×640 · 100% |
| P5 둘 중 고르기 | `app/P5-selected-100.png`<br>`app/P5-selected-200.png`<br>`app/P5-stg-selected-100.png`<br>`app/P5-stg-selected-200.png`<br>`app/P5-stg-unselected-100.png`<br>`app/P5-stg-unselected-200.png`<br>외 4장 | `design/P3_P4_P5_ds4b-09.png` P5 둘 중 고르기 · 하단 링크 삭제(U-8 확정) · 360×640 · 100%<br>`design/P3_P4_P5_ds4b-10.png` P5 둘 중 고르기 · 하단 링크 삭제(U-8 확정) · 320×640 · 글자 200% |
| P6 닫힘 | `app/P6-before-100.png`<br>`app/P6-before-200.png`<br>`app/P6-stg-before-100.png`<br>`app/P6-stg-before-200.png`<br>`app/P6-stg-before-scrolled-100.png`<br>`app/P6-stg-before-scrolled-200.png` | `design/P6_P7_N1_P2_ds4b-01.png` P6 닫힘(자동 포커스 전, step) · 한 글자라도 쓰면 눌려요 · 360×640 · 100%<br>`design/P6_P7_N1_P2_ds4b-02.png` P6 닫힘(자동 포커스 전, step) · 한 글자라도 쓰면 눌려요 · 320×640 · 글자 200% |
| P6 자판 열림 | `app/P6-keyboard-open-100.png`<br>`app/P6-keyboard-open-200.png`<br>`app/P6-stg-keyboard-open-100.png`<br>`app/P6-stg-keyboard-open-200.png`<br>`app/P6-stg-typed-latin-kb-100.png`<br>`app/P6-stg-typed-latin-kb-200.png` | `design/P6_P7_N1_P2_ds4b-03.png` P6 자판 열림 · 넘어가기 보임 · 360×640 · 100%<br>`design/P6_P7_N1_P2_ds4b-04.png` P6 자판 열림 · 넘어가기 보임 · 320×640 · 글자 200%<br>`design/P6_P7_N1_P2_ds4b-05.png` P6 자판 열림 · 영문 입력 안내 한 줄 · 360×640 · 100% |
| P7 완료 | `app/P7-done-linked-first-100.png`<br>`app/P7-done-linked-first-200.png`<br>`app/P7-done-linked-first-scrolled-100.png`<br>`app/P7-done-linked-first-scrolled-200.png`<br>`app/P7-stamp-motion-linked-100.png`<br>`app/P7-stg-done-unlinked-100.png`<br>외 4장 | `design/P6_P7_N1_P2_ds4b-09.png` P7 첫날 완료 · 건너뛰기 안내·음악 권유 없음(done) · 360×640 · 100%<br>`design/P6_P7_N1_P2_ds4b-10.png` P7 첫날 완료 · 건너뛰기 안내·음악 권유 없음(done) · 320×640 · 글자 200%<br>`design/P7_album_ds4-01.png` P7 첫날 완료 · 360×640 · 100%<br>`design/P7_album_ds4-03.png` P7 평소 완료 · 360×640 · 100% |
| P8 응원 도착 | `app/P8-cheer-one-100.png`<br>`app/P8-cheer-one-200.png` | `design/C3_C4_P8_ds4-09.png` P8 응원 도착 · 첫 단계를 마치고 돌아왔을 때 한 번 · 360×640 · 100%<br>`design/C3_C4_P8_ds4-10.png` P8 응원 도착 · 첫 단계를 마치고 돌아왔을 때 한 번 · 320×640 · 글자 200% |
| P13 설정 | `app/P13-linked-100.png`<br>`app/P13-linked-200.png`<br>`app/P13-linked-scrolled10-200.png`<br>`app/P13-linked-scrolled11-200.png`<br>`app/P13-linked-scrolled12-200.png`<br>`app/P13-linked-scrolled2-100.png`<br>외 28장 | `design/v3/P13_more-01.png` 설정 v2 · 알림·소리·미리보기·앱 정보 행 추가<br>`design/v3/P13_settings-page.png` (보드 구분 없음, 전체 페이지) |
| P15 지난 날 | `app/P15-empty-100.png`<br>`app/P15-empty-200.png` | `design/v3/P15_history-01.png` 지난 날 · 목록(최신이 위, 빈 날 없음) |
| P16 연결된 가족 | `app/P16-list-100.png`<br>`app/P16-list-200.png`<br>`app/P16-stop-sheet-100.png`<br>`app/P16-stop-sheet-200.png` | `design/v3/P16_family-01.png` P16 · 가족 1명 |
| P9 모두 지우기 | `app/P9-confirm2-dialog-100.png`<br>`app/P9-confirm2-dialog-200.png`<br>`app/P9-step1-100.png`<br>`app/P9-step1-200.png` | `design/v3/P9_delete-page.png` (보드 구분 없음, 전체 페이지) |
| P10 | `app/P10-done-100.png`<br>`app/P10-done-200.png` | `design/v3/P10_deleted-page.png` (보드 구분 없음, 전체 페이지) |
| C0-a | `app/C0a-stg-default-100.png`<br>`app/C0a-stg-default-200.png`<br>`app/C0a-stg-scrolled-100.png`<br>`app/C0a-stg-scrolled-200.png`<br>`app/C0a-stg-scrolled2-200.png` | `design/C0_login_ds4-01.png` C0-a 로그인 고르기 · 360×640 · 100% (Dock = 소셜 그룹 + 이메일 링크, 약관은 본문<br>`design/C0_login_ds4-02.png` C0-a 로그인 고르기 · 320×640 · 글자 200% (이메일 링크가 본문 끝으로, Dock = 소셜 <br>`design/C0_login_ds4-03.png` C0-a 로그인 고르기 · 360×820 · 100% (키가 큰 화면에서만 "이렇게 돼요" 카드) |
| C0-b | `app/C0b-stg-default-100.png`<br>`app/C0b-stg-default-200.png` | `design/C0_login_ds4-06.png` C0-b 이메일 · 360×640 · 100%<br>`design/C0_login_ds4-08.png` C0-b 이메일 · 320×640 · 200% |
| C0-b 자판 열림 | `app/C0b-stg-keyboard-open-100.png`<br>`app/C0b-stg-keyboard-open-200.png` | `design/C0_login_ds4-07.png` C0-b 이메일 · 자판 열림 · 360×640 · 100% (위 영역 BackLink 한 줄로 접힘)<br>`design/C0_login_ds4-09.png` C0-b 이메일 · 자판 열림 · 320×640 · 200% (간격 8, 입력 글자 상한 1.5(항상), 칸 |
| C0-c | `app/C0c-keyboard-open-100.png`<br>`app/C0c-keyboard-open-200.png`<br>`app/C0c-wrong-100.png`<br>`app/C0c-wrong-200.png`<br>`app/C0c-wrong-kb-100.png`<br>`app/C0c-wrong-kb-200.png`<br>외 1장 | `design/C0_login_ds4-10.png` C0-c 인증번호 · 360×640 · 100%<br>`design/C0_login_ds4-12.png` C0-c 인증번호 · 320×640 · 200% |
| C1 | `app/C1-relation-100.png`<br>`app/C1-relation-200.png`<br>`app/C1-relation-scrolled-100.png`<br>`app/C1-relation-scrolled-200.png`<br>`app/C1-relation-selected-100.png`<br>`app/C1-relation-selected-200.png` | `design/v3/C1_relation-01.png` 기본 · 호칭 1칸(기본 부모님) |
| C2 | `app/C2-code-100.png`<br>`app/C2-code-200.png`<br>`app/C2-code-scrolled-200.png` | `design/v3/C2_code-01.png` 기본 · 번호 1개 + 보내기 |
| C3 기다리는 중 | `app/C3-after-share-100.png`<br>`app/C3-copied-100.png`<br>`app/C3-waiting-100.png`<br>`app/C3-waiting-200.png`<br>`app/C3-waiting-scrolled2-100.png`<br>`app/C3-waiting-scrolled2-200.png`<br>외 6장 | `design/C3_C4_P8_ds4-01.png` C3 연결 기다리는 중 · 알림 켜기가 번호 카드 안(V9) · 360×640 · 100%<br>`design/C3_C4_P8_ds4-02.png` C3 연결 기다리는 중 · 알림 켜기가 번호 카드 안(V9) · 320×640 · 글자 200% |
| C4 답 있음 | `app/C4-answer-today-100.png`<br>`app/C4-answer-today-200.png`<br>`app/C4-answer-today-scrolled-100.png`<br>`app/C4-answer-today-scrolled-200.png` | `design/v3/C4_home_states-01.png` 로딩 |
| C4 응원 시트 | `app/C4s-cheer-sending-100.png`<br>`app/C4s-cheer-sheet-100.png`<br>`app/C4s-cheer-sheet-200.png`<br>`app/C4s-cheer-toast-200.png`<br>`app/C4s-cheer-toast-declined-100.png` | `design/C4_cheer_sheet_ds4-01.png` C4 응원 시트 · 360×640 · 100% (Choice 1열·같은 면·테두리 line 3:1·사물 아이<br>`design/C4_cheer_sheet_ds4-02.png` C4 응원 시트 · 320×640 · 글자 200% (두 줄 허용, 시트 안에서만 스크롤, 아래 흐림) |
| C5 | `app/C5-declined-100.png`<br>`app/C5-list-100.png`<br>`app/C5-list-200.png` | `design/v3/C5_history-01.png` 기본 · 최근 30일, 최신순(어르신 1명)<br>`design/v3/C5_report-01.png` 기본 · 지난 답 목록 + 곧 유료 |
| C6 | `app/C6-paid-done-100.png`<br>`app/C6-paid-done-200.png`<br>`app/C6-paid-sheet-100.png`<br>`app/C6-paid-sheet-200.png`<br>`app/C6-paid-sheet-scrolled-200.png` | `design/v3/C6_paid_sheet-01.png` 기본 · 예정 가격 3안 + 관심 있어요 |
| C7 | `app/C7-linked-100.png`<br>`app/C7-linked-200.png`<br>`app/C7-linked-scrolled-100.png`<br>`app/C7-linked-scrolled2-200.png`<br>`app/C7-linked-scrolled3-200.png`<br>`app/C7-linked-scrolled4-200.png`<br>외 5장 | `design/v3/C7_settings_v2-01.png` 기본 · 로그아웃·새 폰 연결 번호·앱 정보 추가 |
| C8 | `app/C8-keep-100.png`<br>`app/C8-keep-200.png`<br>`app/C8-step2-100.png` | `design/v3/C8_delete_child-01.png` 기본 |
| C9 | `app/C9-keep-100.png`<br>`app/C9-keep-200.png` | `design/v3/C9_done-01.png` child · 내 계정 |

## 5. 캡처 목록(자동 생성)
<!-- CAPTURES -->
화면 34개(id 기준), 캡처 276장. 파일 이름은 `app/<id>-<칸의 이름>.png`, 접근성 트리는 `a11y/` 같은 이름 `.txt`.

| id | 100% | 200% | 411×914 |
|---|---|---|---|
| FS | stg-default-100 | stg-default-200<br>stg-default-scrolled-200 | stg-default-100-411<br>stg-default-200-411 |
| P1 | fail-busy-100<br>fail-expired-100<br>fail-locked-100<br>fail-not-parent-device-100<br>fail-used-100<br>from-devmenu-linked-100<br>invalid-100<br>stg-idle-100<br>stg-idle-scrolled-100<br>stg-invalid-100<br>stg-no-code-help-100<br>stg-partial3-100 | fail-locked-200<br>fail-used-200<br>invalid-200<br>invalid-scrolled-200<br>stg-idle-200<br>stg-idle-scrolled-200<br>stg-invalid-200<br>stg-no-code-help-200<br>stg-partial3-200 | stg-idle-100-411<br>stg-idle-200-411<br>stg-idle-scrolled-200-411<br>stg-invalid-100-411<br>stg-invalid-200-411<br>stg-no-code-help-100-411<br>stg-no-code-help-200-411<br>stg-partial3-100-411<br>stg-partial3-200-411 |
| P1c | confirm-100<br>confirm-scrolled-100 | confirm-200<br>confirm-scrolled-200 | — |
| P2 | consent-100<br>consent-scrolled-100 | consent-200<br>consent-scrolled-200 | — |
| P3 | declined-100<br>linked-1of3-100<br>linked-1of3-scrolled-100<br>linked-2of3-100<br>linked-2of3-scrolled-100<br>linked-3of3-100<br>linked-3of3-scrolled-100<br>linked-first-greeting-100<br>linked-first-greeting-scrolled-100<br>stg-unlinked-0of3-100<br>stg-unlinked-0of3-scrolled-100<br>stg-unlinked-1of3-100<br>stg-unlinked-2of3-100<br>stg-unlinked-3of3-100<br>stg-unlinked-3of3-scrolled-100 | declined-200<br>linked-1of3-200<br>linked-2of3-200<br>linked-3of3-200<br>linked-3of3-scrolled-200<br>linked-first-greeting-200<br>linked-first-greeting-scrolled-200<br>stg-unlinked-0of3-200<br>stg-unlinked-0of3-scrolled-200<br>stg-unlinked-1of3-200<br>stg-unlinked-2of3-200<br>stg-unlinked-3of3-200<br>stg-unlinked-3of3-scrolled-200 | stg-unlinked-0of3-100-411<br>stg-unlinked-0of3-200-411<br>stg-unlinked-0of3-scrolled-200-411<br>stg-unlinked-1of3-100-411<br>stg-unlinked-1of3-200-411 |
| P4 | photo-pending-100<br>photo-pending-scrolled-100<br>review-mode-100<br>stg-photo-100<br>stg-photo-scrolled-100 | photo-pending-200<br>stg-photo-200<br>stg-photo-scrolled-200 | stg-photo-100-411<br>stg-photo-200-411<br>stg-photo-scrolled-100-411<br>stg-photo-scrolled-200-411 |
| P4z | stg-zoom-100 | stg-zoom-200 | stg-zoom-100-411<br>stg-zoom-200-411 |
| P5 | selected-100<br>stg-selected-100<br>stg-unselected-100<br>stg-unselected-scrolled-100<br>unselected-100 | selected-200<br>stg-selected-200<br>stg-unselected-200<br>stg-unselected-scrolled-200<br>unselected-200 | stg-unselected-100-411<br>stg-unselected-200-411<br>stg-unselected-scrolled-100-411 |
| P6 | before-100<br>keyboard-open-100<br>retry-dialog-100<br>stg-before-100<br>stg-before-scrolled-100<br>stg-keyboard-open-100<br>stg-retry-dialog-100<br>stg-typed-latin-kb-100 | before-200<br>keyboard-open-200<br>retry-dialog-200<br>stg-before-200<br>stg-before-scrolled-200<br>stg-keyboard-open-200<br>stg-retry-dialog-200<br>stg-typed-latin-kb-200 | — |
| P7 | done-linked-first-100<br>done-linked-first-scrolled-100<br>stamp-motion-linked-100<br>stg-done-unlinked-100<br>stg-done-unlinked-scrolled-100<br>stg-stamp-motion-100 | done-linked-first-200<br>done-linked-first-scrolled-200<br>stg-done-unlinked-200<br>stg-stamp-motion-200 | — |
| P8 | cheer-one-100 | cheer-one-200 | — |
| P13 | declined-100<br>linked-100<br>linked-scrolled2-100<br>linked-scrolled3-100<br>linked-scrolled4-100<br>linked-scrolled5-100<br>linked-scrolled6-100<br>linked-scrolled7-100<br>resume-confirm-100<br>stg-unlinked-100<br>stg-unlinked-scrolled2-100<br>stg-unlinked-scrolled3-100<br>stg-unlinked-scrolled4-100<br>stg-unlinked-scrolled5-100<br>stg-unlinked-scrolled6-100<br>stop-sharing-confirm-100<br>stopped-done-100 | declined-200<br>linked-200<br>linked-scrolled10-200<br>linked-scrolled11-200<br>linked-scrolled12-200<br>linked-scrolled2-200<br>linked-scrolled3-200<br>linked-scrolled4-200<br>linked-scrolled5-200<br>linked-scrolled6-200<br>linked-scrolled7-200<br>linked-scrolled8-200<br>linked-scrolled9-200<br>stg-unlinked-200<br>stg-unlinked-scrolled2-200<br>stg-unlinked-scrolled3-200<br>stg-unlinked-scrolled4-200<br>stg-unlinked-scrolled5-200<br>stg-unlinked-scrolled6-200<br>stg-unlinked-scrolled7-200<br>stg-unlinked-scrolled8-200<br>stg-unlinked-scrolled9-200<br>stop-sharing-confirm-200<br>stop-sharing-confirm-scrolled-200<br>stopped-done-200 | — |
| P13p | preview-declined-100<br>preview-with-answer-100<br>preview-with-answer-scrolled-100 | preview-declined-200 | — |
| P15 | empty-100 | empty-200 | — |
| P16 | list-100<br>stop-sheet-100 | list-200<br>stop-sheet-200 | — |
| P9 | confirm2-dialog-100<br>step1-100 | confirm2-dialog-200<br>step1-200 | — |
| P10 | done-100 | done-200 | — |
| C0a | stg-default-100<br>stg-scrolled-100 | stg-default-200<br>stg-scrolled-200<br>stg-scrolled2-200 | stg-default-100-411 |
| C0b | stg-default-100<br>stg-format-error-100<br>stg-format-error-kb-100<br>stg-keyboard-open-100 | stg-default-200<br>stg-format-error-200<br>stg-format-error-kb-200<br>stg-keyboard-open-200 | stg-default-100-411<br>stg-format-error-100-411<br>stg-format-error-kb-100-411<br>stg-keyboard-open-100-411 |
| C0c | keyboard-open-100<br>wrong-100<br>wrong-kb-100 | keyboard-open-200<br>wrong-200<br>wrong-kb-200<br>wrong-scrolled-200 | — |
| C1 | relation-100<br>relation-scrolled-100<br>relation-selected-100 | relation-200<br>relation-scrolled-200<br>relation-selected-200 | — |
| C2 | code-100 | code-200<br>code-scrolled-200 | — |
| C3 | after-share-100<br>copied-100<br>waiting-100<br>waiting-scrolled2-100<br>waiting-scrolled3-100<br>waiting-scrolled4-100 | waiting-200<br>waiting-scrolled2-200<br>waiting-scrolled3-200<br>waiting-scrolled4-200<br>waiting-scrolled5-200<br>waiting-scrolled6-200 | — |
| C4 | answer-today-100<br>answer-today-scrolled-100<br>declined-100 | answer-today-200<br>answer-today-scrolled-200 | — |
| C4s | cheer-sending-100<br>cheer-sheet-100<br>cheer-toast-declined-100 | cheer-sheet-200<br>cheer-toast-200 | — |
| C5 | declined-100<br>list-100 | list-200 | — |
| C6 | paid-done-100<br>paid-sheet-100 | paid-done-200<br>paid-sheet-200<br>paid-sheet-scrolled-200 | — |
| C7 | linked-100<br>linked-scrolled-100<br>logout-dialog-100<br>waiting-100<br>waiting-scrolled-100 | linked-200<br>linked-scrolled2-200<br>linked-scrolled3-200<br>linked-scrolled4-200<br>logout-dialog-200<br>waiting-200 | — |
| C7s | title-sheet-100 | title-sheet-200 | — |
| C7i | app-info-100 | — | — |
| C8 | keep-100<br>step2-100 | keep-200 | — |
| C9 | keep-100 | keep-200 | — |
| OSS | stg-list-100 | — | — |
| DEV | menu-100 | — | — |

## 6. 막힌 상태(캡처 못 함)와 이유
<!-- BLOCKED -->
| 화면 | 상태 | 이유 | 필요한 것 |
|---|---|---|---|
| 약관 동의 | (해당 없음) | 앱에 별도 동의 클릭 화면이 없다. 동의는 P1·C0 '연결하면/로그인하면 … 동의하게 돼요' 줄로 갈음. 동의 클릭이 필요한 단계는 만나지 않았다 | — |
| WEB(이용약관·개인정보 처리방침) | 화면 전체 | staging 빌드는 약관·방침 주소가 비어 '[설정 필요]' 배지만 보이고 눌리지 않는다(P13 캡처에 배지가 찍힘) | staging env 에 TERMS/PRIVACY_URL |
| C0a·C0b·C0c(staging) | 실제 로그인 뒤, 인증번호 화면 | 카카오·구글 실계정이 필요하고, 이메일은 실제 메일이 나간다. fake 빌드로 C0c·C1~C9를 대신 찍었다 | **사용자 필요**: staging 테스트 자녀 계정으로 로그인(사용자 몫) |
| 연결된 어르신(staging) | P3 연결 상태·P15 목록·P15 한 날·실사진 P15 | staging 테스트 가족은 release에서 자녀 세션이 먼저 있어야 만들 수 있다(config.local 테스트 계정은 release 번들에 없음). 연결 상태는 fake로 대신 | **사용자 필요**: 자녀 소셜 로그인 1회 → 개발자 메뉴 '테스트 가족 만들기' |
| P6 | 한글 일치(✓·'마칠게요' 활성), 맞은 음절 하늘 칸 | adb `input text` 는 ASCII 만 넣는다. 에뮬레이터 자판도 영문 Gboard | 한국어 자판 설정 + 손 입력(실기기 권장) |
| P7 | 평소 완료 문구, 음악 권유·미리 듣기 대화상자 | 첫 완료일이 아닌 실제 다음 날짜가 필요(개발자 메뉴 '하루 넘기기'는 날짜를 바꾸지 않음) | 다음 날 같은 기기로 재캡처 |
| N1 | 화면 전체 | fake 는 알림 받기 기본 켜짐이라 뜨지 않고, staging 은 연결이 필요 | 연결된 staging 가족 + 서버 알림 꺼짐 |
| P0 | 대기 2초 '잠시만요', 시작 복원 실패 오프라인 화면 | fake 는 복원이 없고, staging 첫 실행은 바로 FS로 간다 | 느린 망·비행기 모드에서 staging 재캡처 |
| P1 | offline·server 실패 패널 | fake 특수 번호에 없음, 실서버는 정상 | 비행기 모드 staging |
| P2·P3·P4·P5·P6·P9·C3·C4·C5·C7·C8·P15·P16·P13p | 오프라인·서버 오류 상태(오류 상자·StepError·다시 하기) | fake 기본 실패 옵션이 앱에서 켜지지 않음(jest 전용) | 비행기 모드 staging 또는 fake 옵션 노출 |
| P3 | 콘텐츠 없음 | fake empty 옵션 전용 | — |
| P4 | 사진 로드 실패 | fake 는 늘 준비 중, staging 은 정상 | 망 끊고 열기 |
| P5 | 질문 문장 없음 폴백 | 옵션 전용 | — |
| P15 | 목록·한 날(HistoryDay) | fake 지난 날 기본 빈 배열, staging 은 연결 필요 | 연결된 staging 가족 |
| FS | 번호 띠 '가족이 보낸 번호가 있어요' | App Link·설치 경로 번호가 필요(staging 링크 도메인 확인 전) | 카톡 초대 링크로 열기 |
| CG | '이 폰은 부모님 휴대폰으로 쓰고 있어요' | fake 는 역할 전환이 Gate 를 건너뜀 | staging 연결 기기에서 자녀 선택 |
| C0a | 로그인 실패·오프라인·로그인 중 | fake 소셜 로그인은 즉시 성공 | — |
| C2 | 지난 번호 바뀜(renewed) | 지난 번호 만료 상태가 fake에 없음 | — |
| C3 | 만료·번호 없음·연결됨 '앨범으로' | 옵션 전용, 역할 전환은 화면을 처음부터 다시 그림 | 두 기기 실제 연결 |
| C4 | 연결 풀림, 호칭 겹침, 여러 어르신 | fake 어르신은 늘 한 명 | — |
| C8·C9 | none·family(강한 경고·'지우기' 입력) | fake 삭제 범위는 늘 keep | — |
| N3 | 새 연결 배너 | fake 어르신 id 가 늘 같음 | 두 기기 실제 연결 |
| P4z(fake) | 크게 보기 | fake 사진 주소가 준비 중이라 열 수 없음 → staging 캡처 `P4z-stg-*` 로 대신 | — |
| P8 | 응원 여러 개('응원이 n개 왔어요') | 같은 날 두 번째 응원부터 fake 에서 쌓이지 않았다(한 개만 표시) | 두 가족 또는 다음 날 |
| C4s | 한도 토스트·취소됨·일부 실패 | 세 번째 응원도 '보냈어요'로 나와 한도 문구를 못 봤다. 취소는 토스트 4~6초 안 누르기가 캡처 지연으로 어긋남 | 손으로 재현 |
| P13p | 답 있음 200% | 200% 회차는 그만 보여 주기 뒤에 열어 '나누지 않음'만 찍음(100%는 답 있음·나누지 않음 둘 다) | — |
| C7i·C3 복사됨 | 200% | 탭이 어긋나 잘못 찍힌 캡처를 지웠다(100%는 있음) | — |
| P1 fail-* | expired·busy·not_parent_device 200% | 200% 회차는 used·locked 만 찍음(100%는 6종 모두) | — |
| 411×914 | fake 회차 | 411×914 는 staging release 회차(FS·P1·미연결 코스·P13·C0)만 찍었다 | — |

