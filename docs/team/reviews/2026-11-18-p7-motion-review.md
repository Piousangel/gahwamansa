# 2026-11-18 p7-motion 브랜치 리뷰 (독립 리뷰어)

- 대상: `p7-motion` 5ba1994(P7 도장 모션·촉각·소리), 783cc54(P3 단계 체크·테이프·설정 토글·띠 바닥선), merge 7db3ae6 — main(6feeebe) 대비
- 기준: 동결 시안 `docs/design/v3/screens/parent/P7_motion.dc.html`, `docs/team/board/2026-11-17-ease-and-joy/SUMMARY.md` C절, DECISIONS(11-17 "토글 이름 '도장 소리'", 미연결 도장, 11-18 iOS 촉각 보류·패키지 설치 시점), `copy-v3-confirmed.md` 11절·11-7, `talkback-spec`, ARCHITECTURE
- 방법: 별도 worktree(7db3ae6, main 6feeebe)에서 tsc·jest 실행, 코드 수정 없음
- 줄 번호는 7db3ae6 기준

## 실행 결과

| 항목 | 결과 |
|---|---|
| `git merge-tree --write-tree main p7-motion` | 충돌 없음(main 6feeebe 기준, main 쪽 새 커밋은 문서·콘텐츠·registry 주석) |
| `npx tsc --noEmit` | 통과(exit 0) |
| `jest --testPathIgnorePatterns __integration__ --maxWorkers=2` | 4회 중 마지막 1회 69 suites / 663 tests 모두 통과. 앞 3회는 부하(load 25~33)에서 1·2·5 suites 실패(courseHomeV4·flow·keyboardStep·qaP1P3·noPlaceholder·u0SunBubble, `waitFor` 시간 초과), 실패한 파일만 다시 돌리면 모두 통과. 같은 부하에서 main은 67/647 한 번에 통과(L6) |
| `stamp.wav` 재생성 | `python3 -I make-stamp-wav.py` 결과와 바이트 동일, 22050Hz·16bit·모노·0.200초, 최대 진폭 0.80 |

## 높음

