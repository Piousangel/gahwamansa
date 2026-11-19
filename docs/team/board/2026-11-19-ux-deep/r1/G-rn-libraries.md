# G. RN 라이브러리 검토 (위원 ⑦ RN 라이브러리 엔지니어)

작성 2026-11-19 · 대상 app/ (RN 0.88.1, New Arch·Hermes 켬, edgeToEdgeEnabled=true, `windowSoftInputMode=adjustResize`)
오너 지시: "바텀시트 같은 것도 좋은 라이브러리가 많을 것이다."
근거 표기: **확인** = npm 레지스트리(registry.npmjs.org, 11-19 조회)·공식 문서·GitHub에서 직접 본 것 / **추정** = 계산·경험치 / **미확인** = 찾지 못함.

## 0. 결론 먼저

1. **빌드 1에는 UI 라이브러리를 넣지 않는다.** 지금 쓰는 BottomSheet·Dialog는 RN `Modal` 위에 직접 만든 것이다. Android에서 `Modal`은 별도 창으로 뜨기 때문에 TalkBack 포커스가 그 안에 저절로 갇힌다. 뒤로 가기·포커스 돌려주기·동작 줄이기도 이미 처리돼 있다. 이 접근성 수준은 후보 라이브러리 중 가장 많이 쓰이는 @gorhom보다 **높다**(§2).
2. 오너 말대로 좋은 시트 라이브러리는 많다. 다만 모두 **드래그 제스처**가 핵심 가치다. 우리 규칙은 어르신에게 시트를 쓰지 않고(README §12, 어르신은 Dialog만), 자녀 시트도 X·보조 버튼으로 닫는다. 그래서 라이브러리의 핵심 가치를 거의 쓰지 않는다.
3. 반대로 라이브러리를 넣으면 비용이 크다. 대부분 **Reanimated 4.7 + Worklets 0.13 + Gesture Handler 3**을 함께 데려온다. RN 0.88에서는 Gesture Handler가 3.x만 된다(2.x는 0.87까지, 확인). 그런데 @gorhom v5는 Gesture Handler 2를 기준으로 만들어졌고, 3.x 지원 여부는 공식 답이 **미확인**이다.
4. 빌드 2에 넣을 만한 것은 둘이다. **react-native-keyboard-controller**는 P6 자판·C0 입력에서 edge-to-edge 자판 가림 문제가 실기기에서 확인될 때 넣는다. **@lodev09/react-native-true-sheet**는 네이티브 시트로, 자녀 쪽에 높이를 바꿀 수 있는 긴 시트가 생길 때만 쓴다.
5. 지금 바로 할 일은 의존성 0 수정 4건(§1-3)과 개발 의존성 1건(eslint-plugin-react-native-a11y, 선택)이다.

## 1. 현재 자체 구현 평가

| 파일 | 하는 일 |
|---|---|
| `app/src/ui/BottomSheet.tsx` (159줄) | 자녀 전용 아래 시트. `Modal transparent` + 불투명도 300ms. X(56)·보조 버튼·밖 누르기·뒤로 가기로 닫힘 |
| `app/src/ui/Dialog.tsx` (141줄) | 어르신 대화상자. `role="alertdialog"`. 밖을 눌러도 안 닫힘. 뒤로 가기 = 첫(안전한) 선택지. 두 번 실행 방지(`fired`) |
| `app/src/ui/a11y.ts` `useModalFocus` | 열리고 300ms 뒤 제목으로, 닫히면 연 버튼으로 포커스(R2·R12) |
| `app/src/ui/useFadeIn.ts`, `motion.ts` | 불투명도만, 동작 줄이기면 0ms. `useMotionMode`는 확인 전 null이라 첫 프레임에 큰 모션을 막음 |
| `app/src/ui/Toast.tsx` | 자녀 토스트 1개. `announce` 1회. 모달이 열려 있으면 숨기고 시간도 멈춤. 오류는 자동으로 사라지지 않음 |
| `app/src/ui/haptic.ts` + `android/.../haptic/HapticModule.kt` | **Vibration API가 아니다.** `View.performHapticFeedback(CONFIRM/KEYBOARD_TAP)`을 쓴다. 권한이 필요 없고 시스템 '터치 진동' 설정을 따른다 |
| `features/course/CourseDone.tsx` | P7 도장. 코어 `Animated` 값 8개 + `useNativeDriver: true`. 스펙(1.3→1.0 180ms → 눌림 0.94 140ms → 인주 420ms → 날아가기 480ms)을 그대로 구현 |
| `ui/imageCache.ts` | `Image.prefetch` + 중복 요청 막기. "새 의존성 안 씀"을 코드 주석으로 결정해 둠 |

