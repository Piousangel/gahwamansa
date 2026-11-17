# 리뷰: QA 수정 커밋 f7e7428 (B2·B3·B4·B6, n/3, P1·P3, 접근성)

리뷰어: 독립(RN·접근성), 수준 medium, 2026-11-17. 검토만 함(코드 수정 없음).
테스트: `npx jest --maxWorkers=2 qaDeviceSmoke screenTitleFocus previewAndVersion qaP1P3 childOnboarding designSystem screens` 7 suites 81/81 통과. tsc·실기기는 돌리지 않음.

## 지적 (심각도 순)

1. **[중간] R2 제목 포커스가 단계 화면(P4·P5)에서 동작하지 않음** — `features/course/StepHeader.tsx:15-21`은 `View`에 header 역할을 준다. 그런데 등록은 `ui/Text20.tsx:17`(`useScreenTitleRef`)에서만 일어나서 PhotoStep·QuestionStep에는 등록된 제목이 없고, 포커스도 이동하지 않는다. 테스트는 Screen+Text20 조합만 확인해서 이 문제를 잡지 못한다.
   제안: StepHeader의 View에도 `useScreenTitleRef(true)` ref를 붙이고, PhotoStep 진입 후 sendAccessibilityEvent의 대상이 step-header인지 확인하는 테스트를 추가한다.
2. **[중간] 처음 등록한 제목을 계속 붙잡고 있음(오래된 노드)** — `ui/Screen.tsx:414-419`의 `register`는 `title.current`가 비어 있을 때만 값을 넣고, 노드가 언마운트돼도(ref가 null로 호출돼도) 비우지 않는다. CourseHome은 로딩·오류 분기 `<Screen top={<Title/>}>`에서 본 화면으로 바뀌어도 같은 Screen 인스턴스가 유지된다. 그래서 300ms 안에 콘텐츠가 오면 언마운트된 Title로 포커스를 보내고, 실제 제목은 포커스를 받지 못한다.
   제안: Text20 ref가 null로 호출될 때 해당 노드를 해제하는 unregister를 추가한다. 또는 등록 목록을 두고 타이머가 끝나는 시점에 첫 항목을 고른다.
3. **[중간] B2 경로에서 스택이 계속 쌓임** — `features/link/ConnectScreen.tsx:83`의 "코스 보기"는 `navigate('CourseHome')`이다. v7 StackRouter는 현재 화면이 아니면 새로 쌓으므로 `[Connect, CourseHome, Connect(from course)]`에서 누르면 CourseHome이 하나 더 쌓인다. 번호를 넣는 데 성공해도 `navigate('Consent')`, 이어서 Consent가 `navigate('CourseHome')`을 해서 `[.., CourseHome(미리보기), Connect', Consent, CourseHome]`이 된다. 하드웨어 뒤로가 Consent와 예전 코스 홈으로 돌아간다. 설정 경로(`ParentSettings.tsx:132`)도 같다.
   제안: `from==='course'`일 때 "코스 보기"는 goBack(또는 링크 숨김)으로 바꾼다. 번호 성공 시에는 `CommonActions.reset`으로 `[Connect, Consent]`를 만든다. 경로별 스택 길이를 확인하는 테스트도 추가한다.
4. **[낮음] 화면 읽기를 끈 상태에서도 화면마다 타이머와 네이티브 호출이 실행됨** — `ui/Screen.tsx:420-431`. 정리(clearTimeout)는 잘 되어 있고 끈 상태에서는 사실상 아무 일도 하지 않지만, 화면마다 setTimeout과 bridge 호출이 생긴다.
   제안: `AccessibilityInfo.isScreenReaderEnabled()`가 true일 때만 예약한다(또는 구독해 둔 값을 쓴다). 그리고 마운트할 때만 동작하므로 goBack으로 돌아온 화면은 포커스를 다시 받지 않는다. R2의 "화면에 들어오면"을 진입마다로 볼지 결정이 필요하다(useFocusEffect는 ui 레이어 의존이라 Screen 대신 BackBar처럼 app 쪽에 두는 편이 맞다).
5. **[낮음] 스크롤할 때마다 Screen을 다시 렌더링함** — `ui/Screen.tsx:406-411`. `onScroll`이 매번(64ms마다) 새 객체로 setBox를 부르므로 `more` 값이 같아도 Screen이 다시 렌더링된다. children은 같은 element라 비용은 작지만 긴 스크롤에서는 낭비다.
   제안: 측정값은 ref에 두고 boolean `more`만 바뀔 때 setState한다.
6. **[낮음] 위 여백이 모든 화면에서 늘어남(B6 부작용)** — `ui/Screen.tsx:403`. 이전 `max(inset, 20)`에서 `max(52, inset+12)`가 되어 상태바 24 기기 기준으로 모든 화면이 +28px다. 번호 화면 키패드 맞춤(keypadFit 단계 하강)과 B4 사진 화면 공간을 다시 줄인다. 360x780 실기기에서 Connect의 level과 P4 질문 노출을 함께 확인해야 한다.
7. **[낮음] R9 radiogroup 누락** — `features/child/RelationScreen.tsx:59`. SelectCard가 radio가 됐지만 묶음 radiogroup은 QuestionStep에만 있다. "n개 중 m번째" 안내가 빠진다.
   제안: 같은 View(radiogroup)로 감싼다.
8. **[참고] `ui/Text20.tsx:20`의 ref 순서** — React 19에서는 ref가 props로 들어오므로 `{...rest}`가 ref를 덮을 수 있다. 지금은 Text20에 ref를 넘기는 곳이 없어 문제가 없다. 이후 대비로 rest에서 ref를 꺼내 합성하면 안전하다. 안 쓰게 된 `course.continue` 문구 키는 정리 대상이다.

## 문제없음으로 확인한 것
- 테스트 기대값 변경 3종은 모두 근거가 있다. ① 미연결에서도 설정 노출(QA B3, dev-app-notes 240) ② 주 버튼 = 단계 이름(DECISIONS 173) ③ SelectCard `button/selected`에서 `radio/checked`(talkback-spec R9). `pressCourseNext`도 의도를 유지한다.
- 미연결 설정은 보여 주기·지우기를 숨기고 "번호 쓰기"만 둔다(`ParentSettings.tsx:92-134`). 동작하지 않는 버튼은 노출되지 않는다.
- 요일 도장 라벨(`StampRow.tsx:267-268`)은 P3-5대로 찍은 요일만 읽는다. 페이드는 hidden이고 pointerEvents none이다. fill 화면에서는 페이드를 끈다.
- ARCHITECTURE §2: 새로 생긴 features→app import는 없다(기존 ParentStack·session 사용만 있음). 기능 간 import도 없다. ui/screenTitle은 features를 모른다.
