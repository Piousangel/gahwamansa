# 앱 디자인 시스템 적용 코드·접근성 리뷰 (2026-11-17, 독립 리뷰어)
범위: app/src/ui/{tokens,Screen,BigButton,SelectCard,CodeInput,StepRow,Text20,koreanText}, features/{course,account}, __tests__/designSystem.test.tsx (미커밋 diff). 자녀 로그인 C단계(features/child·link 신규)는 제외. 읽기만 했고 테스트·타입체크는 돌리지 않음. 대비는 직접 계산.

## 요약
대비·터치 크기·별칭 호환은 통과. 막아야 할 것은 3건: **U+2060이 글자 조합을 깨는 경우(NFD 한글·이모지)**, **Android에서 키보드가 하단 고정 영역·입력칸을 가림(edge-to-edge)**, **하단 고정 영역 높이 상한(40%) 미구현**. 확대 상한 1.5는 OPERATING(200%)과 충돌, 결정 필요.

## 발견 (심각도 / 파일:줄 / 제안)
**① U+2060 단어 결합자 (koreanText.ts)**
- [높음] koreanText.ts:15 `Array.from`은 코드포인트 단위라 글자 묶음(grapheme) 안에도 WJ가 들어감. 서버·붙여넣기 문구가 NFD(조합형 자모)면 `ㅇ+ㅗ` 사이 WJ로 **자모가 낱자로 풀려 보임**. 이모지 ZWJ 묶음(👨‍👩‍👧)·피부색·국기·❤️(VS16)·1️⃣도 쪼개짐. 제안: `text.normalize('NFC')` 후 **인접한 한글 음절(U+AC00–D7A3) 사이에만** WJ 삽입. 숫자·영문은 UAX#14가 원래 안 끊으므로 넣을 필요 없음.
- [중간] 같은 줄: 멱등 아님. 이미 WJ가 든 문자열을 다시 감싸면 WJ가 3개씩 늘어남(WJ도 한 글자로 split). 제안: `if (text.includes(WORD_JOINER)) return text` 또는 먼저 WJ 제거.
- [중간] Text20.tsx:19 화면 읽기: BigButton·SelectCard·StepRow는 원문 accessibilityLabel이 있어 안전하지만, **맨 Text20 본문은 WJ 섞인 글자를 TalkBack에 그대로 넘김**. 기본 TTS는 무시할 가능성이 높으나 글자 단위 탐색에서 빈 칸이 끼고, 삼성 TTS는 미확인. 제안: Android에서 children이 문자열이고 accessibilityLabel이 없으면 원문을 label로 지정.
- [중간] 테스트·자동화: Jest 기본 Platform.OS='ios'라 지금 테스트는 WJ를 안 거침. Android 렌더 테스트·Maestro/Detox `tapOn: "다음"`·스크린 텍스트 검색은 **원문으로 못 찾음**. designSystem.test.tsx에 Android 렌더(`Platform.OS` 모킹) 1건 추가하고, 문서에 "E2E는 accessibilityLabel/testID로 찾기" 명시.
- [낮음] 배열 children 경계(`{a}{b}`) 사이엔 WJ가 안 들어가 그 지점에서 끊길 수 있음. SelectCard.tsx:47 배지(selectedLabel)는 keepAll 미적용(짧아서 실제 영향 적음). 성능은 Text마다 split/join이라 무시 가능. 복사·검색은 Text가 selectable이 아니라 현재 영향 없음(나중에 selectable 켜면 WJ가 복사됨).

**② 확대 상한 1.5**
- [높음·결정] tokens.ts:48 + Text20.tsx:16 전역 1.5. 시스템에서 200%로 키운 어르신에게 앱이 150%로 **조용히 되돌림**(본문 20→최대 30sp, 웹 기준 16×2=32에 못 미침). OPERATING §디자인 품질 관문 3은 어르신 200% 점검. 본문은 이미 스크롤되므로 제안: **Text20 본문(≤24)은 2.0(또는 상한 없음)**, 하단 고정 버튼·display·코드 칸·손글씨만 1.5 유지. DECISIONS에 결정 기록.
- [낮음] DeleteAccountScreen.tsx:125, DeleteLink.tsx:11 `1.5` 숫자 직접 사용 → FONT_SCALE_MAX.

