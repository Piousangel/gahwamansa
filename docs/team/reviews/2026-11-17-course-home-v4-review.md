# 리뷰: P3 코스 홈 v4 (`p3-course-home-v4`, c168c16·b0069cf)

- 리뷰어: 독립 리뷰어(작성자와 다름), 2026-11-17. 코드는 고치지 않았다.
- 비교 기준: main merge-base `cbabdf5`. 리뷰하는 동안 main이 `8fd6df2`로 나아갔다(design v24~v26, copy 11-7, DECISIONS "미연결 완료·도장 출처"). **기준은 최신 동결본(main `8fd6df2`)으로 잡았다.** `git merge-tree` 결과 main과 충돌은 없다(main은 cbabdf5 이후 app/ 변경 0).
- 기준 문서: `P3_course_home_v4.dc.html`(main 판), ease-and-joy SUMMARY B·D, copy-v3-confirmed 11절(11-7 포함), ARCHITECTURE §6, talkback-spec P3.

## 검증 실행
| 항목 | 결과 |
|---|---|
| `npx tsc --noEmit` (b0069cf 분리 worktree) | 통과(exit 0) |
| `npx jest --testPathIgnorePatterns __integration__ --maxWorkers=2` | 59 suites / 516 tests 통과 |
| 통합 테스트 | 실행 안 함(지시대로 제외) |
| 기기·320×640·200% 화면 | 실행 안 함. 아래 넘침 판단은 코드 계산이다 |

## 판정: **수정 뒤 합치기**(지금 상태로는 합치지 않음)
높음 3건을 고쳐야 한다. 문구 1건과 미연결 띠·상단 고정 영역 배치 2건이다. 토큰 변경(①)과 P4 보기 전용(③)은 구조가 맞다. 높음 3건이 해결되면 중간 항목은 이어지는 PR로 나눠도 된다. 다만 M1(행 아이콘·높이)은 이 PR에서 함께 고치기를 권한다.

---

## 높음

### H1. 미연결 완료 문구 "오늘 코스를 다 봤어요"는 확정문이 아니다(⑥)
- `app/src/features/course/CourseHome.tsx:138`, `app/src/copy/copy.ko.json:346,349`(원본 `docs/team/copy.ko.json`도 같음), `app/__tests__/courseHomeV4.test.tsx:142-161`
- copy 11-7 #18은 `course.done_unlinked`를 이렇게 확정했다: "오늘 코스를 마쳤어요" + 다음 줄 "번호를 받으면 그때부터 고른 답이 가족에게 보여요". "오늘 코스를 다 봤어요"는 **채택되지 않은 대안**이다. 동결 시안(main 판)의 '미연결 3/3' 보드도 같은 두 줄을 쓴다(인사 24/32, 둘째 줄 20/30 bold #744821).
- DECISIONS 11-17 결정과도 어긋난다. 연결 전 완료는 기기에만 남고 가족에게는 보이지 않는다. 그런데 이 문구는 '가족에게 언제 보이는지'를 알려 주지 않는다. "다 봤어요"는 P4 버튼 이름("다 봤어요" = 사진 단계 완료)과도 겹친다.
- 테스트 `queryByText(/도장/)` null(160줄)은 최신 결정(미연결도 기기에서 도장이 찍힘)과 반대 동작을 고정한다.
- 권장: `done_preview`를 지우고 `done_unlinked`(두 줄)를 원본 copy에 추가한 뒤 sync한다. `_status` 줄도 고친다. 테스트는 두 줄을 확인하도록 바꾸고, 도장 단언은 M5가 끝날 때까지 지운다.