### H1. 설정 토글 이름이 결정과 다름: "효과음" → "도장 소리"
- `app/src/copy/copy.ko.json:286`, `docs/team/copy.ko.json:286`(`settings.sfx: "효과음"`), `app/__tests__/p7Motion.test.tsx`(스위치 이름 '효과음' 검증)
- DECISIONS 11-17 "효과음은 도장 소리 하나 → 설정 토글 이름 '도장 소리'", 시안 P7_motion "설정 '도장 소리' 토글". copy 11절 405행은 '효과음'(대안 '도장 소리', 11-6 #3 판단 대기)이었고 그 판단이 DECISIONS로 내려졌다. SUMMARY C절의 "효과음" 표기는 결정 이전 문구.
- 권장: `settings.sfx` = "도장 소리"로 두 copy 파일 동시 수정, 보조 글은 이름과 겹치므로("도장 소리 / 도장을 찍을 때 짧은 소리") 라이터 확인. 테스트·주석(`ParentSettings.tsx:116~117` 읽기 예시) 같이 수정.

## 중간

### M1. 단계 체크 모션이 "돌아온 순간"이 아니라 이전 화면이 닫히는 동안 돈다
- `app/src/features/course/CourseHome.tsx:44~56`, `useFinishStep.ts`(applyStep 후 `popTo`)
- `applyStep`이 `popTo('CourseHome')`보다 먼저 `done`을 바꾸므로, 스택 아래 깔린 CourseHome이 그 순간 `justDone`을 세우고 `JustDoneRow`(280+200+120=600ms)·`TapeIn`(160+240=400ms)을 바로 시작한다. 네이티브 스택 pop 전환(약 300ms+)과 겹쳐 체크 원·테이프는 대부분 가려지고 끝 상태만 보일 수 있다.
- 처음 열 때 안 움직이는 것(④)은 맞다: `prevDone` 초기 null, 길이가 늘 때만, 3/3이면 `!all`로 제외.
- 권장: 모션 시작을 포커스·전환 끝에 묶는다(`navigation.addListener('transitionEnd')` 또는 `useFocusEffect`로 `justDone` 확정). 실기기 확인 필요.

### M2. 건너뛰기 안내 위치가 시안과 달라 끝날 때 화면이 튄다
- `app/src/features/course/CourseDone.tsx:180`
- 시안은 안내 줄을 하단 독(‘알겠어요’ 아래, 18/26 `#85592F`)에 둔다. 구현은 가운데 정렬 본문 칸 안에 넣어, `phase`가 `done`이 되는 순간(도장이 오늘 칸에 앉는 순간) 줄이 빠지며 본문 전체가 (줄 높이+gap)/2 만큼 내려간다. 900ms에 측정한 칸 위치와도 어긋난다.
- 권장: `Screen bottom`의 버튼 아래로 옮기고, 사라질 때 자리를 유지하거나 하단 독에서만 바뀌게.

### M3. 큰 도장 위치·구성이 시안과 다름(해님 위에 고정 top 96 오버레이)
- `CourseDone.tsx:160~163`(Sun 88 유지), `:217`(`overlay.top: 96`), `:176`(문구 페이드에 제목 미포함)
- 시안 P7_motion 보드: 해님 없이 120 도장이 본문 맨 위 흐름 안(margin-top 24)에 있고, 그 아래 제목+본문이 함께 `mo-text`로 500ms에 페이드. 구현은 해님을 그대로 두고 화면 높이와 무관한 top 96에 도장을 띄워 해님·제목과 겹칠 수 있고(844 기준 해님 대략 155~243), 제목은 처음부터 보인다. 숫자 크기 직접 사용(ARCHITECTURE 55행).
- 권장: 도장 자리를 흐름 안 120 칸으로(해님 대체 여부는 시안 P7_done과 함께 디자이너 확인), 제목도 문구 페이드에 포함.

### M4. 동작 줄이기 화면이 시안 보드와 다름
- `CourseDone.tsx:88~94, 171, 184`(`flying`이 full에서만 큰 도장 렌더)
- 시안 'P7 · 동작 줄이기(200ms 페이드)' 보드는 120 도장이 제자리에서 200ms 페이드(`mr-stamp`) + 문구 페이드, 오늘 칸은 이미 찍힌 상태. 구현은 큰 도장 없이 오늘 칸 40만 200ms 페이드.
- 권장: 큰 도장을 제자리 페이드로 보여 주거나, 현 방식이 의도라면 디자이너 승인 후 DECISIONS 기록. (화면 읽기일 때 오늘 칸은 즉시 표시 — `StampRow.tsx` FadeIn — 은 talkback 쪽으로 타당)

### M5. 촉각이 "시스템 촉각(CONFIRM 계열)"이 아니라 Vibration 20ms
- `app/src/features/course/stampFeedback.ts:83~87`, `app/android/app/src/main/AndroidManifest.xml:4`
- 시안: "시스템 촉각 1회(HapticFeedback CONFIRM 계열)". `Vibration.vibrate(20)`은 사용자의 시스템 '터치 진동' 끔 설정을 무시하고 VIBRATE 권한이 필요하다. `View.performHapticFeedback(CONFIRM)`(API 30+, 이하 `VIRTUAL_KEY`)은 권한 없이 시스템 설정을 따른다. VIBRATE는 normal 권한이라 추가 자체는 문제없고 스토어 고지 대상도 아니지만, 시스템 촉각으로 바꾸면 불필요해진다.
- 권장: 빌드 1은 현 방식 유지 가능(DECISIONS 11-18 Android 우선)하되, 작은 네이티브 모듈 또는 승인된 햅틱 패키지로 교체 시 VIBRATE 제거. 최소한 "시스템 설정 무시" 차이를 DECISIONS에 남길 것.

### M6. 테스트가 실제 '날아가기' 경로·타이밍·언마운트를 검증하지 않음
- `app/__tests__/p7Motion.test.tsx`
- 테스트 환경에서는 `measureInWindow`가 응답하지 않아 항상 100ms 뒤 폴백(페이드 사라짐)만 탄다 → `tx/ty/fly` 경로는 한 번도 실행되지 않는다. `P7_T`를 export했지만 시안 수치와 대조하는 단언이 없다. 언마운트(‘알겠어요’ 즉시) 후 타이머·setState 정리 테스트가 없다. 건너뛰기 테스트의 `play ≤ 1`은 0이어도 통과하는 약한 단언이고, 미연결 테스트는 "이미 끝났으면 아무 일 없음"이라 건너뛰기 여부가 비결정적.
- 권장: fake timers + `measureInWindow` 목으로 (a) 180ms 시점 촉각·소리 1회, (b) 900ms 측정 성공 시 이동·1380ms 끝, (c) 측정 실패 폴백, (d) 0~180ms 사이 건너뛰기 시 1회 발생·180ms 뒤 건너뛰기 시 추가 없음, (e) 언마운트 후 타이머 0개를 단언. `P7_T` 값 스냅샷 대조 1줄.

## 낮음

### L1. 언마운트 정리 빈틈(누수·unmount 후 setState)
- `CourseDone.tsx:28~41`(measure 내부 100ms 타이머 미추적), `:124~136`(flyAt 콜백이 await 중 언마운트되면 그 뒤 애니메이션 시작·`setPhase`), `:96~103`(`skipHintSeen().then(setHint)`)
- 정리 effect(`:140~146`)는 등록된 타이머·애니메이션은 잘 멈춘다. 다만 900ms 콜백이 이미 실행돼 측정을 기다리는 100ms 창에서 닫히면 `running`에 새 애니메이션이 추가되고 `setPhase`가 불린다(React 18+는 경고 없음, 실해 작음).
- 권장: `alive` ref로 await 뒤·then 안에서 막기.

### L2. 시안 수치와의 세부 차이
- 인주 번짐 `CourseDone.tsx:196~200, 220`: 시안은 지름 144(inset -12), scale 0.9→1.15, 색 `#C44F2E`(인주), 220ms 전에는 투명. 구현은 120, 0.8→1.6(최대 192), `color.blush #FF9E7A`, 0~220ms에도 0.35(부모 불투명도에 묶여 반쯤 보임).
- 이징: 착지 시안 `cubic-bezier(.3,0,.8,.15)` vs `Easing.in(quad)`, 눌림 `(.2,.8,.2,1)` vs 기본, 이동 `(.4,0,.2,1)` vs `inOut(cubic)` — `Easing.bezier`로 그대로 옮길 수 있다.
- 타이밍 자체는 일치: 착지 180, 눌림 70+70(시안 72+68), 인주 220+420, 문구 500+200, 이동 900+480, 폴백·줄이기 200.
- 단계 체크 `StepRow.tsx:110~116`: 시안은 원 테두리를 그리는(stroke-dashoffset) 280ms + 체크 표시는 480ms에 등장, 구현은 체크 아이콘 전체 scale 0.4→1. 테이프 160+240·왼쪽 8은 일치(변환 순서 rotate/translate만 반대, 눈에 거의 안 띔).

### L3. 단계 체크·테이프가 동작 줄이기 확인 전 첫 프레임에 full로 시작
- `StepRow.tsx:88, 126`: `useReduceMotion` 초기값 false → full 애니메이션 시작 후 true가 오면 재시작. 짧게 크기·이동이 보일 수 있다. 또 화면 읽기는 고려하지 않음(P7은 화면 읽기 = 줄이기).
- 권장: P7처럼 "모름(null) 동안 시작 안 함" 패턴 공유(`ui/motion`에 null 반환 훅 추가 → `useMotionPref`도 그걸 쓰면 중복 제거, ARCHITECTURE 74행).

### L4. 설정 토글 행 터치 영역·초기 깜빡임·위치
- `ParentSettings.tsx:118~152`: 주석은 "행 전체 터치 64 이상"이나 실제로 누를 수 있는 건 기본 `Switch`(Android 약 48×32)뿐. 저장값이 꺼짐이면 켜짐→꺼짐으로 한 번 깜빡임. 위치가 '모두 지우기'(위험) 아래.
- 권장: 행 전체를 `Pressable`(role switch)로 감싸 토글, 값 로드 전 Switch 숨김 또는 disabled, 위험 구역보다 위로.

### L5. 소리 경로 메모(설치 뒤 확인할 것)
- `stampFeedback.ts:62~78`: `require('react-native-sound')` try/catch는 Metro `allowOptionalDependencies: true`(기본, `@react-native/metro-config`)라 미설치 상태에서도 번들 실패 없이 null → 촉각만. 안전함 확인.
- 다만 현재 Android 벨소리 모드는 항상 `unknown` → 소리 없음, 패키지도 미설치라 빌드 1에서 소리는 사실상 꺼져 있다(DECISIONS 11-18과 일치). 설치 뒤: 로드 실패 시 `player = null`이 이미 만들어진 피드백 객체에는 반영되지 않음(`s.play()` 무해하나 확인), iOS `setCategory('Ambient', true)`의 mixWithOthers, 읽어 주기 연결(`ttsSpeaking` 상수 false), "배경 음악은 소리 동안 낮춤"(시안) 미구현.
- 촉각과 소리가 같은 `fire()`에서 촉각은 즉시, 소리는 prefs·ringer await 뒤라 몇 ms 늦을 수 있음(체감 영향 낮음).

### L6. 기타
- 테스트 불안정: courseHomeV4 첫 테스트(`waitFor` 기본 1초)가 부하 시 실패. 단독 재실행 통과. 이 브랜치 전체 실행은 4회 중 3회 시간 초과 실패(같은 부하에서 main은 1회 실행에 통과)라 원인을 이 브랜치로 단정할 수는 없지만, P7을 거치는 흐름 테스트가 실제 타이머(측정 100ms·연출 1.4초)를 기다리게 된 점이 의심된다. 권장: 흐름 테스트에서 `setStampFeedbackForTest`와 동작 줄이기 목으로 연출을 짧게 하거나, P7 이후를 기다리는 `waitFor`에 timeout을 준다.
- 도장 `stamp.wav`: 직접 합성·외부 소리 없음, `assets-manifest.md` 7절에 출처·스크립트·seed 기록 — 라이선스 문제 없음. 시안 "250ms 이하·낮은 음" 충족(200ms, 150→110Hz). 스크립트 위치 `design-system/assets/sound/`도 적절.

## 확인 결과 문제 없음
- 건너뛰기 시 촉각·소리 1회: `fire()`의 `fired` 플래그 + 착지 콜백은 `finished`일 때만 → 착지 전 건너뛰기면 `finishNow`가 1회, 후면 추가 없음.
- 오늘 칸 측정 실패 폴백: 측정 100ms 시간 제한 → 큰 도장 200ms 페이드 후 오늘 칸 표시. 이번 주 도장 못 받음(`week === null`)도 같은 폴백.
- 동작 줄이기·화면 읽기 분기: 판정 전(null)에는 시작하지 않아 큰 모션 깜빡임 없음, 소리·촉각은 유지(시안 일치), 건너뛰기 안내는 full에서만(copy 11-7 #16 "화면 읽기면 이 줄은 읽지 않음"과 일치).
- 미연결도 같은 도장 연출·문구 11-7 #19(`unlinked_body`) — DECISIONS 11-17과 일치.
- `kvStore`·`prefs` 분리: `defaultStore`·`memoryStore` 코드 동일 이동, 저장 키(`local_week_stamps_v1`) 불변, `localStamps`가 `memoryStore`·`KeyValueStore`를 다시 내보내 기존 import 유지. prefs와 localStamps가 각자 저장소 인스턴스를 가지지만 AsyncStorage 공유라 문제없음.
- VIBRATE 권한: normal 권한(설치 시 자동, 런타임 질문 없음)이라 추가 적절(M5는 방식 문제).
- 띠 `alignItems: 'baseline'`·`headGroup gap 24`(R5) 테스트 포함.

## 합치기 판정

**조건부 합치기.** H1(토글 이름 "도장 소리")은 합치기 전 수정. M1·M2는 실기기에서 바로 보이는 문제라 같은 브랜치에서 고치기를 권장, M3·M4는 디자이너 확인 뒤 후속 가능. M5·M6·낮음은 후속 작업으로 기록.

## 재검토 (2026-11-18, 86415b0 main 병합 · 8dcc5fe 반영)

- 방법: worktree(8dcc5fe)에서 tsc·jest 전체 2회·`assembleStagingDebug`, 코드 수정 없음. `git merge-tree --write-tree main p7-motion` 충돌 없음.
- tsc 통과. jest 1회차(load 약 60): 6 suites·13 tests 실패. 전부 `Exceeded timeout of 5000 ms for a test`였고 p7Motion뿐 아니라 parentFamily·consentFlow·screens·cReview·previewAndVersion처럼 이 변경과 무관한 suite도 포함. 2회차(load 약 42): 69 suites·669 tests 모두 통과.
- 빌드: `source scripts/env.sh && ./gradlew assembleStagingDebug` 성공(3분 24초, HapticModule·HapticPackage Kotlin 컴파일 통과). 합쳐진 stagingDebug manifest에 VIBRATE 없음(INTERNET·SYSTEM_ALERT_WINDOW(디버그)·ACCESS_LOCAL_NETWORK·리시버 권한·Install Referrer만).

### 지적 사항 해결 여부

| 항목 | 상태 | 근거 |
|---|---|---|
| H1 토글 이름 | 해결 | `settings.sfx: "도장 소리"`(copy 두 곳), 테스트·주석 갱신 |
| M1 단계 체크 시점 | **미해결(실질)** | `CourseHome.tsx:58·65`: 화면이 가려져 있으면 대기했다가 `useFocusEffect`에서 시작. 그런데 `focus` 이벤트는 내비 상태가 바뀌는 즉시(`popTo` 순간) 발생하고, 전환이 끝날 때 오는 이벤트는 `transitionEnd`다(`@react-navigation/native/src/useFocusEffect.tsx:80`은 'focus' 구독). 이전 코드도 `applyStep` 직후 바로 `popTo`였으므로 시작 시점은 사실상 같다 → pop 전환 약 300ms와 겹치는 문제는 그대로. 권장: `navigation.addListener('transitionEnd', e => { if (!e.data.closing && pending.current) … })`(native-stack은 드러나는 화면에 closing=false로 보냄), 처음 렌더 직후에는 대기를 비움. 테스트도 '포커스 뒤'만 확인하므로 시점을 검증하지 못한다 |
| M2 건너뛰기 안내 | 해결(남는 점 낮음) | 하단 독, 끝나면 글자만 투명(자리 유지). 다만 안내 줄이 생길 때(prefs 읽은 직후) 독 높이가 늘어 본문이 반 줄쯤 위로 한 번 움직인다 → 연출 시작 직후라 900ms 측정 전이라 착지 위치에는 영향 없음. 원하면 첫 회에는 처음부터 자리를 잡아 두기 |
| M3 큰 도장 위치·제목 페이드 | 해결 / **디자인 확인 항목** | 120 도장이 본문 흐름 안 맨 위 칸에, 제목·문구가 같이 페이드, 토큰(space·size) 사용. 끝난 뒤 그 칸에 완료 해님을 200ms 페이드로 보여 주는 것은 시안 P7_motion(빈 칸)과 다르다 → 디자이너 확인 필요(코드 문제 아님) |
| M4 동작 줄이기 | 해결 | 120 도장 제자리 200ms 페이드 + 제목·문구, 인주·이동 없음, 오늘 칸은 이미 찍힘 |
| M5 시스템 촉각 | 해결 | `HapticModule.confirm()`: `UiThreadUtil.runOnUiThread`, `currentActivity?.window?.decorView ?: return`(뷰 null 안전), API 30+ `CONFIRM` / 미만 `VIRTUAL_KEY`. VIBRATE 권한 제거, 앱 코드(src·android)에 `Vibration`/`vibrate(` 사용 없음. JS는 모듈이 없으면(iOS·테스트) 아무것도 안 함. 등록 방식은 SplashPackage와 같은 레거시 인터롭 |
| M6 테스트 | 해결 | 가짜 시계로 180ms 촉각·소리, 900ms 측정 성공 시 이동·1380ms 끝, 측정 실패 폴백, 180ms 전 건너뛰기 1회, 측정 대기 중 언마운트, `P7_T` 값 대조, 판정 전(null) 미시작, 줄이기 화면. AccessibilityInfo 목을 afterEach에서 되돌려 테스트 간 누수 제거 |
| L1 언마운트 정리 | 해결 | `alive` ref, 측정 뒤 `!alive || running 비어 있음`이면 중단, 끝 전환도 타이머로 추적·정리, prefs `.then`도 alive 확인 |
| L2 세부 수치 | 대부분 해결 | 이징 3종 시안 bezier 그대로, 인주 지름 144·scale 0.9→1.15·220ms 전 투명. **인주 색은 아직 `color.blush #FF9E7A`(시안 `#C44F2E`)** — 토큰에 맞는 색이 없으면 디자이너 확인. 단계 체크 원 그리기(stroke)는 여전히 scale 근사(낮음) |
| L3 판정 전 모션 | 해결 | `ui/motion.useMotionMode()`(null → 시작 안 함, 화면 읽기 = 줄이기), JustDoneRow·TapeIn·CourseDone이 같이 사용, `useMotionPref` 중복 삭제. null 동안 체크·면·글자는 투명(제목만 보임) — 한두 프레임이라 문제 없음 |
| L4 설정 토글 | 해결 | 행 전체 Pressable(role switch, label·hint·checked), Switch는 읽기에서 숨김, 값 읽기 전 Switch 미표시·disabled, 위험 구역 위로 이동 |
| L5 소리 경로 | 그대로(설치 뒤 확인) | DECISIONS 11-18대로 패키지 설치는 합친 뒤 main에서 |
| L6 테스트 불안정 | 부분 | 원인 하나(목 누수)는 제거. 그러나 flow·keyboardStep의 `waitFor` timeout을 6000으로 올린 것은 효과가 없다 — jest 테스트 하나의 기본 제한이 5000ms(`jest.config.js`에 `testTimeout` 없음)라 그 전에 테스트가 끝난다. 높은 부하에서는 여전히 무관한 suite까지 5초 제한에 걸린다(위 1회차) |

### 새로 본 것

- 낮음 N1: `toDone`의 해님 페이드(`CourseDone.tsx:100`)는 `running`에 넣지 않아 언마운트 때 멈추지 않는다. 네이티브 드라이버 200ms라 실제 해는 없음.
- 낮음 N2: `week`가 끝내 `undefined`로 남으면(응답 없음) 제목까지 투명한 채로 남는다. 이전에는 제목은 항상 보였다. `useWeekStamps`에 시간 제한이 없다면 몇 초 뒤 null로 넘기는 장치를 고려.
- 낮음 N3: 테스트 timeout — 위 L6. 흐름 테스트에서 P7을 지나는 것들은 `test(..., 15000)`처럼 테스트별 제한을 주거나 config에 `testTimeout`을 둘 것.
- 확인: HapticModule은 `@ReactMethod` 비동기 호출이라 JS 스레드를 막지 않고, 액티비티가 없을 때(백그라운드) 조용히 넘어간다. `performHapticFeedback`은 시스템 '터치 진동' 끔 설정을 따른다(시안 의도와 일치). 저 API 기기 VIRTUAL_KEY는 아주 짧은 클릭감이라 '길게 울리지 않음' 규칙에 맞음.

### 재검토 판정

**합치기 가능(조건 하나 권장).** H1·M2~M6·L1·L3·L4 해결. M1은 고쳤다고 했지만 시점이 바뀌지 않았다. 다만 화면 깨짐이나 기능 오류가 아니라 모션이 덜 보이는 문제라, 합친 뒤 `transitionEnd`로 바로 이어서 고치는 것도 가능하다(실기기에서 확인). M3의 완료 해님과 인주 색은 디자인 확인 항목이다.
