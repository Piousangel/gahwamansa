# 2026-11-18 p7-followup-ux 브랜치 리뷰 (독립 리뷰어)

- 대상: `p7-followup-ux` a36472a(P7 후속), ef4041b(어르신 UX U4·U5·U6·U8·U9·U13)
- 기준 main: 요청은 62a68aa 기준이었고, 리뷰 시점 main 48fa892(62a68aa 뒤 문서 커밋 2개)와 대조했다.
- 기준 문서: DECISIONS 11-18 UX 승인, `docs/design/v3/_qa/ux-improvements-2026-11-18.md`, `P7_motion.dc.html`, `talkback-spec.md`
- 방법: 별도 worktree에서 실행, 코드 수정 없음. 줄 번호는 ef4041b 기준.

## 실행 결과

| 항목 | 결과 |
|---|---|
| `git merge-tree main p7-followup-ux` | 충돌 없음 |
| `git merge-tree p7-followup-ux dev-menu` | **충돌 3파일**: `app/src/copy/copy.ko.json`·`docs/team/copy.ko.json`(settings 끝 키: 이 브랜치 group_*·share_scope·_status ↔ dev-menu `version`), `ParentSettings.tsx`(import 줄, 앱 정보 구역: 이 브랜치 SettingsGroup/SettingsRow ↔ dev-menu 버전 줄·7번 탭 `version-tap`). ConnectScreen·CodeEntry는 충돌 없음 |
| `npx tsc --noEmit` | 통과 |
| `jest --testPathIgnorePatterns __integration__ --maxWorkers=2` 2회 | 2회 모두 70 suites / 680 tests 통과(41.9초, 37.5초, 부하 load 6~7) |
| 추가 확인(임시 테스트, 지움) | 실제 흐름(사진 보기 → 다 봤어요 → 코스 홈)에서 `useAfterTransition` 대기 경로가 **한 번도 쓰이지 않음**(호출 기록 `[]`) — M1 참조 |

## 높음

없음.

## 중간

### M1. 단계 체크가 여전히 전환 중에 시작한다: 대기 경로를 타지 않음
- `app/src/features/course/CourseHome.tsx:58~61`
- `useAfterTransition` 훅 자체는 맞게 짰다. transitionEnd(closing=false)와 폴백 600ms 중 먼저 오는 쪽에서 한 번 실행하고, 정리도 한다.
- 문제는 훅에 일을 맡길지 정하는 조건이 `navigation.isFocused()`라는 점이다.
  - `useFinishStep`의 `applyStep` 직후에 `await` 한 번(microtask)을 거쳐 `popTo`가 실행된다.
  - React의 리렌더와 effect는 그 뒤에 실행된다(이벤트 밖 setState라 스케줄러 작업으로 미뤄짐).
  - 내비 상태는 popTo에서 동기로 바뀌므로, effect가 실행될 때 `isFocused()`는 이미 true다. 그래서 `setJustDone`이 바로 실행된다(pop 전환 시작 시점).
  - 임시 테스트로 확인했다. 실제 흐름에서 대기 경로 호출이 0회였다.
- 결과: 체크 모션 600ms가 전환(약 300ms)과 겹친다. 지난 재검토의 M1이 그대로다.
- `elderUx` 테스트는 훅만 따로 검증하고, p7Motion 테스트는 즉시 경로로도 통과해서 이 문제를 잡지 못한다.
- 훅 쪽 빈틈도 있다. 일을 `focus` 이벤트 **뒤에** 맡기면 폴백 타이머가 걸리지 않는다(타이머는 focus 리스너에서만 설정). 전환 이벤트까지 이미 지나갔으면 그 일은 영영 실행되지 않는다.
- 권장
  - `blur` 때 `covered=true`, transitionEnd(closing=false) 또는 폴백 때 `false`로 두는 ref를 만들고, `covered`이거나 전환 중이면 대기에 맡긴다.
  - 맡기는 시점이 이미 focus 뒤면 그 자리에서 폴백 타이머를 건다.
  - 통합 테스트에서 "전환 끝 전에는 step-check-anim 없음"을 단언한다(native-stack transitionEnd를 emit하거나 폴백 타이머를 fake timer로).