### 1-1. 항목별 평가

| 항목 | 상태 | 판단 |
|---|---|---|
| 제스처 | 드래그 없음. 그런데 **손잡이(handle, 48×5) 막대가 보인다** | 보이기만 하고 끌리지 않는 가짜 손잡이다. 자녀는 끌어 보다가 아무 일도 없다고 느낄 수 있다. → 지우거나, 끌어 닫기를 넣거나 둘 중 하나(아래 수정 ①) |
| 접근성 포커스 가두기 | Android: `Modal` = 별도 창이라 바깥을 읽지 않음. iOS: `accessibilityViewIsModal` | **좋음.** @gorhom의 `BottomSheetModal`은 같은 창 안의 뷰라서 바깥 화면이 읽힌다(공식 이슈 #2772 "hide the content behind a presented modal from screen readers", 2026-10-15 열림, 확인) |
| 뒤로 가기 | 시트=`onClose`, Dialog=`onBack`, 없으면 안전한 선택지 | 좋음. 라이브러리들은 이 부분 버그가 반복된다(@gorhom #2781 "Android hardware back pops screen instead of dismissing modal" 10-18 닫힘. true-sheet #413·#574·#788 모두 뒤로 가기 관련, 닫힘) |
| 키보드 회피 | 시트·대화상자 안에 입력칸 없음. 화면은 `Screen.tsx`의 `KeyboardAvoidingView behavior="padding"`. Manifest는 `adjustResize` + edge-to-edge | 모달은 지금 문제없음. 화면 쪽은 edge-to-edge + adjustResize + KAV padding 조합이라 **두 번 밀리거나 아예 안 밀릴 수 있다**(추정, Android 15+ S25 실기기 확인 필요). P6 자판 쓰기(`KeyboardStep.tsx`)가 가장 위험한 화면이다 |
| 200% 글자 | Text20 기본 상한: 제목(큰 글자) 1.5배, 본문 2.0배. 시트 버튼 글자는 `FONT_SCALE_MAX`(1.5) 고정 | 패널 `maxHeight 90%` + 본문만 스크롤해서 버튼이 아래에 남는 구조는 좋다. 다만 **시트 주 버튼 글자가 200%에서 150%로 묶인다.** 디자인 v4가 허용한 상한인지 확인 필요(아래 수정 ③) |
| 동작 줄이기 | `useFadeIn`이 `useReduceMotion()`을 쓴다. 이 값은 확인 전에 **false** | 앱을 켜고 처음 여는 시트가, 설정 확인보다 먼저 열리면 300ms 페이드가 한 번 보일 수 있다(추정, 작은 일). 도장은 `useMotionMode`(null 대기)로 이미 막혀 있다(아래 수정 ④) |
| 닫기 모션 | 없음(바로 사라짐) | 어르신 기준에서는 오히려 좋다. 유지 |
| 겹치기 | 토스트를 숨김(`useToastModalGuard`). 시트끼리 겹쳐 열지 않음 | 좋음 |

### 1-2. 자체 구현의 진짜 약점(라이브러리가 낫다는 부분)
- 드래그·여러 높이(detent)·스크롤과 끌기를 이어 주는 기능이 없다. 지금 화면들에는 필요 없다.
- 열고 닫는 위치 이동(아래에서 올라오기)이 없다. 디자인 결정으로 "불투명도만"이라 약점이 아니다.
- iOS는 아직 검증하지 않았다. 빌드 1은 Android 우선이다.

### 1-3. 지금 할 의존성 0 수정(빌드 1, 합계 2~3시간, 추정)
1. **손잡이 처리.** 시트에 드래그를 넣지 않으므로 `sheet-handle`을 지운다. 지우지 않으면 "끌 수 있다"는 잘못된 신호가 남는다. 디자인이 손잡이를 장식으로 남기기로 하면, 막대 아래에 "닫으려면 X를 누르세요" 같은 신호를 따로 두지 말고 X 크기·위치로 해결한다.
2. **P6·C0 자판 실기기 확인**: S25(Android 15/16)에서 글자 100·200%로 입력칸·다음 버튼이 자판 위에 보이는지 본다. 문제가 생기면 그때 빌드 2의 keyboard-controller로 간다.
3. **시트 버튼 글자 상한 확인.** 디자인 v4 Text 역할 표에 시트 주 버튼 상한이 1.5인지 적혀 있는지 본다. 없으면 BigButton과 같은 규칙으로 맞춘다.
4. **`useFadeIn`의 동작 줄이기 기본값.** `useMotionMode`처럼 확인 전 상태(null)를 두거나, 앱 시작 때 한 번 읽어 모듈에 저장해 둔 값을 쓴다.

## 2. 후보 비교표

공통: npm 레지스트리 `latest`와 그 버전의 게시일(11-19 조회). APK 증가량은 arm64 한 ABI 기준 **추정**. JS 번들 증가량은 min 기준 **추정**.

### 2-1. 바텀시트

| | @gorhom/bottom-sheet | @lodev09/react-native-true-sheet | react-native-actions-sheet | (현행) Modal 자체 구현 |
|---|---|---|---|---|
| 최신 | 5.2.14 (2026-05-09, 6개월 새 릴리스 없음) | 4.1.0 (2026-11-07, 10월 4.0 이후 활발) | 11.0.0 (2026-10-18) | - |
| 방식 | JS + Reanimated·GH. 같은 창 안의 뷰 | **네이티브 시트**(New Arch 전용, RN ≥0.82) | JS + Reanimated 4·GH·Worklets | RN Modal(별도 창) |
| 필수 의존성 | reanimated, gesture-handler, @gorhom/portal | 없음(reanimated는 선택) | reanimated ≥4, worklets, GH, safe-area | 없음 |
| RN 0.88 | 피어 `react-native: *`. GH 3 공식 지원 **미확인**(README는 "Reanimated v3 + GH v2"). 0.88에서는 GH 2.x를 못 쓴다 | 피어 RN ≥0.82. 0.88 실사용 **미확인** | 피어 `*`. 0.88 **미확인** | 확인됨(운영 중) |
| 열린 이슈 | 11월에 #2799(Reanimated 4에서 스프링이 안 멈춤), #2798(키보드), #2795(닫힌 모달이 다시 열림), #2785(Reanimated 4.6+ 경고 28곳) | 접근성 관련 #759·#776(Android 포커스가 안 갇힘)·#962 모두 **닫힘** | 미확인 | - |
| TalkBack 시트 포커스 | 바깥이 읽힘(#2772 열림) → 우리 R2 위반 | "Native accessibility… out of the box"(README). Android 포커스 가두기 버그는 8월에 고쳐짐 | 미확인 | 별도 창이라 갇힘 |
| 드래그 끄기 | `enablePanDownToClose` 기본 false, `enableContentPanningGesture`·`enableHandlePanningGesture` 끄기 가능 | `dismissible={false}`, `draggable={false}`(그러면 손잡이도 숨김) | 가능(미확인 세부) | 원래 없음 |
| 동작 줄이기 | `overrideReduceMotion` 기본 System(확인) | 네이티브 기본(시스템 애니메이션 배율 따름, 추정) | 미확인 | 직접 처리 |
| 키보드 | `keyboardBehavior`, Android 기본 `adjustPan` | "Built-in keyboard handling"(문서) | 있음 | 없음(입력칸 없음) |
| APK/번들 | +3~5MB(Reanimated·Worklets·GH 포함), JS +150KB(추정) | +0.5~1MB, JS +30KB(추정) | Reanimated 묶음과 같음 | 0 |
| 대체할 파일 | BottomSheet.tsx(+Dialog?) | BottomSheet.tsx | BottomSheet.tsx | - |
| 옮기는 시간 | 1~1.5일 + GH 3 호환 확인(추정) | 0.5~1일 + 접근성 재검증 0.5일(추정) | 1일(추정) | - |
| 위험 | **높음**: GH 3·RN 0.88 조합 미검증, TalkBack 가두기 퇴보, 6개월 무릴리스 | 중간: 4.x가 3주 된 메이저. 우리 포커스 규칙(제목 300ms·돌려주기)을 다시 붙여야 함 | 높음: 메이저 버전을 자주 바꿈(11.x) | - |

**Dialog는 라이브러리로 바꾸지 않는다.** 어르신 대화상자는 가운데 카드, 밖 눌러도 안 닫힘, 뒤로 가기 = 안전한 선택지, 두 번 실행 방지 규칙이 있다. 시트 라이브러리가 해 주는 일이 하나도 없다.

### 2-2. 애니메이션·제스처

| | react-native-reanimated + worklets | Moti | react-native-gesture-handler |
|---|---|---|---|
| 최신 | 4.7.2 (11-17) + worklets 0.13.1 (10-26) | 0.30.0 (**2025-01-29**, 22개월 멈춤) | 3.5.0 (11-05). legacy 태그 2.33.1 |
| RN 0.88 | **확인**: 피어 `react-native: "0.86 - 0.88"`, worklets 0.13.x. 공식 호환표: 4.7·4.8이 0.88 지원, New Arch 전용 | 피어 `reanimated: *`. v4 공식 지원 **미확인** | **확인**: 2.x는 RN 0.87까지(2.33.0 노트). 0.88은 3.x(3.4.0에서 0.88로 올림). 3.x는 New Arch 전용, v2 빌더 API는 `Legacy*` 이름으로 남음 |
| 도움이 되는 곳 | 도장 연출을 UI 스레드에서 실행, 스프링, `useReducedMotion` 내장 | Reanimated 선언형 포장 | 끌어 닫기·스와이프 |
| 우리에게 필요? | P7 도장은 코어 `Animated` + `useNativeDriver`로 이미 네이티브에서 돈다. transform·opacity만 써서 **Reanimated의 이점이 거의 없다** | 아니요 | 드래그를 안 쓰면 아니요 |
| APK | +2~4MB(Worklets 런타임 포함, 추정). 빌드 시간 증가 | +Reanimated | +0.5~1MB(추정) |
| 옮기는 시간 | CourseDone 0.5~1일 + Babel/Metro 설정·Jest 모킹 0.5일(추정) | - | - |
| 위험 | 중간: Worklets 0.x가 RN 마이너마다 범위가 바뀐다(0.86–0.88). RN을 올릴 때마다 묶여서 올려야 한다 | 높음(유지 멈춤) | 중간: v3 메이저가 아직 새것 |

### 2-3. 햅틱·토스트·키보드·로티·이미지

| | 최신·호환 | 우리와 비교 | 판단 |
|---|---|---|---|
| react-native-haptic-feedback | 3.0.0 (2026-03-29), RN ≥0.71. Android 1단계 = `performHapticFeedback`(시스템 설정 따름), 2단계 = Vibrator. v3에 `confirm` 타입 추가(확인). TurboModule 여부 **미확인** | 우리 HapticModule.kt(약 30줄)과 **똑같은 API**(CONFIRM·KEYBOARD_TAP)를 쓴다 | 넣지 않음. iOS를 시작할 때 다시 본다(iOS UIImpactFeedback 구현 비용 vs 이 라이브러리) |
| react-native-nitro-haptics | 0.2.3 (2026-03-15) + nitro-modules 0.37.2 필요 | 0.x, 사용자 적음 | 넣지 않음 |
| sonner-native | 0.27.0 (2026-08-15). 피어: reanimated ^4.1.1, GH ≥2.28, screens, svg, worklets, safe-area | 스와이프 닫기·쌓기가 핵심. 우리 토스트는 1개만, announce 1회, 모달이 열리면 멈춤, 오류는 남김, 응원 취소(`onExpire`)처럼 **도메인 규칙이 많다**. 스크린 리더 지원은 README에 **언급 없음** | 넣지 않음 |
| react-native-keyboard-controller | 1.23.1 (11-16, 활발). 피어 reanimated ≥3(**필수**). `KeyboardProvider`, `KeyboardAwareScrollView`, `KeyboardStickyView` | edge-to-edge에서 자판 높이를 프레임마다 정확히 준다. 코어 KAV보다 확실하다 | **빌드 2 후보**. 단 Reanimated를 같이 들여야 한다. §1-3 ②에서 문제가 나올 때만 |
| lottie-react-native | 7.5.1 (11-13), 피어 RN ≥0.84, React ≥19.2(확인) | 도장 "쾅"은 지금 SVG + Animated로 구현했고 동작 줄이기·건너뛰기·스펙 수치까지 맞춰져 있다. Lottie로 가면 디자이너가 AE 파일을 만들어야 하고, 동작 줄이기 분기는 직접 짜야 한다 | 넣지 않음(빌드 2 이후 "인주 번짐" 질감을 디자이너가 원할 때만 다시 본다. APK +0.5~1MB 추정) |
| react-native-fast-image | **10.11.0 (2026-11-02, 원 저장소가 다시 살아남)**. "RN 0.83+ New Arch + React 19 필요"(README) | 하루 사진 몇 장이다. `imageCache.ts`가 Fresco 캐시 + prefetch로 충분하다고 이미 결정했다 | 넣지 않음. 사진이 느리다는 실측이 나오면 10.x를 1순위로(@d11 포크 8.13.0은 2025-11 이후 릴리스 없음) |
| expo-image (CLI) | 58.0.18. 피어에 `expo` 필요 → CLI 앱이면 `install-expo-modules`로 expo-modules-core를 들여야 함 | 사진 하나 때문에 Expo 모듈 런타임 전체가 들어온다 | 넣지 않음 |

### 2-4. 접근성 도구

| | 최신 | 판단 |
|---|---|---|
| react-native-accessibility-engine | 3.2.0 (**2022-11-15**, 4년 멈춤). 피어 `react-test-renderer`(React 19에서 지원 중단 경로). GitHub 저장소 주소가 404(11-19 확인) | 넣지 않음 |
| eslint-plugin-react-native-a11y | 3.5.1 (2024-11-04). 피어 eslint ≤8 → 우리 eslint ^8과 맞음. README 배지는 "maintenance-active"(Nearform) | **빌드 1 선택(개발 의존성, APK 0).** `has-valid-accessibility-role/state`, `has-valid-important-for-accessibility`, `no-nested-touchables`가 우리 R 규칙을 기계로 지켜 준다. 1~2시간(추정). 단 eslint 9로 올리면 막힌다 |
| (대안) 지금 있는 Jest + @testing-library/react-native 13 | - | 접근성 단언(`getByRole`, `accessibilityState`)은 이미 이걸로 하고 있다. 엔진은 필요 없다 |

## 3. 어르신에게 드래그 제스처 시트가 맞는가

**맞지 않는다.** 이유는 넷이다.
- **보이지 않는 동작**: 끌어 닫기는 손잡이를 보고 짐작해야 하는 동작이다. 어르신은 짐작해야 하는 동작을 시도하지 않거나, 실수로 일으킨다.
- **실수로 닫힘**: 손이 떨리거나 스크롤하려다가 시트가 닫힌다. 다시 여는 길을 모르면 하던 일을 잃는다. 우리 Dialog가 "밖 눌러도 안 닫힘"으로 정한 이유와 같다.
- **TalkBack**: 화면 읽기를 켜면 드래그는 두 손가락 동작이 되어 사실상 쓸 수 없다. 버튼이 따로 반드시 있어야 하므로, 드래그는 덤일 뿐이다.
- **여러 높이(detent)**: 내용이 반쯤 보이다가 끌어 올리면 더 보이는 방식은 200% 글자에서 내용을 숨기는 쪽으로 작동한다.

따라서 규칙은 지금 README §12를 그대로 둔다. **어르신 = 가운데 Dialog, 시트 금지.** 자녀 시트에는 아래 원칙을 적는다.
- 끌어 닫기 **끔**(라이브러리를 쓰면 `dismissible={false}`·`draggable={false}` 또는 `enablePanDownToClose={false}`). 손잡이도 없앤다.
- 닫는 길은 **명시적 X(56dp) + 보조 버튼 + 뒤로 가기**. 밖 누르기는 자녀만 허용한다(지금과 같음).
- 높이는 내용에 맞춘 한 단계. 넘치면 본문만 스크롤하고 버튼은 고정한다(지금과 같음).

이 원칙대로라면 시트 라이브러리의 장점(드래그·detent·스크롤 연동)이 전부 꺼진다. 이것이 "좋은 라이브러리가 많다"에 대한 이 위원의 답이다. 좋은 라이브러리는 맞지만, 그 장점은 우리 사용자에게 해롭거나 쓸모없고, 비용(Reanimated 묶음·TalkBack 퇴보·버전 묶임)만 남는다.

## 4. 채택안

### 빌드 1, 지금
- 새 런타임 의존성 **0개**. §1-3 수정 4건(2~3시간, 추정)을 한다.
- (선택) `eslint-plugin-react-native-a11y` 3.5.1을 devDependency로 넣는다. APK 영향 없음. 추가 결정은 DECISIONS에 1줄.

### 빌드 2, 조건부
| 조건 | 넣을 것 | 함께 들어오는 것 |
|---|---|---|
| S25에서 P6·C0 입력칸이 자판에 가린다(§1-3 ②) | react-native-keyboard-controller 1.23.x | react-native-reanimated 4.7.x + worklets 0.13.x(RN 0.88에 맞는 짝, 확인) |
| 자녀 쪽에 길고 높이를 바꿀 수 있는 시트가 생긴다(예: 가족 여럿 목록) | @lodev09/react-native-true-sheet 4.x(`dismissible={false}`, `draggable={false}` 또는 한 단계 높이) | 없음(Reanimated는 선택). 우리 `useModalFocus` 규칙을 다시 붙이고 TalkBack 실기기 검증 0.5일 |
| Reanimated가 위 이유로 이미 들어왔다면 | 도장 연출을 옮길지 **다시 판단**. 지금 품질에 문제가 없으면 옮기지 않는다 | - |
| iOS를 시작한다 | react-native-haptic-feedback 3.x로 HapticModule.kt를 대체할지 판단(iOS 구현 비용과 비교) | - |

### 넣지 말 것
- **@gorhom/bottom-sheet**: TalkBack 바깥 읽힘(#2772 열림), GH 3·RN 0.88 공식 지원 미확인, 6개월간 릴리스 없음, 열린 이슈(Reanimated 4 스프링·키보드·닫힌 모달이 다시 열림).
- **react-native-actions-sheet**: Reanimated 묶음이 필요하고 메이저 버전이 자주 바뀐다. true-sheet보다 나은 점이 없다.
- **Moti**: 22개월 릴리스 없음.
- **sonner-native**: 토스트 도메인 규칙(1개·announce·모달 멈춤·onExpire)을 다시 짜야 한다. 피어 의존성 7개.
- **lottie-react-native**: 도장이 이미 스펙대로 구현돼 있다. 에셋 제작 비용과 동작 줄이기 분기 비용만 늘어난다.
- **expo-image**: CLI에 Expo 모듈 런타임이 들어온다. **fast-image**: 실측 근거가 없다(나중에 넣는다면 10.x).
- **react-native-nitro-haptics**, **react-native-accessibility-engine**: 초기 단계 / 유지 멈춤.

## 5. 의존성을 넣을 때 지킬 점(빌드 2용)
- 버전은 고정한다(`^` 없이). Reanimated·Worklets·GH는 **RN 마이너와 묶어서** 올린다(Reanimated 피어가 `react-native: "0.86 - 0.88"`로 범위가 좁다).
- DECISIONS 11-18 규칙: 새 의존성 레인은 자기 worktree에 따로 설치한다. main의 `npm ci`는 리드 공지 뒤에만 한다.
- 넣은 뒤 확인할 것: 시트·대화상자의 TalkBack 포커스(열림→제목, 닫힘→연 버튼, 바깥 안 읽힘), 뒤로 가기, 글자 200%, 동작 줄이기, APK 크기 차이(`./gradlew :app:assembleRelease` 전후 비교), 오픈소스 고지(`npm run oss`).

## 출처(11-19 조회)
- npm 레지스트리: registry.npmjs.org/{@gorhom/bottom-sheet, @lodev09/react-native-true-sheet, react-native-actions-sheet, react-native-reanimated, react-native-worklets, moti, react-native-gesture-handler, react-native-haptic-feedback, react-native-nitro-haptics, sonner-native, react-native-keyboard-controller, lottie-react-native, react-native-fast-image, @d11/react-native-fast-image, expo-image, react-native-accessibility-engine, eslint-plugin-react-native-a11y}
- [Reanimated 호환표](https://docs.swmansion.com/react-native-reanimated/docs/guides/compatibility/)
- [Gesture Handler 릴리스](https://github.com/software-mansion/react-native-gesture-handler/releases), [GH 3 업그레이드 안내](https://docs.swmansion.com/react-native-gesture-handler/docs/guides/upgrading-to-3/)
- [@gorhom 이슈](https://github.com/gorhom/react-native-bottom-sheet/issues), [@gorhom props](https://gorhom.dev/react-native-bottom-sheet/props)
- [true-sheet README](https://github.com/lodev09/react-native-true-sheet), [true-sheet 설정](https://sheet.lodev09.com/reference/configuration), [true-sheet 이슈](https://github.com/lodev09/react-native-true-sheet/issues)
- [react-native-haptic-feedback](https://github.com/mkuczera/react-native-haptic-feedback), [sonner-native](https://github.com/gunnartorfis/sonner-native), [keyboard-controller 설치](https://kirillzyusko.github.io/react-native-keyboard-controller/docs/installation), [fast-image](https://github.com/DylanVann/react-native-fast-image), [eslint-plugin-react-native-a11y](https://github.com/FormidableLabs/eslint-plugin-react-native-a11y)
