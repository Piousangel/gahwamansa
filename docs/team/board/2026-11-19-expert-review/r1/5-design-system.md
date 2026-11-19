# 패널 r1 · 5 디자인 시스템 전문가 (Figma 라이브러리 설계자 관점)

- 작성 2026-11-20, 기준 main `ed3c8e9`. BRIEF r1 공통 지시를 따랐다. 다른 패널 파일은 열지 않았다.
- **실측한 것**: ① `eslint src/**` JSON 결과를 파일·종류별로 다시 셌다(DS 위반 145건). ② `contrast-v4.py --check` OK를 확인하고, 허용 목록 밖의 짝(눌림·비활성·v3 값)은 같은 WCAG 식으로 따로 계산했다. ③ ds 컴포넌트 20개·옛 ui 컴포넌트 35개의 스타일 숫자 리터럴을 grep으로 셌다. ④ 시안 `.dc.html` 인라인 CSS와 컴포넌트 스타일을 대조했다. ⑤ 캡처·접근성 트리(0a)를 대조했다.
- **캡처의 한계**: 0a 캡처는 `6aa07a9` 빌드다. 그 뒤 P4·P5·C4·C5·C7·C8 부품이 ui/ds로 옮겨졌다(`df121bd`·`710689a`·`891a865`·`cf71c51`·`f72e704`). 그래서 이 화면들은 캡처가 아니라 **지금 코드**로 판정했고, 표에 '코드'라고 적었다.
- 실행 결과: `jest dsBaseline·tokensV4·dsComponents·dsTypes·dsLayout·dsDockBudget` 6개 묶음, 82개 테스트 통과(main `89bf8d6`). main `ed3c8e9`에서 dsBaseline·tokensV4 31개 테스트 통과. `contrast-v4.py --check` OK. 타입체크(tsc)는 돌리지 않았다. 앱 코드는 고치지 않았다(문서만 바꿈).

---

## 1. 한 줄 판정

**v4 토큰 파일은 잘 설계했지만, 앱은 아직 두 디자인 시스템이 섞여 돌아간다.** 화면 34개 중 6개만 v4 화면 틀(DsScreen)을 쓴다. 나머지는 v3 값(갈색 본문, 어르신 7:1에 못 미치는 보조색, 그림자 버튼, 흐림 띠)을 그대로 쓴다. 그래서 **'토큰만 바꿔서 B2 v2로 간다'는 지금 구조로는 불가능하다.** 단일화가 먼저다.

### 가장 큰 문제 3개
1. **(H) 토큰 원본이 둘이다.** `ui/tokens.ts`(v3)는 33개 화면 파일이 직접 가져다 쓴다. v4 이전 원칙이 "v3 값은 바꾸지 않는다"(`tokensV4Migration.ts`)라서 결과가 이렇다.
   - v3 `inkSub #85592F`는 종이 위 **5.47**, 흰 면 위 6.06이다. 어르신 7:1에 못 미친다.
   - 이 색이 P1·P2·P3(StepRow)·P7·P13·P15·P16·N1·P0 보조 글에 쓰인다(`color.inkSub` 28곳).
   - `Text20` 기본 글자색은 v3 `ink #744821`(= action 갈색)이다. "갈색은 누르는 것에만"(colorRules 1)이 legacy 화면 전체에서 깨진다.
   - lint의 `color` 규칙은 헥스 리터럴만 잡으므로 0건으로 센다. 기준선이 이 문제를 보지 못한다.
2. **(H) 시안과 구현의 글꼴이 다르다.**
   - v4 시안은 제목·선택지·버튼을 **Jua**로, P6 손글씨를 Nanum Pen Script로 그렸다(P3_P4_P5_ds4b: Jua 19곳·Noto Sans KR 51곳).
   - 앱은 어디에도 `fontFamily`를 넣지 않는다. `font = {title: undefined…}`이고, `roleText()`에 글꼴 키가 없으며, 글꼴 파일도 번들하지 않았다.
   - main이 방금 `answer`·`answerRow`에 `"fontFace": "Jua"`를 넣었다. 그런데 생성기(`scripts/gen-tokens-v4.js`)가 그 키를 내보내지 않는다(`tokensV4.ts`에 fontFace 0건).
   - 그래서 'UI 1:1, 시안이 기준'(V4-INDEX)이 글꼴에서 처음부터 성립하지 않는다. 캡처(P5 '봄/가을', P3 날짜)를 시안과 나란히 보면 다른 앱처럼 보인다.
3. **(H) 컴포넌트 계층이 둘이고, v4 쪽에 빠진 부품이 많다.**
   - 둘씩 있는 부품: Screen/DsScreen, Banner(ui)/Banner(ds), BigButton·SmallButton/Button, ChoiceGrid·SelectCard/Choice, BottomSheet/Sheet, TextLink·BackBar·TopBar/BackLink, Text20/Text.
   - ds에 없는 부품: tokens `components` 목록에 있는 **Dialog·Toast·ListRow·TopBar**와 Screen 틀 **list·done·state**가 없다.
   - 그 결과 v4 화면도 옛 Dialog(v3 값)를 가져다 쓴다(ChildSettings·CourseDone·KeyboardStep).
   - 목록 화면 C7·C7i·C3는 `variant="step"`으로 억지로 맞췄다.
   - 실제 import 횟수는 Text20 29, ui/Screen 21, BigButton 17, ui/ds 13이다. 옛 쪽이 더 많다.

**H 개수: 16행**(2절 표). 같은 원인이 겹친 행 3개(P0·N1 = v3 inkSub, C8 = CG와 같은 provider 원인)를 빼면 **서로 다른 원인은 13개**다.