### M2. U4 이후 번호 화면 공간 단계와 예산 테스트가 실제와 어긋남
- `app/src/features/link/ConnectScreen.tsx:77`(주석 "1단계 안심 줄 숨김" 그대로), `app/__tests__/connectFit.test.tsx`의 `keypadArea`(`lv >= 1 ? 0 : 46`)
- 안심 줄을 항상 보이게 하면서 1단계는 아무것도 줄이지 않는 단계가 됐다(레이아웃 한 번 낭비, 동작 문제는 없음).
- 예산 테스트 모델은 여전히 1단계에서 46dp를 뺀다. 그래서 아래 기기 시나리오 테스트들이 사실과 다른 근거로 통과한다.
- 안심 줄을 넣고 같은 모델로 다시 계산한 결과:

| 기기 | 이전 | 지금 |
|---|---|---|
| 갤럭시 S25(780dp, 24/48) | 1단계에서 들어감 | 3단계(링크가 위 줄)에서 들어감 |
| 360×640 제스처(하단 16) | 3단계에서 딱 맞음(394) | 영역 348 < 394 → **4단계(본문 스크롤)** |

- 320×640·200%는 원래 스크롤 모드라 깨지지는 않는다(키 64, 잘림 없음, 시안 초안도 허용).
- 다만 360×640 **100%**에서도 키패드 마지막 줄을 보려면 스크롤해야 한다. U4 문서가 예상한 범위(200%만 스크롤)보다 넓다.
- 권장
  - 단계를 `제목 줄임 → 링크 위로 → (안심 줄 1줄 고정·작은 글자) → 스크롤`로 다시 짜거나, 360×640 100% 스크롤을 디자이너가 허용하는지 확인한다.
  - 예산 테스트의 `lv >= 1 ? 0 : 46`을 고치고 S25·360×640 기대값을 갱신한다.

### M3. dev-menu와 충돌 3파일: 해결 방향을 미리 정할 것
- 설정 앱 구역에 dev-menu의 버전 줄(production이면 글자, staging·개발이면 7번 탭 Pressable)을 넣어야 한다.
- 권장: `SettingsRow`에 버전 행을 추가하고 `onPress={versionTap}`(허용될 때만)으로 둔다. 허용 안 되면 `onPress` 없이 글자 행으로 둔다. 보안 리뷰 L1의 "production은 누르는 요소가 아님"이 유지된다.
- copy는 두 쪽 키를 모두 둔다. 먼저 합치는 쪽이 정해지면 나중 브랜치가 main을 병합해 해결한다.

## 낮음

- **L1. 도장 응답이 1.5초 뒤 늦게 오면**: `CourseDone.tsx:76`
  - `week`가 null(포기)에서 실제 값으로 바뀌면 도장 줄이 뒤늦게 생겨 본문이 움직인다.
  - 문구도 바뀔 수 있다("도장을 찍었어요" → "오늘 첫 도장을 찍었어요").
  - 권장: 포기한 뒤에는 그 화면에서 결과를 무시하거나, 연출이 끝난 뒤에만 반영한다. 제목 고착 해결은 확인했다(시간 제한·정리 OK).
- **L2. U5 조건**: 시안 초안은 "알림이 꺼져 있으면 문장을 뺀다(약속하지 않음)"인데 연결 시 항상 나온다.
  - 지금은 알림 기능이 없어 '내일 새 사진'은 앱 안에서 사실이다.
  - 푸시(0032~)가 생길 때 조건을 붙여야 한다는 TODO를 남길 것. `next_photo`·`next_photo_time`은 라이터 확인 전 초안(_status 표시 OK).
