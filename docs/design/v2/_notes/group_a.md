# 그룹 A(어르신 입구) 결과 메모 · 2026-11-17

35개 아트보드: P0 2, P1 14, P2 4, P3 15. manifest: project/_manifest/group_a.json. 렌더링·브라우저 확인은 하지 않았다(폰트 렌더링, 실제 높이 미확인). 그림 자리는 모두 점선 라벨 박스(배경 #FFF59D, tokens.ts placeholder 값). 해님·아이콘을 직접 그리지 않았다.

## 화면별 설계 의도
- P0_loading: 해님 크게 한 장과 "불러오고 있어요"만. 복원 중에 눌러야 할 것이 없다.
- P0_restore_failed: 걱정 해님 + 버튼 1개 "다음"(P1로). 실패를 탓하지 않는 문장.
- P1_default: 빈 칸 6개(첫 칸 주황 테두리), 버튼 "다음" 비활성, "번호가 없어요"는 보조 버튼, 도움말은 이 상태에만.
- P1_typing/complete: 시스템 숫자 키보드 자리(260) 표시. 6자리가 되면 "다음" 활성.
- P1_checking: 버튼 비활성 "확인 중", 로딩 자리.
- P1_error_invalid/used/expired: 칸 테두리 danger + 패널(dangerSoft). 문구는 errors.* 그대로.
- P1_error_already_linked/not_parent_device/offline: 오류가 아닌 안내 성격이라 흰 패널+line 테두리(위험색 안 씀). already_linked는 버튼이 P3로 이동.
- P1_error_server: copy에 서버 오류 문구가 없어 임시 문구 + 라벨.
- P1_locked: 칸 비활성, rate_limited 패널, 남은 시간 4:32(예시 값, 문구·형식 확정 필요).
- P1_busy: busy 패널, 버튼 "다시 하기".
- P1_zoom150: 글자 x1.5(칸 숫자는 40으로 제한). 위쪽 내용 영역은 스크롤, 버튼은 아래 고정. 이 구조를 앱도 따라야 한다.
- P2_default: 상태 전환 동작형(좋아요 → P3, 싫어요 → 거부 안내). 나머지 P2 상태는 낱장.
- P2_processing/failed/declined: 처리 중은 버튼 둘 다 비활성, 실패는 "다시 하기", 거부 후는 declined_notice + declined_detail과 버튼 1개.
- P3_step0~2: 코스 카드가 완료 → 지금 → 대기로 진행. step3(방금 마침)은 칭찬 말풍선 praise[0]+활짝 해님, done_today(오늘 완료)는 다시 연 상태로 praise[2]. 둘의 차이는 "방금 끝낸 순간"과 "재방문"이며, 앱에 같은 화면이면 합쳐도 된다.
- P3_stamps_0/1/3/7/8plus: 도장 줄만 바꿈. 7일 이상은 7칸 모두 채움(8+는 제목 숫자로 표현). 0일은 "끊겼어요" 같은 표현 없이 권유 문구.
- P3_loading/no_content/offline/declined: 로딩은 회색 자리, no_content는 "다시 보기" 1개, 오프라인은 notice 패널 + 마지막 상태 유지, 거부 상태는 작은 카드 안 "좋아요" 버튼.
- P3_zoom150: 위와 같은 스크롤+고정 하단 구조.

## 가정·미결정
1. 임시 문구(화면에 [문구 확정 필요] 라벨): P0 전체, P1 확인 중·서버 오류·잠금 남은 시간, P2 처리 중·실패 제목·거부 후 제목("답을 남기지 않기로 했어요"), P3 코스 카드 이름·시작하기·이어서 하기·사진 다시 보기·도장 0일 문구·내 기록 지우기·no_content·로딩. P2_default 상태 전환형은 제목 문구가 임시이나 라벨을 붙이지 않았다.
2. 위험색 danger #B91C1C, dangerSoft #FEE2E2는 designer.md에는 있으나 app/src/ui/tokens.ts에는 없다. 추가 필요.
3. tokens.ts의 placeholder는 #FFF59D(designer.md의 #EFE4CC와 다름). 시안은 tokens.ts를 따랐다.
4. 화면당 주요 버튼 3개 이하: P3 거부 상태는 "좋아요"+이어서 하기+읽어 주세요 3개이고, "내 기록 지우기"는 텍스트 링크라 주요 버튼으로 세지 않았다. 링크 터치 영역은 64 미만이므로 앱에서는 hitSlop으로 64 확보 필요(미확인).
5. 도장 줄 요일 글자 20, 도장 40(tokens의 stamp 44보다 작음: 7칸이 폭 310에 들어가야 해서). 확대 150%에서는 요일 글자 30이 칸 폭을 넘을 수 있어 미확인.
6. P3 → P4 링크는 그룹 B 파일명 P4_photo.dc.html을 가정했다. 이름이 다르면 링크가 끊긴다. 링크는 캔버스 안에서 동작하는지 미확인.
7. P1 연속 오류 후 잠금 진입 기준(몇 회)은 서버 계약 확인 못 함. 남은 시간 표시 방식(분:초)은 가정.
8. P11(재연결)이 P1을 재사용하므로 재연결 전용 안내는 이번 범위 밖.

## 계산한 대비(글자/배경)
ink/paper 12.67, ink/white 14.21, inkSub/paper 7.22, inkSub/white 8.10, 흰/action 5.18, actionDark/white 7.31, actionDark/actionSoft 5.55, doneInk/doneSoft 7.17, ink/dangerSoft 11.63, ink/placeholder(#FFF59D) 12.72, inkSub/placeholder 7.25, inkSub/disabled 5.80, handwrite/paper 6.76. 비글자: danger 테두리/dangerSoft 5.30, danger/white 6.47, line/white 4.17(3 이상). 도장 점선(line)과 paper는 3.72.
미확인: 글자 확대 150%의 실제 줄바꿈·잘림, 폰트(Jua, Nanum Pen) 렌더링, 노치 높이, 키보드 높이 260 가정.