---

## 2. 화면별 요소 감사 표

열 이름의 '지금'은 main 코드를 기준으로 한다. 캡처로 확인한 것은 '(캡처)'를 붙였다. 대비는 WCAG 2.x 상대휘도로 계산했다.

### 2-1. 공통(토큰·컴포넌트 층) — 화면 전체에 걸리는 것

| 화면 | 요소 | 지금 | 왜 문제인가(근거·실측) | 제안(구체 값) | 심각도 | 비용 |
|---|---|---|---|---|---|---|
| 전체 | 토큰 원본 | `tokens-v4.json`→`tokensV4.ts`와 `tokens.ts`(v3, 손으로 관리)가 따로 있음. v3을 33개 파일이 import | 값이 둘이면 테마 교체·대비 검사가 반쪽이 된다. Figma로 치면 라이브러리 두 개가 한 파일에 붙어 있는 상태 | `tokens.ts`의 색·반경·그림자를 **tokensV4에서 파생**한다(v3 이름 → v4 값 별칭). 값이 바뀌는 이름(inkSub·ink)은 화면 레인이 캡처로 확인 | H | M |
| 전체 | 보조 글 v3 `inkSub #85592F` | 종이 5.47·흰 6.06·paperSoft 5.02 | 어르신 7:1 미달(RULES R-01). 쓰는 곳 28곳(ConsentScreen P2·ConnectScreen P1·StepRow P3·CourseDone P7·ParentSettings P13·HistoryScreen P15·ParentFamilyScreen P16·PushPermission N1·AppRoot P0 '잠시만요') | v4 `inkSub #544B43`(종이 7.70)으로 바꾸는 것을 1순위로 한다. lint `color` 규칙에 `color.inkSub`(v3 import) 참조를 추가 | H | S |
| 전체 | 읽는 글 기본색 | `Text20` 기본 = v3 `ink #744821`(action과 같은 값) | colorRules ①('갈색 = 누를 수 있는 것에만')과 반대다. C7 캡처(옛 빌드)에서 행 설명이 모두 갈색이고, 같은 앱의 C0-a는 차콜이다 | Text20 기본을 `inkBody`로 바꾼다. 그 전에 갈색이 '누름' 단서로 쓰인 곳(행 제목 등)을 grep으로 확인 | H | S |
| 전체 | 글꼴 | 시안 Jua·Noto Sans KR·Nanum Pen, 앱은 시스템 글꼴. `answer.fontFace: "Jua"`가 토큰에만 있고 생성물에는 없음 | 시안 1:1 원칙이 글꼴에서 깨진다. 팀이 '디자인'을 시안으로 승인하고, 사용자는 다른 것을 본다 | 둘 중 하나를 정한다. (a) 시안을 시스템 글꼴로 다시 렌더해 기준을 맞춘다(비용 S). (b) `typeRoles.*.fontFace` → 생성기 → `roleText().fontFamily` 경로를 만들고, Android는 굵기마다 파일 이름을 짝지어(`Jua-Regular` 등) 번들하고, OSS 화면에 OFL 고지를 넣는다(비용 M). **결정 전까지 시안에 '앱 글꼴 아님' 표기** | H | S~M |
| 전체 | 타입 스케일 | 어르신: 20·22·24·26·30·32·34·52. 20~34 구간에 2dp 간격으로 7단. 보완 쌍 6개(`ratioCompensatedPairs`) | R-05(인접 1.2)를 스케일 스스로 6곳에서 못 지킨다. 2dp 차이(22/24/26)는 눈으로 구분되지 않는다. legacy의 Text20은 24(37곳)·28(14곳)을 쓰는데, 28은 v4 표에 없다 | 어르신 **20 / 24 / 30 / 52**(+번호 34) 4단으로 줄인다. body·sub·label 20, bodyLg·heading·backLink·보조 버튼 24, title·주 버튼 30, display 52. 비율은 1.2·1.25·1.73. 자녀는 **16 / 20 / 26 / 40**(link 17 폐기). 어르신 확인(V27) 뒤 동결 | M | M |
| 전체 | 줄높이 원본 둘 | typeRoles(`link 22/30`·`backLink 24/32`·자녀 `heading 20/28`)와 `lineHeightTable`(22→32·24→34·20→30)이 다름 | 같은 24 글자가 legacy Text20에서는 34, ds BackLink에서는 32다. 원본이 두 개 | `lineHeightTable`을 지우고 typeRoles만 남긴다. 규칙 '글자 + 10/12'를 생성기가 검사하게 한다 | M | S |
| 전체 | 같은 치수, 다른 이름 | elder `body = sub = label` 20/30. 자녀 `title = answerRow` 26/36, `display = answer` 40/52 | Figma 텍스트 스타일로는 하나다(색·글꼴만 다름). 역할이 늘면 화면 레인이 '어느 것을 고를지'로 시간을 쓴다 | 텍스트 스타일(크기·줄높이·굵기)과 색 tone을 분리한다. `label`은 `body`의 별칭으로 둔다. answer·answerRow는 `display`·`title` + `face: 'display'` 변형으로 | L | S |
| 전체 | 반경 9개 | chip 12·codeCell 12·keypadKey 14·input 16·childCard 16·card 22·select 24·sheet 28·button 36. 리터럴 21곳(18·11·8·4·3·2·999 등) | 4 격자 밖 값(14·22)이 있고, 같은 값에 다른 이름이 있다. 위계가 '작게·중간·크게·알약'으로 읽히지 않는다(07 문서 AI-2의 '아무도 정하지 않은 값') | `radius.sm 12 / md 16 / lg 24 / pill 999` 4단 + 쓰임 별칭(chip→sm, card→lg…). 22→24, 14→12 | M | S |
| 전체 | 선 굵기 | 토큰 없음. 리터럴 0·1·1.5·2·3·4·5·7, 71곳. Choice 하나 안에서도 list 2→4, answer 1.5→5 | 상태 위계(평소·지금·고름·오류)를 선 굵기로 말하는 시스템인데 그 값이 토큰에 없다. B2 v2도 선 위계(1.5 회 / 먹 3 / 고름 5)를 쓴다 | `border.hair 1.5 / strong 3 / selected 5` 3단을 토큰으로 둔다. 2·4는 폐기. `states.selected.border "4px"`(토큰)와 시안 5를 하나로 맞춘다 | M | S |
| 전체 | 간격 격자 | `space.grid 4`. 화면 리터럴 중 4 격자 밖 값: 10(33)·14(27)·6(26)·2(11)·18(6)·5·10.5·16.5, 약 110건 | 4 격자가 문서에만 있다. 생성물 `tokensV4.space`에는 xs~xxl이 없어(group·between·section만) 컴포넌트가 숫자를 손으로 쓴다(Button `paddingHorizontal 20`·`gap 10`, Banner `10/14`, BackLink `6/12`) | 생성기에 `space.xs~xxl`을 내보낸다. ds 안 리터럴을 lint 대상에 넣는다(ui/ds도 `[DS:space]` warn) | M | S |
| 전체 | 그림자 | 생성물에 shadow가 없음. ds Card·Sheet가 v3 `shadow.lifted`를 import. 리터럴 3개(PolaroidStack 2, CodeInput `0 2px 0`) | ① Sheet는 시안·토큰 `shadow.sheet`(0 -8 24, 위로)인데 `lifted`(0 6 16, 아래로)를 쓴다. ② CodeInput 키의 `0 2px 0`은 토큰 규칙 '단단한 하단 그림자 폐기'에 어긋난다 | 생성기에 `shadow`를 내보낸다. Sheet → `shadow.sheet`. P1 키는 그림자를 빼고 테두리 line 2만(시안 P1_connect_v4 키 테두리 2) | M | S |
| 전체 | 허용 목록이 상태를 모름 | `allowed`는 평소 상태만 다룬다. ds Button 보조 눌림 = action 글자 on actionSoft **6.03**, 위험 눌림 = dangerInk on dangerSoft **6.80**(어르신) | 토큰 `states.pressed.secondary`는 '글자 actionPressed(8.15)'로 정해 두었는데 ds Button이 지키지 않는다(옛 BigButton은 지킨다). dsComponents 테스트에 pressed 검사가 없다 | 보조·text 눌림 글자를 `actionPressed`로, 위험 눌림 글자는 그대로 두고 면을 `card`로 바꾸고 테두리만 굵게 한다. `allowed`에 `states` 짝을 넣고 테스트를 추가 | M | S |
| 전체 | 비활성 | disabledInk on disabledBg 5.29, line 테두리 on disabledBg 3.05 | WCAG 1.4.3은 비활성을 예외로 두지만, RULES가 '비활성도 4.5 이상'으로 스스로 정했다. 어르신에게는 이유 줄이 본정보다. 이유 줄은 `sub muted`(v4 inkSub)라 괜찮다 | 지금 값 유지. `allowed.disabled` 항목으로 문서화만 | L | S |
| 전체 | 흰 카드 경계 | card on paper **1.11**. ds Card(기본)는 테두리·그림자가 없다 | '흰 면 = 한 덩어리'라는 면 규칙이 눈에 거의 안 보인다. 누를 수 없는 카드에는 대비 규칙이 없지만, 어르신 저시력이면 덩어리가 사라진다 | 둘 중 하나를 어르신 확인(V27)으로 고른다. (a) Card 기본에 `paperEdge` 선 1.5를 둔다(장식선, 대비 규칙 대상 아님). (b) 화면 바탕을 paperSoft로 한 단계 내린다(흰 카드와 1.2). | L | S |
| 전체 | 이름 체계 | 색은 audience를 이름에 넣고(`inkSubChild`, 반경 `childCard`), 글자는 audience를 하위 키로 둔다(`body.elder/child`). `done`(아이콘)/`doneInk`(글자)인데 `info`·`action`은 글자·아이콘 겸용. Card `tone="paper"`가 흰(card) 면을 그린다 | Figma 변수로 옮기면 모드(어르신·자녀)가 한 축이어야 한다. 지금은 두 방식이 섞여 모드로 묶이지 않는다 | Figma 기준 3층으로 둔다. **Primitive**(brown-800 #4E2F14…) → **Semantic**(text.title·text.body·text.sub·action.bg…, 모드 elder/child) → **Component**(button.primary.bg…). `inkSubChild` → `text.sub`(child 모드), Card tone `paper` → `plain` | M | M |
| 전체 | Screen 틀 | DsScreen `variant`는 step·form·intro만. 토큰 `screenVariants`는 6종 | list·done·state가 없어 C7·C7i·C3가 step을 쓴다(step은 자판 접힘 정책을 켠다). P13·P15·C5·P7은 DsScreen으로 옮길 길이 없다 | `list`(Dock 0~1, 자판 정책 없음, 스티치 1)·`done`(본문 가운데, Dock 주 1)·`state`(StateView 전면)를 더한다. C7·C3를 list로 | H | M |
| 전체 | 대화상자·토스트 | ds에 Dialog·Toast 없음. v4 화면 3개가 옛 `ui/Dialog`(v3 값·`font.title`)를 씀 | 같은 화면 안에 v4 버튼과 v3 대화상자 버튼(32/26, 그림자)이 섞인다 | ds `Dialog`(어르신 전용, 주 1 + 보조 1, 제목 heading, scrim 토큰)와 ds `Toast`(Banner 모양 + 시간)를 만든다 | H | M |
| 전체 | '더 있음' | legacy Screen은 글자 위 흐림(LinearGradient), DsScreen은 띠 24. V4-INDEX는 '띠 16', RULES R-19는 '24' | legacy 화면 11개가 R-19를 어긴다(P3 캡처: 지금 행 아래 카드가 흐림에 묻힘). 문서끼리도 16·24로 어긋난다 | legacy Screen의 흐림을 MoreBand로 바꾼다(옛 화면도 한 번에 고침). V4-INDEX를 24로 고친다 | M | S |
| 전체 | Dock 간격 | `dock gap = touch.elder.gap 12`(자녀도). text 종류 보조·note 링크도 12 | RULES R-12·touch.rule '주 버튼과 링크 24 이상'. 자녀에게 어르신 값을 쓰는 것도 audience 원칙에 어긋난다 | 보조가 `kind:'text'`이거나 note에 onPress가 있으면 그 앞 간격을 24로 한다. 자녀 Dock gap은 `space.group 8` 이상으로 | M | S |
| 전체 | Dock 위 여백 | `DOCK_PAD_TOP = 6`(dockLayout), 토큰 `dock.padding.top 12` | 계산과 토큰이 다르다. 주석에는 '12-6'이라고만 적혀 있다 | 옛 Screen의 6을 토큰 12로 맞추거나, 토큰을 6으로 내리고 이유를 적는다 | L | S |
| 전체 | dsBaseline | 145건: text20Size 82·rnImport 24·fontScale 14·fixedBox 10·fontSize 7·fontWeight 6·lineHeight 2. 많은 파일: KeyboardStep 19·DeleteAccount 10·ParentSettings 9·RoleChoiceButton 9·CourseHome 8·History 8·ParentFamily 8 | ① `ui/` 전체가 검사 밖이라, 옛 컴포넌트 35개 안의 리터럴(BigButton 32/26 글자, StepRow 여백 등)은 0으로 센다. ② `color.inkSub`(v3) 참조는 `color` 규칙이 못 잡는다. 145는 실제 v4 미이행량보다 훨씬 작다 | 기준선에 **'v3 import 수'(지금 33 파일)**와 **'legacy 컴포넌트 사용 수'**(Text20 29·Screen 21·BigButton 17…)를 더한다. 이 두 수가 0이 되는 날이 v4 완료일이다 | M | S |

### 2-2. 어르신(P)

| 화면 | 요소 | 지금 | 왜 문제인가 | 제안 | 심각도 | 비용 |
|---|---|---|---|---|---|---|
| P0 | '잠시만요' 줄 | AppRoot `slow: color.inkSub`(v3) | 5.47, 7:1 미달 | v4 Text `role="sub" tone="muted"` | H(공통 1행에 포함) | S |
| FS | 역할 버튼 | RoleChoiceButton이 RN Text·fontSize·lineHeight·fontWeight 리터럴(9건), 원 36×36 | v4 시안 화면인데 글자 크기가 역할 밖이다. 버튼 글자 크기를 시안과 맞출 방법이 없다 | `Button` 변형 `kind="choice"`(아이콘 + 두 줄)를 ds에 두거나 Choice `mode="action"`으로 옮긴다 | M | M |
| P1 | 키패드 키 | CodeInput 키 `boxShadow '0px 2px 0px'`·테두리 2·반경 14 | 단단한 하단 그림자는 토큰에서 폐기했다. 시안 P1_connect_v4는 키 테두리 2 + 그림자 없음 | 그림자 삭제, 반경 `radius.sm 12` | M | S |
| P1 | 번호 칸·보조 글 | ConnectScreen `sub: color.inkSub`(v3), legacy Screen | 7:1 미달. v4 시안 화면인데 v3 틀이다 | DsScreen `form` + Field `kind="otp"` 계열 번호 칸 컴포넌트(`CodeField`)를 ds로 | H | M |
| P1c | 확인 문단 | legacy(토큰만) | 토큰 효과만 받는 화면은 v3 토큰이 그대로라 '토큰 효과'가 0이다 | 1행 단일화로 함께 해결 | M | S |
| P2 | 안내 상자 | ConsentScreen `infoText: color.inkSub` + `icon-info`(inkSub) | v4 시안 P2는 info 띠(`infoSoft` + info 아이콘, 7.35)다. 구현은 v3 보조색 5.47. 시안 짝이 다르다 | ds `Banner tone="info"`로 바꾼다 | H | S |
| P3 | '지금 할 차례' 표시 | 캡처: 테이프(Tape 에셋) 위 굵은 갈색 글자. 시안 ds4b-03: `accent #8F2F15` 테두리 알약 | 시안의 accent 1곳 규칙(R-07)을 구현이 쓰지 않는다. 테이프는 장식인데 상태 표시를 맡았다 | ds `Tag tone="accent"`(테두리 accent 1.5 + 글자 accent, 종이·흰 위 허용)를 만들고 StepRow에서 쓴다 | M | S |
| P3 | 완료 행 | `doneSoft` 면 + 테두리 0(StepRow) / 시안: 흰 면 + line 1.5 + ✓ 했어요 + › | 시안은 '다 한 것도 눌린다(다시 보기)'를 면 규칙(흰 = 누름)으로 보인다. 구현의 초록 면은 '누를 수 없음'으로 읽힌다 | StepRow를 ds `ListRow`(state: now·done·next) 하나로 | M | M |
| P3 | 스티치 | CourseHome에 `<Stitch>` 3곳(조건별), 캡처에 2줄 | V4-INDEX P3 '스티치 1곳' | 1곳만(목록 위) | L | S |
| P3 | 화면 틀 | legacy Screen(흐림), Text20·BigButton | v4 시안 '빌드 1' 화면인데 v4 틀이 아니다. 지금 행 아래 '다음 차례' 행이 흐림에 묻힘(캡처) | DsScreen `list` + ListRow + MoreBand | H | M |
| P4 | 화면 틀 | DsScreen step(코드). 아이콘 색 `ds.color.inkSub` 직접 | 이행 완료. 다만 화면이 `ds/roles`를 깊게 import해(11 파일) 색을 고른다. 허용 목록 검사를 거치지 않는 길이다 | `ds/roles` 직접 import를 lint로 막고 Icon에 `tone` prop을 둔다 | L | S |
| P5 | 선택지 | Choice `look="answer"`: 글자 `title` 역할(화면 제목용), 최소 96 리터럴, 테두리 1.5→5 | title은 '화면당 1개 Heading 1'(typeRoles 주석)인데 선택지 2개가 title을 쓴다. 역할 이름과 쓰임이 어긋난다 | `option` 텍스트 스타일(30/38, 700 집계 제외 여부 결정)을 두거나 `title`의 별칭으로 이름을 붙인다. 96은 `touch.elder.choice` 토큰으로 | M | S |
| P5 | 안내 문장 | 시안 '정답은 없어요. 마음 가는 쪽을 눌러 주세요'가 질문 아래 / 캡처(옛)는 없음 | 코드 `f72e704`가 '질문·안내 분리'를 반영했다. 재캡처가 필요하다 | 재캡처 | L | S |
| P6 | 화면 전체 | KeyboardStep 위반 19건(최다): RN import 2·fontScale 4·fixedBox 4·fontSize 2, legacy Dialog | v4 시안 화면 중 이행이 가장 덜 됐다. `hand` 역할이 Nanum Pen을 뜻하는데 글꼴이 없다 → 시안의 손글씨 낱말이 앱에서는 시스템 글꼴 | DsScreen step + Field `kind="word"` + ds Dialog. hand 글꼴 결정(1행 '글꼴') | H | M |
| P7 | 완료 | CourseDone legacy, `hint: color.inkSub`(v3), legacy Dialog, 도장 `brandSealDeep` | 7:1 미달 줄 1곳. 화면 틀 `done`이 ds에 없다 | DsScreen `done` 추가 뒤 이행 | M | M |
| P8 | 응원 대화상자 | CheerDialog → ui/Dialog(v3) | ds Dialog 없음 | ds Dialog | M | S |
| N1 | 알림 안내 | PushPermissionScreen legacy, `sub: color.inkSub` | 7:1 미달 | v4 sub | H(공통) | S |
| P13 | 설정 | ParentSettings 위반 9 + SettingsRow(ui, `sub/group: inkSub` v3) | 목록 화면 틀·ListRow가 ds에 없다. 설정 행 보조 글 5.47 | ds `ListRow`(제목 bodyLg·설명 sub·값·›·스위치 슬롯) | H | M |
| P15·P16 | 목록 | History·ParentFamily 위반 각 8, chevron 아이콘 `inkSub`(v3) 22 | 아이콘 22는 `slots.icon.inRow 28`과 다르다 | ListRow + 아이콘 28 | M | M |
| P9·P10 | 지우기 | DeleteAccount 위반 10 | 위험 화면인데 위험 톤이 v3 BigButton danger다 | ds Button danger + Dialog | M | M |

### 2-3. 자녀(C)

| 화면 | 요소 | 지금 | 왜 문제인가 | 제안 | 심각도 | 비용 |
|---|---|---|---|---|---|---|
| C0a·b·c | 로그인 | DsScreen form + SocialButton(캡처 v4) | 이행 완료. SocialButton `minHeight 60`·반경 chip 12는 상수다(`SOCIAL_MIN_HEIGHT`). 자녀 주 버튼 56과 다르다 | 브랜드 예외로 토큰 `dock.socialGroup.minHeight 60`에 올린다 | L | S |
| CG | 시작 결정 | ChildGate legacy, AudienceProvider 없음 | audience 기본값이 `elder`다 → 자녀 화면이 어르신 크기로 그려진다 | 자녀 스택 루트(ChildStack)에서 한 번 `AudienceProvider child`. 화면마다 감싸지 않는다 | H | S |
| C1 | 호칭 고르기 | 캡처: 주 버튼 **312×72**, 선택지 152×56, 글자 20 이상(Text20 하한), 테두리 lineSoft 2(ChoiceGrid, 흰 면 위 1.44), 뒤로 '‹ 이전'·읽는 이름 '이전 화면으로 가기' | ① 자녀 주 버튼은 56(touch.child.primary)인데 72다. ② 누르는 칸의 테두리가 3:1에 못 미친다(R-01 nonText). ③ BackLink R-14 '목적지 문구·보이는 글 = 읽는 이름'을 어긴다. ④ V4-INDEX C1 결정 'ds Choice에 columns'가 구현되지 않았다(Choice에 columns prop 없음, ChoiceGrid 유지) | ds Choice에 `columns: 1 | 2` + 자동 1열(150%↑·줄바꿈 시). C1을 DsScreen form + BackLink('로그인으로' 등 목적지)로 | H | M |
| C2 | 번호 | CodeShow legacy, Text20·BigButton | 삭제 후보지만 남아 있는 동안 어르신 크기 | C3로 합치거나 child provider | L | S |
| C3 | 연결 기다리기 | DsScreen `variant="step"` | 목록 화면(V4-INDEX 'list·state')인데 step을 쓴다. step의 자판 접힘 정책이 켜진다 | `list` 틀 추가 뒤 교체 | M | S |
| C4 | 앨범 홈 | legacy Screen + child provider + ds 부품(코드). 캡처(옛)는 '응원 보내기' 어르신 크기(32) 버튼 | 부품만 ds라 틀(흐림 띠, Dock 비율)은 v3다. 재캡처 필요 | DsScreen `list` | M | M |
| C4 | 최근 답 | 새 역할 `answer`(Jua, 40/52, 상한 1.3) | ① 글꼴이 생성물에 없다(1행 '글꼴'). ② 상한 1.3은 R-11의 두 단계(2.0/1.5)에 세 번째 단계를 더한다. ③ `display` 자녀 40/52와 치수가 같다 | `display` + `face:'display'`로 합치고 상한 1.3은 역할 토큰에 이유와 함께 둔다(지금처럼). 글꼴 경로를 먼저 만든다 | M | S |
| C4s | 응원 시트 | ds Sheet + Choice(코드). Choice 반경 `select 24`·테두리 2. 시안: **반경 16·테두리 1.5**·글자 18/28. 시트 그림자 `lifted`(아래로) vs 시안 `0 -8 24`(위로) | 시안과 3가지가 다르다. 반경 24는 어르신 값을 자녀에 쓴 것이다 | Choice 반경·테두리를 audience별 토큰으로(`choice.radius.child 16`·`border.hair 1.5`). Sheet → `shadow.sheet`. scrim도 v3 `color.scrim` → 토큰 `shadow.scrim` | M | S |
| C5 | 지난 답 | ChildReport legacy Screen + ds 부품 | C4와 같음 | `list` | M | M |
| C6 | 곧 유료 시트 | PaidSheet → ui/BottomSheet(v3), `label: inkSub` | ds Sheet가 있는데 옛 시트를 쓴다. 시트가 두 모양 | ds Sheet로 | M | S |
| C7·C7i | 설정·앱 정보 | DsScreen `step`, 스위치 색 3:1 보정(`SWITCH_COLORS`) | 스위치 보정은 좋다. 틀은 C3와 같은 문제 | `list` + ListRow | M | S |
| C8·C9 | 계정 지우기 | DeleteAccountScreen legacy, child provider 없음 → Text20 하한 20·BigButton 72 | 자녀 화면이 어르신 치수다(CG와 같은 원인) | ChildStack 루트 provider + ds 이행 | H(CG와 같은 원인) | S |

---

## 3. 시중 디자인 시스템과의 차이

기준: 토스 TDS(01 문서 E·D: 접근성을 시스템 단계에서, 문구 규칙을 컴포넌트에), 배민 글꼴 결정(02 B-Q2), Figma 변수 모델(Primitive → Semantic → 모드). 타사 화면은 저장하지 않았고, 공개 원칙만 비교했다.

| 항목 | 시중(근거) | 우리 | 판정 |
|---|---|---|---|
| 접근성 처리 위치 | TDS: 큰 글씨·VoiceOver를 컴포넌트가 기본으로 처리하고, 화면마다 다시 하지 않는다(T5) | 역할별 확대 상한, Dock 넘침 단계, 접힘 경계(foldPush)까지 컴포넌트·순수 함수로 만들었다. **TDS보다 더 깊다**(접힘 경계 R-15는 시중에서 보기 드문 규칙) | 더 나음 |
| 규칙을 코드로 강제 | TDS: 문구 규칙을 컴포넌트 안에(T3) | `LayoutOnlyStyle` 타입으로 화면이 크기·색을 못 넘긴다. placeholder prop 자체가 없다. dsBaseline으로 위반 수를 지킨다 | 더 나음 |
| 대비 검사 | 보통 문서 표 | 역할×면을 모두 계산하고 허용 목록으로 테스트한다 | 더 나음(단, 상태·v3 값은 빠짐) |
| 라이브러리 수 | 한 제품에 라이브러리 하나. 이전은 '새 컴포넌트 → 옛것 삭제' 짧은 주기 | v3·v4 두 층이 공존하고, 이전 기한이 '한 릴리스'(Q11)인데 이행률은 6/34 | 못함 |
| 토큰 층 | Primitive(팔레트) → Semantic(역할) → Component, 테마·모드는 Semantic 층에서 바꾼다 | `color`가 팔레트이자 역할이다(`action`=#744821). 모드(어르신·자녀)는 글자 크기만 있고 색·반경에는 없다 | 못함 — B2 v2 교체를 막는 직접 원인 |
| 글꼴 | 배민은 글꼴이 브랜드다. 토스도 전용 글꼴. '고른 것'이다 | 시안은 Jua, 앱은 시스템 글꼴. 결정 문서는 있지만 시안·앱이 서로 다른 결정을 따른다 | 못함 |
| 스케일 | 시중 제품 타입 스케일은 보통 단계 사이가 뚜렷하다(예: 1.2배 이상, 2dp 계단은 드묾 — 일반론, 출처 없음) | 20~34에 7단(2dp 계단)이고 보완 쌍이 6개다 | 못함 |
| 상태 토큰 | 눌림·비활성·포커스를 Component 토큰으로 | `states`는 문장이라 생성되지 않는다. 컴포넌트가 다르게 해석한다(보조 눌림 글자) | 못함 |

---

## 4. AI스러움 (디자인 시스템이 만드는 '생성된 느낌')

| # | 요소 | 왜 생성된 느낌인가 | 대안 |
|---|---|---|---|
| 1 | 반경 9개, 그중 22·24·28·36이 비슷한 '크고 둥근' 값 | 07 AI-2: 모든 것이 같은 큰 반경이면 SaaS 카드 키트처럼 보인다. 9개지만 눈에는 '전부 둥근 것' 하나로 보인다 | 4단(12·16·24·pill). **각진 것 하나**(예: 사진 액자 4)를 일부러 둔다 |
| 2 | 크림 바탕 #F6F3EE + 갈색 강조 + legacy 화면의 갈색 본문 | 07 2절: A1 군집 1번(크림 + 테라코타 계열)과 같은 자리에 있다. legacy 화면은 본문까지 갈색이라 '갈색 한 톤 앱'이 된다 | 차콜 본문(v4)을 앱 전체에 적용하면 군집에서 한 걸음 벗어난다(1행 단일화). 팔레트 결정은 3.5 몫 |
| 3 | 같은 그림자 `soft`가 버튼·말풍선·배너·시트 안 버튼 모두에 | 07 A2: 모든 요소에 같은 그림자 | v4처럼 버튼 그림자를 없애고, 그림자는 '떠 있는 것(시트·대화상자)' 2단만 남긴다 |
| 4 | 2dp 계단 타입 스케일 | 단계를 '고른' 흔적이 없고 기본값처럼 촘촘하다 | 4단 스케일(2-1 표) |
| 5 | 테이프·스티치·폴라로이드·도장 장식이 한 화면(P3)에 겹침 | 07 AI-10: 일부러 벗어난 곳이 셋 이상이면 어수선하다. P3 캡처에 테이프 + 스티치 2줄 + 도장 줄이 함께 있다 | 장식은 한 화면 하나. P3는 스티치 1(V4-INDEX)만, 테이프는 사진(폴라로이드)에만 |
| 6 | 시안의 Jua와 앱의 시스템 글꼴 차이 | 시안은 '고른 글꼴'로 승인받고 앱은 기본값(AI-7). 사용자에게는 기본값 앱이 간다 | 1행 '글꼴' 결정 |

---

## 5. B2 v2 '장날 팻말' 평가 — 토큰 교체만으로 갈 수 있는가

**결론: 지금은 갈 수 없다.** ds로 옮긴 6개 화면은 색·반경·간격의 약 70%를 토큰 교체로 바꿀 수 있다(추정). 하지만 나머지 28개 화면과 B2의 핵심 장치(팻말)는 토큰 밖에 있다.

| B2 v2 요구 | 토큰 교체로 되나 | 막히는 곳(실측) | 필요한 일 |
|---|---|---|---|
| 팔레트 5색 + 흰(회백 #F4F5F2, 먹 #151515, 회 #484B50, 차일 파랑 #1A4C99, 노랑 #FFD43B) | ds 화면은 부분적으로 됨 | ① v3 `tokens.ts`를 33개 파일이 import. v4만 바꾸면 legacy 화면은 갈색으로 남는다. ② `info #1E4E7A`(남색)와 새 action 파랑(#1A4C99)이 같은 계열이 된다. '파랑 = 누르는 것만'(B2)과 'info 띠'(R-08)가 충돌한다. ③ allowed 표 전체를 다시 계산해야 한다(contrast-v4.py SURFACES 재정의). ④ done 초록·danger 빨강·sky·sun·tape·brandSealDeep의 B2 값이 정해져 있지 않다 | 단일화(1행) 먼저. info를 파랑에서 떼어 낼 값(예: 회 #484B50 + 아이콘)을 정한다. Primitive 층을 만들고 B2를 **새 모드**로 둔다 |
| 반경: 버튼 8, 행 6~8, 팻말·입력 3 | ds는 됨 | 리터럴 21곳(CourseHome 18, StampRow 18 등). BackLink '알약'은 RULES R-14 문장에 박혀 있다. legacy BigButton은 v3 radius | 반경 4단 토큰 + 리터럴 제거. R-14 문구 수정 |
| 선 위계(회 1.5 / 먹 3 / 고름 5 / 팻말 2) | **안 됨** | 선 굵기 토큰이 없다. 리터럴 71곳 | `border` 토큰 3단 |
| 그림자 없음 | 부분적으로 됨 | 생성물에 shadow 없음. ds Card·Sheet가 v3 shadow를 import. BigButton·StepRow 등 v3 soft 9곳 + 리터럴 3곳 | 생성기에 shadow, 'none' 값 허용 |
| 글꼴: 나눔고딕 400·700 + 팻말 나눔손글씨 붓 | **안 됨** | `roleText()`에 fontFamily가 없다. 번들된 글꼴이 0개다. Android 사용자 글꼴은 굵기마다 파일·이름을 짝지어야 한다(700을 합성하지 않음). OSS 화면에 OFL 전문을 넣어야 한다(fontCandidate.license.rule) | 글꼴 경로 1회 구축(생성기 → roleText → 번들 → OSS 고지). 붓 글꼴 획 두께는 실기기로 확인 |
| 팻말 역할 60×1.18 / 52×1.18 / 34×1.18 | **안 됨** | 새 텍스트 역할 + 새 컴포넌트(`Sign`: 못·끈·-2° 기울기·먹 테두리 2·노랑 면). 노랑 면은 바탕 대비 1.3이라 테두리가 필수이고, 이것을 컴포넌트 계약으로 강제해야 한다 | ds `Sign` 컴포넌트 + `typeRoles.sign` + 테스트('테두리 없는 노랑 금지') |
| 좌우 여백 20(어르신도) | 토큰은 됨 | legacy가 `space.screenX`(v3)·리터럴 24를 쓴다 | 단일화 |
| 본문 줄높이 20/31·16/25 | 됨 | typeRoles·lineHeightTable 두 원본(2-1 표) | 원본 하나로 |
| 테이프·스티치·폴라로이드·도장 7칸 제거 | **안 됨** | 에셋 컴포넌트(Tape·Stitch·PolaroidStack·StampRow·brandSealDeep 도장) | 화면 레인 작업 |
| P6→P7 제자리 변신(900ms) | **안 됨** | P6(KeyboardStep)·P7(CourseDone)이 따로 있는 스택 화면이다. 공유 요소 전환은 구조 변경이다. KeyboardStep은 위반이 가장 많은 화면(19)이다 | P6·P7을 한 컴포넌트의 상태로 합친다(B2 문서 3-1 제안과 같음). 비용 L |

**채택 시 이득(디자인 시스템 관점)**
- 색이 5 + 흰으로 줄어 allowed 표가 작아지고 검사하기 쉬워진다(지금 텍스트 짝 123개).
- 반경 3단(8·6·3)이면 위계가 분명하고, AI-2(같은 큰 반경)에서 벗어난다.
- '노랑 = 어르신 글자'처럼 뜻을 색 하나에 묶는 방식은 Semantic 토큰으로 표현하기 좋다(`surface.elderWord`).

**위험**
- **두 번째 대이동.** v3→v4 이행률이 6/34인 상태에서 B2를 시작하면 v3·v4·B2 세 층이 공존한다. 이것이 가장 큰 위험이다.
- 파랑 action 7.56(회백 위)은 여유가 있다. 하지만 info·done·danger까지 다시 정하지 않으면 '파랑 = 누르는 것'이 info 파랑 때문에 깨진다.
- 붓 글꼴 + 1.18 보정은 줄높이·접힘 경계(foldPush) 계산에 새 변수를 넣는다. dockLayout 추정(`charW`, 한글 1em)도 다시 맞춰야 한다.

**고칠 점(B2 문서에)**
1. done·danger·info·focus 색을 5색 팔레트 안에서 어떻게 할지 표에 넣는다(지금 표는 15짝이고 상태 색이 없다).
2. 선 굵기 3단과 반경 3단을 '토큰 이름'으로 적는다(디자인 → 생성기로 바로 옮길 수 있게).
3. 팻말 크기 '60 × 1.18'을 최종 dp로 적는다(71 또는 72). 토큰은 곱셈이 아니라 값이어야 한다.

**권장 순서**: ① v3 값을 v4에서 파생시켜 단일화(S~M) → ② 빠진 ds 부품(Dialog·Toast·ListRow·Tag, Screen list·done·state)을 만들고 legacy 화면을 이행(M~L) → ③ Primitive/Semantic 2층 + 모드(elder·child) → ④ B2를 새 모드 값으로 넣고 Sign 컴포넌트·글꼴 경로를 만든다. ③까지 되어 있으면 ④의 색·반경·선·그림자는 실제로 '토큰 교체'가 된다.

---

## 6. 하지 말아야 할 것 (디자인 시스템의 함정)

1. **v3 값을 v4로 '조용히' 덮어쓰지 않는다.** 단일화할 때 값이 바뀌는 이름(inkSub·ink)은 쓰는 화면을 목록으로 만들고 캡처로 확인한다. 갈색이 '누름' 단서였던 자리가 있으면, 차콜로 바꾸는 순간 눌리는 것처럼 보이지 않게 된다.
2. **dsBaseline 숫자만 내리는 것을 이행 완료로 세지 않는다.** 145는 `ui/` 안과 v3 토큰 참조를 세지 않는다. 'v3 import 0, legacy 컴포넌트 import 0'이 완료 조건이다.
3. **역할을 늘려서 문제를 풀지 않는다.** answer·answerRow처럼 치수가 같은 역할이 늘면, 화면 레인이 고를 것만 많아진다. 텍스트 스타일(치수)과 쓰임(이름)을 분리한다.
4. **확대 상한 단계를 화면 사정에 맞춰 늘리지 않는다.** 지금 2.0·1.5·1.3 세 단계다. 하나 더 생기면 R-11의 '화면은 상한을 고르지 못한다'가 이름만 남는다.
5. **시안을 앱에 없는 글꼴로 그리고 '1:1'이라고 부르지 않는다.** 글꼴 결정 전에는 시안을 시스템 글꼴로 렌더한 판을 기준으로 삼는다.
6. **B2를 기존 컴포넌트 위에 덧칠하지 않는다.** 팻말은 Sign 컴포넌트로 만들고, 노랑 면에는 테두리를 계약으로 강제한다. 스타일 prop으로 노랑을 넘기는 길을 열면 '노랑 = 어르신 글자'라는 뜻이 첫 주에 깨진다.
7. **자녀 화면을 화면마다 `AudienceProvider`로 감싸지 않는다.** 기본값이 elder라 하나를 빠뜨리면 자녀 화면이 어르신 치수가 된다(CG·C1·C2·C8이 지금 이 상태). 스택 루트에서 한 번만 감싼다.