### H2. 미연결 띠가 시안·talkback과 다르고, 200%에서 상단 고정 영역이 화면을 넘는다
- `CourseHome.tsx:111-117, 193-194`
- 시안(미연결 보드)과 다른 점:
  - **위치**: 시안은 날짜 줄·링크 줄 **아래**, 스티치 위에 둔다. 코드는 날짜 위에 둔다. talkback-spec P3도 "연결 끊김 줄: 날짜 다음 순서"라서 R1 읽는 순서를 어긴다.
  - **형태**: 시안은 띠 전체가 하나의 링크(`<a>`)다. 흰 면, 3px `#744821` 테두리, 반경 18, 패딩 12/16, `flex-wrap`, 글 `flex:1 1 200px` bold 20/30, 오른쪽 "번호 쓰기 ›" 20/28 밑줄 nowrap. 코드는 옅은 면에 테두리가 없고, 글은 보통 굵기다. 링크는 따로 있는 TextLink "번호 쓰기"('›' 없음, 터치 48)다. 옅은 면·테두리 없음은 시안의 **동의 거부 띠** 모양이라 둘이 뒤바뀌었다.
  - **읽기**: talkback-spec은 "번호를 받으면 그때부터 답이 저장돼요, 버튼" 한 덩어리로 읽는다. 코드는 글과 버튼으로 나뉜다.
- 넘침(코드 계산, 320×640, 글자 200%): 띠는 `flexDirection:row`에 `flexWrap`이 없다. 그래서 링크(30px 글자 약 135px)가 자리를 차지하면 글 열은 약 100px만 남는다. 40px 글자에 keep-all이면 한 줄에 2~3자라 7줄 이상(약 60px × 7 = 420px+)이 된다. 띠는 `Screen top`(스크롤 없음, 높이 제한 없음)에 있다. 여기에 날짜 줄과 dock 최대 40%(256px)를 더하면 본문 높이가 0이 되고, 단계 행이 보이지 않는다. 같은 squeeze는 main에도 있던 문제다. 이 브랜치는 세로 패딩 12를 더하고 날짜 줄까지 top에 올려 더 나빠졌다.
- 권장: 띠를 하나의 Pressable(role button, label = 띠 문장)로 만들고 시안 스타일을 1:1로 옮긴다. `flexWrap:'wrap'`과 글 `flexBasis` 200도 넣는다. 위치는 날짜 줄 아래·스티치 위이고, H3대로 본문(스크롤) 안에 둔다.

### H3. 날짜 줄·설정·스티치를 고정 상단(`top`)에 올렸다. 시안은 전부 본문 스크롤 안에 있다
- `CourseHome.tsx:109-124`
- 시안의 모든 보드에서 날짜 줄·설정·링크 줄·띠·스티치는 `data-body`(스크롤) 안에 있다. 고정은 상태 표시줄 52px뿐이다. 코드는 `Screen top`에 두었다. main에서는 날짜 줄이 본문에 있었다.
- `Header size={22}`는 22 < 28이라 `maxFontSizeMultiplier` 2.0을 받는다(FONT_SCALE_MAX_BODY). 고정 영역의 제목인데 1.5 상한을 받지 않는다(TopBar는 `FONT_SCALE_MAX`를 명시한다). 320 폭·200%에서 날짜 "11월 20일 금요일"(44px)은 설정 링크 옆에서 2~3줄(64px × 3)이 된다. 그만큼 연결 상태에서도 본문이 약 70px 줄어든다.
- 권장: top을 비우거나 최소로 줄이고, 날짜 줄 묶음을 본문으로 옮긴다. R2 첫 포커스는 `ScreenTitleContext` body 등록으로 그대로 동작한다(Screen.tsx `bodies`). top에 남겨야 한다면 Header에 `maxFontSizeMultiplier={FONT_SCALE_MAX}`를 주고 띠는 본문으로 옮긴다.

---

## 중간

### M1. 했어요 행의 체크 아이콘이 없고, '›'를 글자로 그려 64 리듬이 깨진다(②④)
- `app/src/ui/StepRow.tsx:45-52, 86`
- 시안의 했어요 행은 상태 묶음 `[체크 svg 20×20 #166534, stroke 3] + gap 6 + "했어요"`이고, 완료 때만 `[› svg 22×22 #14532D]`가 붙는다. 코드에는 체크가 없다. '›'는 `Text20 size 28 oneLine`(줄 높이 36)이다. 바닥선 정렬 행에서 36짜리 줄이 끼면 그 행은 약 16+36+16 = 68이 되고, 다른 했어요 행(64)과 높이가 달라진다. v4가 고치려던 '행 어긋남'이 다시 생긴다.
- `icon-check`·`icon-chevron-right`는 이미 `ui/assets/icons.tsx`에 있으니 지금 넣는 비용은 작다. 체크는 색 말고도 상태를 구분하는 단서라서 접근성 면에서도 이득이다.
- 권장: 상태를 `View{flexDirection:'row', alignItems:'center', gap:6}`로 묶어 [Icon check 20] + 라벨 + (onPress면 Icon chevron 22)로 만든다. 테스트에 "› 있는 행과 없는 행의 줄 높이가 같다"를 추가한다.

