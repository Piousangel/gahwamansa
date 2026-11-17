# U0 공용 컴포넌트 리뷰 (독립 리뷰어 RN·접근성·디자인 시스템, 2026-11-17)
대상: `worktree-agent-afa278236a844b00d` vs main (커밋 10개, 26파일 +1654). 줄 번호는 브랜치 worktree 기준.
판정: **조건부 합치기 가능**. 아직 이 컴포넌트를 쓰는 화면이 없어 지금 합쳐도 기존 화면 동작은 그대로. 다만 M 3건은 첫 사용 화면 전에 고칠 것.

## 실행 결과
- 브랜치: `jest u0 audioPolicy designSystem qaP1P3` 9 suites / 89 tests 통과, `tsc --noEmit` 통과
- main(1e62eb1)과 가상 병합(merge-tree → 임시 폴더): `jest`(__integration__ 제외) 44 suites / 342 tests 통과, `tsc` 통과
- 충돌: `docs/team/dev-app-notes.md` 내용 충돌 1건(둘 다 끝에 추가 → 둘 다 남기면 됨). `designSystem`·`qaP1P3` 테스트는 자동 병합

## 발견 (심각도 · 파일:줄 · 수정 제안)
| # | 심각도 | 위치 | 내용 | 제안 |
|---|---|---|---|---|
| 1 | M | ui/Dialog.tsx:61 | 안드로이드 뒤로 = `actions[0].onPress` 를 **비활성·loading 여부와 상관없이** 부름. 로딩 중 뒤로 → 같은 요청 두 번, 비활성 선택지가 뒤로로 실행됨 | `actions[0]` 이 disabled/loading 이면 아무것도 안 함(또는 onBack 필수화). 테스트 추가 |
| 2 | M | ui/Photo.tsx:30-32 | `source` 가 바뀌어도 `status`·`opacity` 가 그대로. 한 번 error 면 다음 사진이 계속 투명(opacity 0), loaded 면 새 사진에 자리표시·페이드 없음 | uri 바뀌면 status='loading'·opacity 재설정(또는 호출부에 `key={uri}` 규칙 명시 + 테스트) |
| 3 | M | ui/Toast.tsx:71 | 오류 토스트는 자동으로 안 사라지는데 `action` 이 없으면 **닫을 길이 없음**(X 없음) | kind='error' 면 action 필수로 타입 강제, 또는 닫기 버튼(56) 추가 |
| 4 | L | ui/useFadeIn.ts:8 | 닫힐 때 opacity 를 0으로 되돌리지 않아 **두 번째 열 때** 첫 프레임이 opacity 1 → onShow 에서 0 → 페이드(깜빡임) | visible=false 에서 `opacity.setValue(0)`(reduce 면 1) |
| 5 | L | ui/Dialog.tsx:50, ui/BottomSheet.tsx:56 | 열릴 때 제목 포커스를 onShow 즉시 보냄. R2·R12는 300ms 뒤(창 전환 직후 튕김) — 정작 FOCUS_DELAY_MS 는 복귀에만 씀 | `setTimeout(focusOn, FOCUS_DELAY_MS)` + 닫힘/언마운트 시 정리 |
| 6 | L | ui/a11y.ts:10 · main ui/Screen.tsx | main 의 Screen 이 같은 일(300ms 뒤 sendAccessibilityEvent, try/catch)을 따로 구현. 병합 뒤 포커스 도우미 2벌, a11y.focusOn 은 try/catch 없음 | 병합 후 Screen 이 `focusOn`·`FOCUS_DELAY_MS` 를 쓰게 통일, focusOn 에 try/catch |
| 7 | L | ui/Banner.tsx:92 | 배너 '다시 하기' 글자(22)에 배율 상한 없음 → 200%에서 44, 본문(flex 1)과 한 줄에서 본문이 몇 글자 폭으로 눌림. Toast·Sheet·SunBubble 버튼은 1.5 상한인데 여기만 빠짐 | `maxFontSizeMultiplier={FONT_SCALE_MAX}` + 배율 크면 action 을 아래 줄로(flexWrap) |
| 8 | L | ui/Banner.tsx:108 | `rgba(116,72,33,0.10)` 하드코딩 → ARCHITECTURE §6 위반 | `color.actionSoft` 등 토큰 역할 이름으로 |
| 9 | L | ui/Toast.tsx:51 | hide 의 setTimeout 을 정리하지 않음(언마운트 뒤 setState) | ref 에 담아 언마운트·show 때 clear |
| 10 | L | ui/SunBubble.tsx:38,56 | 칭찬 검사가 개발 중 경고뿐이고 정규식이 `잘 하셨`(띄어쓰기)·`멋져`·`장하` 등을 놓침. DECISIONS 11-17 "잘하셨어요" 위반이 실제로 있었음 | 정규식 `/잘\s*하셨/` 등 보강 + `hanimTextIssues` 를 `lib/`로 옮겨 copy.ko.json 해님 키 전체를 검사하는 테스트(토스 미니앱·백오피스도 재사용) |
| 11 | L | ui/SunBubble.tsx · lib/audioPolicy.ts | R16 '읽어 주세요' 숨김을 SunBubble 이 `useScreenReader` 로, audioPolicy 가 `ttsAllowed` 로 두 군데서 판단 | 오디오 연결 때 하나로(예: SunBubble 이 `readAloud` 를 호출부 판단으로만 받기) |
| 12 | L | ui/Photo.tsx:60 | 로딩·실패 중에도 이미지가 사진 라벨로 읽힘(보이는 건 빈 자리). R13은 "잠시만요"만 | loaded 전에는 이미지 accessible=false, 컨테이너 라벨은 호출부 문구(props) |
| 13 | 정보 | ui/Dialog.tsx:104 | 150%에서 본문이 없으면 제목+버튼 3개(+이유 줄)가 화면을 넘을 수 있음(스크롤은 본문만) | 실기기 150%·200% 캡처로 확인 |
| 14 | 정보 | ui/imageCache.ts | Supabase 서명 URL 처럼 매번 주소가 바뀌면 캐시 적중 0 | 키를 경로(토큰 제외)로 만드는 선택지 검토 |

## 잘 된 점
- R5·R8·R11·R12·R16 을 테스트 이름에 규칙 번호로 고정, 동작 줄이기(0ms)·불투명도만 모션, 글자 최소 20(impl-drift #5)·경고 칩 prop(#6)·글자 버튼(#4) 반영
- ui/ 가 문구를 모름(closeLabel·warningLabel·readAloud.label 을 props 로), scrim 토큰 추가, audioPolicy 는 React 없는 순수 함수(lib/ 규칙 준수, 토스 재사용 가능)
- Toast Provider: api `useMemo`, children 은 재렌더 없음. Banner·Toast 타이머 정리 OK, reduce 늦게 와도 머무는 시간 안 늘어남

## BigButton 변경 부작용
- 이유 줄을 읽기에서 숨기고 힌트로만 읽음(R8 그대로). 사용처 `features/course/QuestionStep.tsx:62` 하나, 병합 후 전체 테스트 통과 → 회귀 없음
- 단점: 안드로이드 터치 탐색으로 이유 줄만 짚으면 아무것도 안 읽힘. 명세 의도대로라 수용