- **L3. U13 '오늘 코스로'**: `ToCourseHomeLink`가 `popTo('CourseHome')`만 해서 기록 호출이 없다(테스트 확인). 150% 이상·자판 열림·오류·보기 전용에서는 숨긴다.
  - 다만 주 버튼이 저장 중(`busy`·`saving`)일 때도 눌린다. 기록이 진행 중에 떠나면 그 뒤 `popTo`가 한 번 더 불리고, 언마운트 뒤 setState가 생긴다.
  - 권장: `SkipLink`처럼 `disabled={busy}`.
  - DECISIONS의 "(100%만)"과 구현의 "150% 미만"(130%에서도 보임)이 다르다 → 표현을 한쪽으로 맞출 것.
- **L4. U8 접근성**: 역할(누르는 행 button·글 행 text·구역 header)과 터치 64(`size.touchMin`)는 맞다.
  - 누르지 않는 '앱 정보' 행은 보조 글을 `accessibilityHint`로 둔다. 힌트는 동작 설명용이라 기기 설정에 따라 읽히지 않는다 → 라벨에 합칠 것(`${title}, ${sub}`).
  - '가족에게 답 보여 주기' 행은 '›'가 있어 다른 화면으로 가는 것처럼 보이지만, 실제로는 같은 화면에서 확인 패널을 여닫는다. 거부한 사람이 띠 '다시 정하기'로 왔을 때 예전의 큰 '다시 보여 주기' 버튼이 없어졌다 → 디자이너·라이터 확인.
- **L5. 회귀**: 동의 철회(확인 후에만 호출, 실패 시 상태 유지)·다시 동의·'그대로 둘래요'·도장 소리 토글(위험 행 위, 스위치 1개)·모두 지우기(맨 아래, P9 두 단계 그대로)는 기존 테스트를 갱신해 모두 통과했다. 미연결이면 모두 지우기 행이 없는 것도 이전과 같다.
- **L6. U9 keyTap 네이티브**: `HapticModule.keyTap()`은 `runOnUiThread`에서 실행하고, `currentActivity?.window?.decorView?.`로 뷰가 없으면 조용히 넘어간다. `KEYBOARD_TAP`은 시스템 '터치 진동' 설정을 따르고 권한도 필요 없다. JS `hapticKeyTap`은 try/catch, 모듈이 없으면(iOS·테스트) 아무것도 안 한다. 빠른 연타는 UI 스레드에 쌓이지만 가벼워서 문제없다.
- **L7. `testTimeout: 20000`**:
  - 부작용 1: 진짜로 멈춘 테스트가 실패하기까지 20초씩 걸린다.
  - 부작용 2: 느려진 테스트(성능 회귀)를 가린다.
  - 이번 실행 시간은 약 40초로 늘지 않았다. 흐름 테스트에 필요한 조치라 유지해도 되지만, 한 파일 실행 시간이 크게 늘면 보는 습관을 둘 것. 통합 설정(30000)은 따로라 영향 없다.
- **L8.** U6 StampRow(지난 빈 날 원 없음·오늘 굵은 점선·이후 연한 점선, 읽기는 찍은 날만)는 시안 초안과 일치한다. 완료 해님 제거·인주 `brandSealDeep #C44F2E`도 DECISIONS 11-18과 일치한다. copy JSON 두 벌이 같고 중복 키도 없다.

## 합치기 판정

**조건부 합치기.**
- M1(단계 체크 시점)은 두 번째 지적이고 원인이 분명하다(`isFocused` 조건). 이 브랜치에서 고친 뒤 합치기를 권장한다.
- M2는 예산 테스트 갱신 + 360×640 100% 스크롤 허용 여부 확인이 필요하다(디자인 확인 뒤 같은 브랜치 또는 바로 후속).
- M3는 dev-menu와 합치는 순서를 정하고, 나중 브랜치에서 위 방향으로 해결한다.
- 낮음은 후속으로 처리한다.