**③ Screen 고정 영역·키보드·작은 화면**
- [높음] Screen.tsx:21 Android `behavior=undefined`는 adjustResize에 기대는데 gradle.properties:44 `edgeToEdgeEnabled=true`라 창이 줄지 않을 수 있음 → 자녀 지우기 2단계 확인 입력(DeleteAccountScreen.tsx:121)과 하단 버튼이 키보드에 가려질 위험. 제안: Android도 `behavior="height"`(또는 react-native-keyboard-controller) + 실기기 확인.
- [중간] tokens.ts:78 `dock.maxHeightRatio 0.4`가 **어디서도 안 쓰임**. DeleteAccountScreen.tsx:79 실패 시 dock = 오류 패널 + 버튼 2개, 150%·두 줄 버튼이면 약 500dp → 320×640 화면에서 본문이 거의 0, 키보드까지 뜨면 입력칸 안 보임. Step 화면(StepError 패널+버튼)도 같은 구조. 제안: dock에 `maxHeight: 높이×0.4` + 넘치면 dock 내부 스크롤, 또는 오류 패널 본문은 Body로 옮기고 dock엔 버튼만.
- [낮음] iOS에서 키보드가 떠도 dock paddingBottom이 insets.bottom(34)을 유지 → 빈칸. README §15의 "아래 28 페이드(더 있음)" 미구현 — 150%에서 스크롤 가능함을 알릴 단서 없음.

**④ 대비·터치** — 통과
- 글자 대비(계산): ink/paper 7.05, inkSub/paper 5.47, inkSub/paperSoft 5.02, disabledInk/disabledBg 5.29, doneInk/doneSoft 7.17, dangerInk/dangerSoft 6.80, 흰/action 7.80. 모두 4.5 이상. line 테두리 3.36~3.72(비글자 3 이상).
- [낮음] 비활성 버튼 면 disabledBg/paper 1.1로 버튼 경계가 거의 안 보임(기준 예외지만 어르신은 "버튼이 사라졌다"로 오해 가능) → 2px line 테두리. ink=action 같은 색이라 DeleteLink는 밑줄·굵기로만 구분(유지 권장).
- 터치: BigButton 72/64, SelectCard 132, CodeInput 68(320폭에서 키 약 85dp·칸 약 39dp, 숫자 51sp 들어감), DeleteLink 48(자녀 화면이라 childMin 충족). BigButton disabledReason은 버튼과 따로 읽힘 → `accessibilityHint`로도 연결 권장(낮음).

**⑤ 기존 호출부 호환** — 대체로 통과
- 옛 색 키 전부 유지(actionDark·actionShadow·disabled·handwrite 별칭), space s*·size 키 유지, Screen({children}) 동작 유지(테스트 있음).
- [중간] 값이 바뀐 이름: `fontSize.title` 30→32, `childBody` 16→18, `color.action` 주황→갈색(=ink). 범위 밖(자녀·link) 화면이 action을 "강조색"으로 쓰면 본문과 구분이 사라짐 → 사용처 확인. BigButton `marginVertical 6`, SelectCard `marginVertical 8` 제거로 gap 없는 View 안의 기존 버튼들이 붙음(gapMin 12 위반 가능) → 범위 밖 호출부 점검.

**⑥ 과한 것**
- [낮음] fontSize/typeScale, size/touch, space 새 이름+옛 이름이 이중. `font` 전부 undefined, `textBreakStrategy:'highQuality'`는 Android 기본값, `maxHeightRatio` 죽은 값. 별칭은 이행 끝나면 제거 일정만 DECISIONS에 적기.
