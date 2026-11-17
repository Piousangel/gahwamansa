# DZ-05 시안 문서 잔여 일괄 — 감사 체크표 (L5 디자인, 2026-11-18)

- 로드맵 13 §2.5 DZ-05 항목을 출처 리뷰 번호로 풀어서 하나씩 확인했다.
- 판정 표기
  - ✓고침: 이번에 시안·문서를 고침
  - ✓해소: 이미 다른 작업·결정으로 해결됨
  - →이관: 다른 레인이나 결정이 필요함
- 번호 해석: 로드맵의 `V·R2·U` 번호가 원 리뷰 번호와 1:1이 아니어서, 원 리뷰의 남은 항목 전체를 대상으로 삼았다. 아래 "출처"가 원 리뷰 위치다.

## 1. v15 리뷰 잔여(reviews/2026-11-17-design-v15-review, v16 재검토의 '남은 것')
| 출처 | 내용 | 판정 | 근거·파일 |
|---|---|---|---|
| v16 P6 | 시트 노트에 '잘 쓰셨어요'가 남음 | ✓고침 | P6_keyboard 노트·보드 이름 → 완료 문장 '낱말을 다 쓰셨어요'(10절) |
| v16 P5 | 저장 실패 보드의 '봄'이 선택됨 모양과 다름 | ✓고침 | P5_question 저장 실패 보드의 카드를 선택됨 카드(면 #EFE0CF + 체크 + '골랐어요')로 교체. QA 45/0 |
| v15 낮음 | inkSub(#85592F)가 20 미만(P6 'AI가 만든 그림'·C3 단계 설명·C5 날짜) | ✓고침(생성 시트) | 생성기 `kit.f()`의 하한을 20으로 올리고 생성 시트 전부를 다시 만듦(DZ-04 #5와 같은 규칙). 정적 옛 시트(P0~P10·S1·S2·P14·flows)의 13~16px는 시트 머리말·보드 이름(화면 밖 장식)이라 대상 아님 |
| v15 낮음 | 오프라인 개별 보드 없음 → 'S1 따름' 한 줄 | ✓해소 | P13_more·C5·C3 노트에 'S1 따름'. 새 시트(P16·C4_title_dup·N3·P15·P5_P6_review)도 S1 전역 처리 |
| v16 리드 몫 | '‹ 이전' 예외 목록(첫 화면·N1·C3·C4·C5)을 DECISIONS에 | →이관(리드) | DECISIONS 한 줄 |
| v16 리드 몫 | C7 연결 뒤 자녀 알림 정의 | →이관(PM) | N3 연결 성공 알림으로 정의됨. C7 '알림' 행은 N3·P14 자녀 알림 켜기/끄기로 제안(UX U11) |

## 2. UX r2(reviews/2026-11-17-design-v3-ux-r2) 남은 항목
| 출처 | 내용 | 판정 | 근거 |
|---|---|---|---|
| ①4 | C3 '연결됐어요' 직후 동의 거부로 빈 앨범 | ✓해소 | copy 6절 C3 connect_done "고른 답을 보여 줄지는 {호칭}께서 정해요"(기대 맞추기) |
| ①6 | 첫 화면 앱 소개 | ✓해소 | FS_final D안(사진·질문·낱말 소개 3줄) |
| ①11 | 응원 압박·재촉 | ✓해소 | 확정 4문장, 하루 한도·응원 취소(DECISIONS 11-18, copy 11-9) |
| ①12 | 오래된 날짜 = 안부 신호 | →이관(사용자 확인) | QA-12 관찰 항목. 문구로는 풀지 않음(의도) |
| ①13 | 150% 누락(C0·C1·C3·C5~C9) | 일부 ✓ | C0·C3·C5·C7 v2·C4 계열은 150% 보드 있음.<br>**남음: C1·C6·C8·C9**(옛 정적 시트) → DZ-01 실기기 캡처 150%로 대체 판정(시안 재작성보다 싸다) |
| ①14 | 재설치 어르신 '이미 쓴 번호' | →이관(서버·PM) | P1c used 안내 '가족에게 새 번호를 받아 주세요'. 같은 기기 복원은 서버 정책 미정 |
| ①15 | 마지막 자녀 삭제 시 어르신은 이유를 모름 | →이관(정책·법률 LQ) | 띠 '번호를 받으면 그때부터 답이 저장돼요'로만 알림. 대리 동의 질문 목록에 있음 |
| ②2 | P13 버튼 위계 | ✓해소 | P13 행 목록 + 위험 행 맨 아래(U8, p7-followup-ux) |
| ②3 | 동의 거부 사실 불일치(P5 '대신') | ✓해소 | 동의 거부 띠 문구 통일(course.declined_banner), P5 거부 보드는 띠만 |
| ②4 | P14 어르신 본문 저장 여부 | ✓해소 | P14 별도 화면 대신 코스 홈 띠 유지(로드맵 D-02, AP-16) |
| ②5 | 서비스명 '부모와 자식' | ✓해소 | 시안 0건(grep) |
| ②6 | C6 '소식 받기' 뒤 피드백 | →이관(AC-01) | AC-01 명세에 '뒤 토스트' 포함 |
| ②7 | 미연결 도장 | ✓해소 | DECISIONS 11-17 기기 로컬, main 반영 |
| ③ | C2_codes 보관 이동 | →이관(리드) | 캔버스에서 보관 구역으로 옮기기는 아티팩트 게시가 필요해 보류(사용자 지시: 새로 게시 안 함). flows 문구는 그대로 |
| ③ | P9 '되돌릴 수 없어요' 반복 | ✓해소 | P9 시트 1회(grep) |

## 3. UX 1차(reviews/2026-11-17-design-v3-ux) 남은 항목
| 출처 | 내용 | 판정 | 근거 |
|---|---|---|---|
| §1-15 | 마지막 자녀 삭제 → 어르신 | →이관 | 위 ①15와 같음 |
| §1-16 | 호칭 '다른 호칭 선택'·부모님 두 분 | ✓해소 | C1 닫힌 목록 7개 + '부모님' 기본, 두 분은 C4_title_dup(호칭 겹침) |
| §1-17 | 토스트 호칭 변수 일부만 | ✓해소 | 토스트 문구에서 호칭 빼기(11-8 '부르는 이름을 바꿨어요', 응원 토스트 확정문) |
| §2 상태 | P5/P6 중단 뒤 재개, 코드 만료 임박 | 일부 →이관 | 재개는 코스 홈이 '지금 할 차례'로 받음(✓). 만료 임박 알림은 빌드 1 범위 밖(PM) |
| §2 접근성 | 스크롤 단서·대비 | ✓해소 | 본문 페이드(Screen), 토큰 대비표(tokens-v3 contrast), 5폭 × 3배율 QA |

## 4. 문서·매니페스트
| 항목 | 판정 | 파일 |
|---|---|---|
| talkback-spec R11 "완료 문장" | ✓해소(11-17) | a11y/talkback-spec.md |
| talkback-spec 칸별 라벨 표 | ✓고침 | a11y/talkback-spec.md §5-1(P1·P1c·C0 묶음 라벨 확정 키·낱칸 탐색 라벨) |
| `_manifest/*.json` | ✓고침 | _manifest/brand.json: BR_symbol·BR_staging·BR_symbol_retired 추가, 해님 시트에 볼터치 제거 표기 |
| 브랜드 README 3D | ✓고침 | design-system/assets/brand/README.md '앱 반영 시': flat 교체 지시 → 앱 안 전부 3D 상세판(반영 완료) |
| assets-manifest 낡은 서술 | ✓고침 | docs/team/assets-manifest.md §2: '활짝(칭찬)·연속 접속 도장' → 표정 3종·볼터치 없음·말 세 순간·이번 주 도장 |
| 인사·상태 줄 높이 | ✓판정 | w0-design: 인사 34·상태 28(코드와 같음), 날짜 700, '다시 보기' 64 + 아이콘 |

## 커밋 대상 파일
- 이 문서
  - docs/design/v3/_qa/2026-11-18-dz05-checklist.md
- 접근성·목록·문서
  - docs/design/v3/a11y/talkback-spec.md
  - docs/design/v3/_manifest/brand.json
  - design-system/assets/brand/README.md
  - docs/team/assets-manifest.md
- 화면(정적)
  - docs/design/v3/screens/parent/P5_question.dc.html
- 생성 시트 전부(글자 하한 20 재생성)
  - docs/design/v3/screens/child/C0_login.dc.html
  - docs/design/v3/screens/child/C3_wait.dc.html
  - docs/design/v3/screens/child/C5_history.dc.html
  - docs/design/v3/screens/child/C7_settings_v2.dc.html
  - docs/design/v3/screens/child/C4_starter.dc.html
  - docs/design/v3/screens/child/C2_share.dc.html
  - docs/design/v3/screens/child/C4_cheer_fail.dc.html
  - docs/design/v3/screens/child/C4_title_dup.dc.html
  - docs/design/v3/screens/common/N1_push.dc.html
  - docs/design/v3/screens/common/N3_connected.dc.html
  - docs/design/v3/brand/BR_staging.dc.html
  - docs/design/v3/screens/parent/P3_course_home_v4.dc.html
  - docs/design/v3/screens/parent/P1_connect_v4.dc.html
  - docs/design/v3/screens/parent/P1c_confirm.dc.html
  - docs/design/v3/web/C_page.dc.html
  - docs/design/v3/first-screen/FS_link.dc.html
  - docs/design/v3/screens/parent/P7_motion.dc.html
  - docs/design/v3/screens/parent/P5_P6_review.dc.html
  - docs/design/v3/screens/parent/P15_history.dc.html
  - docs/design/v3/screens/parent/P16_family.dc.html
  - docs/design/v3/screens/parent/P6_keyboard.dc.html
  - docs/design/v3/screens/parent/PX_read_aloud.dc.html
  - docs/design/v3/screens/parent/PX_music.dc.html
  - docs/design/v3/screens/parent/P13_more.dc.html
  - docs/design/v3/screens/parent/P4_zoom_review.dc.html
  - docs/design/v3/screens/parent/P4_zoom_landscape.dc.html