### M2. 완료 뒤 '›'가 사진 행에만 있다. 시안은 세 행 모두
- `CourseHome.tsx:93, 152-153`
- 시안 3/3 보드는 세 했어요 행이 모두 링크(›)다. SUMMARY B도 "세 단계 전부 보기 전용"이다. 코드 주석의 "④ 시안 뒤 추가"는 이미 지난 일이다. `P5_P6_review.dc.html`이 동결됐다(DECISIONS 11-17, copy 11-7 #17a·b).
- 지금은 한 행에만 '›'가 있어 화면 안에서 앞뒤가 맞지 않는다. 권장: 이 PR에서 P5·P6 보기 전용까지 넣거나, 넣지 않을 거면 세 행 모두 '›' 없이 두고 하단 버튼만 남긴다(일관성 우선). 결정은 DECISIONS에 기록한다.

### M3. 스티치 위아래 간격이 시안과 다르다
- `CourseHome.tsx:118-123`, `ui/tokens.ts` `layout.bodyPadding.top: 4`
- 시안: 날짜 줄 → (링크 줄) → 스티치 → 인사 묶음이 모두 구역 간격 24다. 코드: 스티치가 titleRow 바로 아래(0)에 붙고, 스티치 → 인사는 본문 paddingTop 4다. H3에서 본문으로 옮길 때 구역 간격 24(본문 gap 16 + 8 또는 묶음 gap 24)로 맞춘다.

### M4. 동의 거부 상태가 시안 '한 줄' 보드와 다르다
- `CourseHome.tsx:141-147, 197`
- 시안 "동의 거부 · 한 줄"은 날짜 아래에 옅은 면 `#F1E4D4`, 테두리 없음, 패딩 12/16인 한 줄 띠를 둔다. 글은 "고른 답은 저장되지 않아요"(`course.declined_banner`, copy 6절 확정), 링크는 "다시 정하기"다. 코드는 4px 테두리 상자에 `consent.title`과 큰 보조 버튼을 넣은 기존 모양이다. main에서 이어진 문제지만 동결 P3 v4의 한 상태이므로 1:1 범위에 들어간다.

### M5. 미연결 도장 줄(기기 로컬)이 빠졌다. 최신 결정과 전제가 반대다
- `CourseHome.tsx:36-54, 136, 140`
- DECISIONS(8fd6df2): 미연결도 도장은 기기에서 찍힌다. 기기 로컬에 이번 주 완료 날짜만 두고, 연결 뒤에는 서버 값만 쓴다. 시안 main 판도 미연결 보드에 도장 줄을 보인다. 코드 주석 "미연결 완료는 도장이 없으므로"와 `preview ? null` 숨김은 옛 전제다.
- 저장소 작업이 필요해서 이 PR 범위 밖이어도 된다. 다만 주석과 테스트(H1)를 지금 고쳐 두고 후속 작업으로 등록한다.

### M6. 줄 높이 표가 토큰 원본에 없고, 36 초과 크기는 외삽한 값이다(①)
- `app/src/ui/tokens.ts:55-58`, `design-system/tokens-v3.json:589-597`
- ARCHITECTURE §1·§6: 앱 `ui/tokens.ts`는 `tokens-v3.json`의 사본이다(토스·백오피스도 원본만 쓴다). `lineHeightFor`·`labelLineHeight`는 사본에만 있다. 원본의 `lineHeight` 비율(1.3/1.35/1.5)은 이제 Text20에서 쓰이지 않는데 그대로 남아 있다.
- 표는 20~36만 정했는데, 식(+12)이 44·72에도 적용된다. 44: 57→56(문제 없음). **72: 94→84(−10)**: `features/home/ChildHome.tsx:149` 자녀 C4 고른 답(72, 배율 1.5면 108/126). RN Android `CustomLineHeightSpan`은 줄 높이가 글꼴 기본 높이보다 작으면 ascent를 줄인다. Noto CJK(약 1.45em)는 ascent가 약 0.88em까지 줄어 한글 윗획이 잘릴 수 있다. 기기 확인이 필요하다.
- 권장: 표를 `tokens-v3.json`(`lineHeightTable` 등)에 넣고 designSystem.test로 동기를 확인한다. 36 초과는 `max(size + 12, round(size × 1.3))`처럼 정의한다. 아니면 72 자리에 명시 값을 준다.

### M7. 테스트가 확인하지 않는 곳(⑤)
- 바뀐 18개 파일의 대부분은 `getByText('오늘의 코스')`를 `getByTestId('date-line')`으로 기계적으로 바꾼 것이다. 같은 수준으로 확인하고 있어 약해지지 않았다. `courseDone`의 "dock 없음"을 "다시 보기 버튼 있음"으로 바꾼 것과 `previewAndVersion`의 완료 문구 교체도 시안 변경에 맞는 교체다. `testUtils/flow.courseHomeShown`이 날짜 줄과 '오늘의 코스'를 모두 받는 것도 이전과 같은 강도다(예전 제목도 모든 상태에 있었다).
- 빈 곳:
  1. 보기 전용 "기록 0회"는 `recordSessionStep`만 확인한다(`courseHomeV4.test.tsx:100,113`). `logEvent`·`startToday`·`getTodayContent` 추가 호출 0회와 `saveAnswer` 0회도 확인한다. 코드상 경로는 없지만 회귀를 막는 장치가 필요하다.
  2. 보기 전용에서 **하드웨어 뒤로가기**(BackHandler)와 상단 '‹ 오늘 코스'가 코스 홈으로 돌아가는지 확인하지 않는다.
  3. StepRow 체크 아이콘과 '›' 행 높이(M1)를 확인하지 않는다.
  4. H1의 잘못된 문구·도장 단언.
  5. 띠의 읽기(한 덩어리 버튼)와 위치(날짜 다음)를 확인하지 않는다. `courseHomeV3.test.tsx:27`이 "터치 48 이상"을 그대로 고정하고 있어서, 어르신 기준 64로 올려야 한다.

---

## 낮음
- L1. 시안 숫자와 작은 차이(시안 자체가 표와 어긋나는 곳 포함): 인사 24의 줄 높이는 코드 34, 시안 32(`CourseHome.tsx:137`). 했어요·다음 차례 상태 줄 높이는 코드 28(라벨), 시안 30(`StepRow.tsx:45`). 날짜 굵기는 코드 bold, 시안 900. 디자인에 "인사·상태는 표(34·30)와 라벨(32·28) 중 어느 쪽인지"를 한 줄로 확인받는다.
- L2. 지금 행 테이프가 `width 140 × height 28` 고정이다(`StepRow.tsx:28,82`). 시안은 라벨 배경이 내용 크기를 따른다(패딩 0 12, 높이 28, 왼쪽 −6). 200%에서 "지금 할 차례"(40px, 줄 높이 56)는 140×28을 넘는다. 이전 36보다 높이가 줄어 더 드러난다. 테이프를 라벨 뒤에 `top/bottom/left/right` 채우기로 두기를 권한다.
- L3. 완료 하단 '오늘 코스 다시 보기'는 시안에서 아이콘 + 최소 높이 72 + 글자 26/34다. 코드는 BigButton 보조(64, 아이콘 없음)다. 명세 §1(보조 64)과 시안이 다르니 디자인에 확인한다.
- L4. 보기 전용에서 '돌아가기'로 돌아오면 CourseHome이 다시 마운트되지 않아 날짜 줄로 포커스가 가지 않는다(Screen 제목 포커스는 마운트 때 한 번). 기존 단계 화면에서 돌아올 때와 같은 동작이라 이번 PR 범위는 아니다. 뒤에 `useFocusEffect`로 제목 포커스를 되돌릴지 검토한다.
- L5. 상단 '‹ 오늘 코스'와 하단 '돌아가기'의 읽기 라벨이 둘 다 "오늘 코스로 돌아가기"다. copy 11-1 #3대로이므로 문제는 아니고 기록만 해 둔다.
- L6. `CourseHome.tsx:91-93` 주석("날짜 줄이 위 고정 제목", "④ 시안 뒤")은 H3·M2를 고친 뒤 갱신한다.

## ③ P4 보기 전용 확인 결과(문제 없음)
- `PhotoStep.tsx:47-53`: review면 하단은 '돌아가기'(`toCourseHome` = `popTo('CourseHome')`)만 있다. `go`(= `finish` → `recordSessionStep`·`track`)로 가는 경로가 없다. `useFinishStep`은 마운트되지만 부수 효과가 없다. `start_today`는 CourseHome 마운트 때 한 번뿐인데, `popTo`로 돌아오면 다시 마운트되지 않으므로 다시 부르지 않는다. **기록 RPC·이벤트 0회는 코드상 맞다.**
- 하드웨어 뒤로가기: `BackBar course onBack`이 `useBackAction`으로 같은 `popTo`를 등록한다. 맞다(테스트 없음 → M7).
- 제목: `StepHeader review`면 "1 / 3"을 숨기고 "사진 보기, 다시 보는 중"으로 읽는다(11-2 #11b). P4_zoom_review B2 보드와 같다.

## ④ 누락 요소 판정
| 요소 | 지금 넣나 | 이유 |
|---|---|---|
| 했어요 행 체크 아이콘 | **넣는다**(M1) | 아이콘이 이미 있고, 행 높이 64 리듬과 색 외 구분 단서 |
| '번호 쓰기 ›' + 띠 전체 버튼 | **넣는다**(H2) | 동결 시안·talkback 순서·어르신 터치 64 |
| 완료 '›' 세 행 | 이 PR이나 바로 다음 PR(M2) | P5_P6_review가 동결돼 막힌 이유가 없다 |
| 지난 날 보기 | 넣지 않는다 | P15 화면이 없다(빌드1 조건부). 죽은 링크 금지. 시안의 링크 줄(위 −16·아래 −8 마진)이 빠진 상태의 간격을 진행 기록에 남긴다 |
| 음악 켜기 | 넣지 않는다 | 배경 음악 기능이 아직 없다(`lib/audioPolicy.ts`뿐). 기능 PR에서 날짜 줄 아래 링크 줄과 함께 넣는다 |

## ① 토큰 변경의 다른 화면 영향(코드 계산)
줄 높이 변화(이전 비율 → 새 표): 20: 30→30, 22: 33→32(−1), 24: 32→34(+2), 26: 35→36(+1), 28: 36→38(+2), 30: 39→40(+1), 32: 42→44(+2), 36: 47→48(+1), 44: 57→56(−1), 72: 94→84(−10). 200%에서는 28 미만이 ×2, 28 이상은 ×1.5다. Text20을 쓰지 않는 BigButton·SelectCard·RoleChoiceButton·BackBar·TextLink·SocialButton은 영향이 없다. `fontSize.body/bodyMin/bodyLg`는 src에서 쓰는 곳이 0이라 이름 변경의 영향은 테스트뿐이다.

**잘림·넘침 위험이 있는 곳(스크롤 없는 고정 영역 또는 fill 화면)**
| 화면 | 위치 | 바뀐 크기 | 위험 |
|---|---|---|---|
| P3 코스 홈 | `CourseHome.tsx:109-124` top | 날짜 22(top으로 이동), 띠 | **높음**: H2·H3 |
| 자녀 C4 홈 | `ChildHome.tsx:149` 고른 답 72 | −10 | **중간**: Android 윗획 잘림, 기기 확인(M6) |
| 첫 화면(FS) | `RoleSelect.tsx` fill: dock 질문 28, 워드마크 28, 소개 제목 24 | +2~+3/줄 | 낮음: 사진 영역이 흡수하고, 150% 이상은 소개를 숨기고, 아주 크면 fullScroll |
| P1 번호 | `ConnectScreen.tsx` fill: 제목 26, 오류 24 | +2~+4/줄(200%) | 낮음: 키패드 영역을 재고 overflow 때 스크롤로 전환 |
| P4~P6 | `StepHeader.tsx` top: 26 / 22 | +2 / −2(200%) | 낮음 |
| C3·C4·C5 | `TopBar.tsx` top 24(상한 1.5) | +3/줄 | 낮음 |
| P8·확인창 | `Dialog.tsx` 제목 32(스크롤 밖) | +3/줄 | 낮음(본문은 스크롤) |
| 시트 | `BottomSheet.tsx` 제목 24(상한 1.5) | +3/줄 | 낮음 |
| P4~P6 오류 | `StepError` 24(dock 안) | +4/줄 | 낮음(dock 40% 안에서 스크롤) |

본문 스크롤 화면(P2 동의, P7 완료, P13 설정, 계정 삭제, C0 로그인, C1 호칭, C3 대기, C5 기록)은 길이만 늘어나고 잘리지 않는다.

## 권장 수정 순서
1. H1 문구(원본 copy → sync → 테스트)
2. H3 + H2 + M3: 상단 묶음을 본문으로 옮기고, 띠를 시안 1:1(전체 버튼, wrap, 날짜 다음)로, 간격 24
3. M1 체크·› 아이콘 + 높이 테스트
4. M7-1·2 테스트 보강
5. (후속) M2 P5·P6 보기 전용, M4 동의 거부 띠, M5 기기 도장, M6 토큰 원본 이관과 72 확인

---

## 재검토 (95d11cd main merge · a137e2f · e8649d1)

### 검증 실행
| 항목 | 결과 |
|---|---|
| `npx tsc --noEmit` (e8649d1 분리 worktree) | 통과(exit 0) |
| `npx jest --testPathIgnorePatterns __integration__ --maxWorkers=2` | 60 suites / 528 tests 통과 |
| `git merge-tree` main ↔ 브랜치 | 충돌 없음 |
| `git merge-tree` 브랜치 ↔ `child-ease-joy` | **충돌 3파일**: `app/src/app/ParentStack.tsx`(이쪽은 `review` 파라미터, 저쪽은 `Connect.prefill`), `app/src/copy/copy.ko.json`·`docs/team/copy.ko.json`(이쪽 `review.*` 키, 저쪽 `first.code_found`·`connect_confirm`·`safe`·`legal`). 양쪽을 다 살리면 되는 기계적 충돌이다. 나중에 합치는 쪽이 원본 copy를 고친 뒤 sync한다 |
| 통합 테스트·기기 200% 실측 | 실행 안 함 |

### 이전 지적 해결 여부
| 항목 | 상태 | 근거 |
|---|---|---|
| H1 미연결 완료 문구 | 해결 | `done_unlinked`·`done_unlinked_sub`(11-7 #18), P7 `unlinked_body`(#19). 테스트도 두 줄 기준으로 바뀜 |
| H2 미연결 띠 | 해결 | 날짜 다음, 본문 안, 띠 전체 Pressable(role button·라벨 = 띠 문장), 흰 면·3px·반경 18·12/16·wrap·flexBasis 200, 최소 높이 64. 남은 차이는 낮음 R5 |
| H3 상단 고정 | 해결 | `Screen top` 없음. 날짜 Header는 `maxFontSizeMultiplier=FONT_SCALE_MAX` |
| M1 체크·› | 해결 | `icon-check` 20 + 라벨 + `icon-chevron-right` 22. 줄 높이가 같다는 테스트도 추가됨 |
| M2 세 행 › | 해결 | 세 단계 보기 전용(Question·Keyboard `review`) |
| M3 스티치 간격 | 해결 | 스티치 위아래 8 + 본문 gap 16 = 24 |
| M4 동의 거부 띠 | 해결 | `declined_banner` + '다시 정하기'(→ 설정). ③ 참고 |
| M5 기기 도장 | 해결 | ② 참고 |
| M6 토큰 원본·36 초과 | 해결 | `tokens-v3.json lineHeightTable` 추가, designSystem.test 동기 검사, 36 초과는 `max(+12, ×1.3)` → 72는 94(이전과 같음, 잘림 위험 없어짐) |
| M7 테스트 | 대부분 해결 | 보기 전용에서 recordSessionStep·logEvent·startToday·getTodayContent·saveAnswer 호출 수가 변하지 않는지 확인함. 상단 '‹ 오늘 코스' 복귀도 확인. 하드웨어 뒤로가기(BackHandler) 직접 테스트는 없음(같은 `onBack`을 쓰므로 낮음) |

### 요청 확인 ① 공용·app/ 변경
- `ParentStack.tsx:16`: 세 단계에 `{review?: boolean} | undefined`. 진행 경로(`navigate(current.route)`)는 파라미터 없이 그대로라 영향이 없다.
- `session.tsx`·`AppRoot.tsx:103` `applyAnswer`: `saveAnswer` 성공 뒤에만 `answered_choice`를 바꾼다(`QuestionStep.tsx:41`). `consent_required`로 실패하거나 미연결·거부면 바꾸지 않으므로 보기 전용에서 '고른 답'이 생기지 않는다(11-3 "거부·철회 날은 줄을 뺌"과 맞음). 철회 때 비우는 일은 기존 `setConsented(false)`가 맡는다.
- `StepRow.tsx`: 상태 묶음 View(row, center, gap 6). 바닥선 정렬 행 안에서 이 묶음의 기준선은 첫 자식인 체크 svg의 아래 끝이 된다(Yoga). 시안 CSS도 inline-flex 안 svg 아래 끝이 기준선이라 결과가 같다. 기기에서 한 번 눈으로 확인한다(낮음).
- `tokens.ts`·`tokens-v3.json`: 문제 없음.

### 요청 확인 ② `lib/localStamps`
- 주입식(`createLocalStamps(store, now)`)이고 React·RN을 모른다(lib 규칙 OK). 기본 저장소는 AsyncStorage이고, 없거나 실패하면 메모리로 바꾼다. 손상 값·저장 오류는 빈 목록이 되어 화면을 막지 않는다. 날짜 문자열만 저장해 답·낱말이 없다(결정과 맞음).
- 7일 정리: 오늘 − 6일 ~ 오늘만 남기고, 미래 날짜·형식 오류는 버린다. 읽을 때 정리하고 줄었으면 다시 저장한다. 테스트 5건.
- 기록 시점: 미연결로 세 번째 단계를 마칠 때 `addToday()`를 **기다린 뒤** `applyStep`한다(`useFinishStep.ts:26-29`). 그래서 P7·P3가 오늘 도장을 바로 읽는다.
- 삭제 시점과 읽는 경로: 로컬 값을 읽는 곳은 `useWeekStamps` 하나뿐이고, 쓰는 곳은 CourseHome·CourseDone 둘뿐이다. 둘 다 `content.linked`가 정해진 뒤에만 동작한다(`linked === undefined`면 대기). 연결 흐름은 Connect → (reset) Consent(마운트 때 `sync()`) → `replace('CourseHome')`이라, CourseHome이 다시 마운트될 때는 `linked=true`다. 그러면 `clear()` 뒤 서버 값만 읽는다. **연결 직후 코스 홈보다 먼저 로컬 값을 읽는 경로는 없다.** P2·P13·P8은 로컬을 읽지 않는다.
- 낮음:
  - (a) `defaultStore.run`: 네이티브 `removeItem`이 실패하면 메모리로 바꿔 메모리에서만 지운다. 네이티브에 남은 값은 다음 실행에서 미연결로 돌아갈 때 보일 수 있다. 연결된 동안은 로드마다 다시 `clear()`하고 7일 정리도 있어 영향은 작다.
  - (b) 설정 '모두 지우기'(`DeleteAccountScreen` `clear()`)와 `resetRole`이 로컬 목록을 지우지 않는다. 연결 때 이미 지워지므로 실제로 남는 경우는 드물지만, '모두 지우기'라는 약속과 맞추려면 `localStamps().clear()`를 함께 부르기를 권한다.

### 요청 확인 ③ 코스 홈의 바로 동의 상자 제거
- 정책과 맞다. DECISIONS "동의 거부 어르신": 코스는 그대로, 답만 저장하지 않음. P2 확정 문구 "마음이 바뀌면 설정에서 다시 골라요"(copy 2절). 6절 `course.declined_banner` + 링크 "다시 정하기". 설정의 다시 동의는 `resume` → 확인(`resume_confirm`) → `giveConsent` 두 단계라서, 예전 코스 홈 한 번 누름 동의보다 무엇에 동의하는지 보여 주는 쪽이 낫다.
- talkback: talkback-spec P3 표에는 동의 거부 띠의 읽는 순서가 없다. 코드는 날짜 → 설정 → 띠 글 → '다시 정하기' 순으로 미연결 띠와 같은 자리에 있다. 디자인 리드가 talkback-spec에 "동의 거부 줄: 날짜 다음, 글 → 다시 정하기, 버튼" 한 줄을 추가하기를 권한다(문서, 낮음).
- 낮음: '다시 정하기'가 설정 화면 맨 위로 간다. 어르신이 '가족에게 답 보여 주기' 줄을 찾아야 한다. 뒤에 그 줄로 스크롤·포커스를 옮기는 것을 검토한다.

### 요청 확인 ④ P6 보기 전용 음절 칸(시안 P5_P6_review 대조)
- 칸 자체는 일치한다: 흰 면, 3px 실선 `#744821`, 64×64, 반경 14, 글자 40(`cellPlain`).
- 다른 점(중간 N2):
  - 시안은 그림(140×100, 흰 테두리 6) → 'AI가 만든 그림' → '오늘의 낱말이에요' → 칸이 **한 흰 카드 안**(반경 22, 패딩 16/18, gap 12)에 있고, 낱말 묶음 안쪽 gap은 8이다. 코드(`KeyboardStep.tsx:100-114`)는 카드 안에 그림·캡션만 있고 제목·칸은 카드 밖에 있다. 썸네일은 진행 화면 크기(86×75)다.
  - 칸 사이: 시안 10, 코드 12(`styles.cells`).
  - 줄어듦: 시안 칸은 `flex: 0 1 64px`(좁으면 줄어 한 줄 유지), 코드는 고정 폭 + `flexWrap`(긴 낱말은 줄바꿈).
  - 글자 확대: 시안 150% 보드는 칸 96·글자 60으로 커진다. 코드는 칸 글자 `maxFontSizeMultiplier=1`, 칸 64 고정이다. 진행 화면의 입력 이유(자판과 맞춤)와 달리 보기 전용은 키워도 된다.
- 읽기: 칸 묶음 라벨 "오늘의 낱말, {낱말}"(11-7 #17b) 맞음. 제목 줄은 읽기에서 빼 중복이 없다.

### 새로 찾은 것
- **N1(중간) 보기 전용 하단 '돌아가기'가 보조 버튼이다. 시안은 주 버튼이다.** P4_zoom_review B2, P5_P6_review 두 보드 모두 '돌아가기'를 갈색 채움(주, 72)으로 그린다. 코드: `PhotoStep.tsx:48`, `QuestionStep.tsx` review dock, `KeyboardStep.tsx` review dock이 모두 `variant="secondary"`다. 화면에 행동이 하나뿐이니 주 버튼이 맞다. 1차 리뷰에서 놓친 부분이다. 세 곳 모두 `variant` 한 줄이면 고쳐진다.
- N2(중간) P6 보기 전용 배치: 위 ④.
- N3(낮음) P5 보기 전용과 시안의 차이:
  - 질문 글자: 코드 32, 시안 28/36.
  - 선택 칸 최소 높이: 시안 100, 코드는 없음.
  - 고른 칸 오른쪽 체크 아이콘: 시안에 있고 코드에는 없음.
  - '고른 답' 이름표 색: 시안 `#14532D`(doneInk), 코드 `actionPressed`.
  - 위치: `QuestionStep.tsx` `ReviewChoice`·`styles`.
- R5(낮음) 미연결 띠:
  - `alignItems:'center'`. 시안은 baseline(글 첫 줄과 '번호 쓰기' 바닥선)이다. '›'를 아이콘으로 바꾸면서 center로 둔 것 같다. 글이 두 줄 이상이면 링크가 글 가운데 높이에 온다.
  - 날짜 줄 → 띠 간격: 시안 24(본문 gap), 코드 16(`headGroup gap`).

### 판정: **합치기 가능**
- 높음 0건이다. 이전 높음 3건과 중간 M1~M7은 해결됐다.
- N1(보기 전용 '돌아가기' 주 버튼)은 세 줄짜리 수정이고 시안 1:1 원칙에 해당하니, **합치기 전에 고치기를 권한다.** N2·N3·R5와 localStamps 낮음 (a)·(b)는 후속 PR로 넘겨도 된다.
- `child-ease-joy`와는 3파일 충돌이 있다. 나중에 합치는 쪽이 양쪽 키를 모두 살려 해결하고, copy는 원본에서 sync한다.
