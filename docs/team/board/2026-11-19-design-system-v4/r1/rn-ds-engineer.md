# r1 · RN 디자인 시스템 엔지니어 — 독립 의견

읽은 것: 실기기 캡처 3장(C0·P6·응원 시트), app/src/ui/(tokens·Text20·BigButton·SmallButton·TextLink·TopBar·Screen·SelectCard·BottomSheet 등), app/src/app/BackBar.tsx·ChildChrome.tsx, features/child/SocialButton.tsx·ChildLogin.tsx, features/course/KeyboardStep.tsx·ToCourseHomeLink.tsx·StampRow.tsx·CourseDone.tsx, features/home/ChildHome.tsx, app/.eslintrc.js, app/package.json, __tests__/designSystem.test.tsx, design-system/tokens-v3.json, docs/design/v3/_qa/2026-11-17-impl-drift.md

## 1. 현황 수치 (grep, app/src/features + app/src/app, 2026-11-19)

| 항목 | 건수 | 대표 위치 | 판단 |
|---|---|---|---|
| `<Text20>` 사용 | 272 | — | 공용 Text 는 이미 하나로 모임 |
| 그중 `size={숫자}` 직접 | 126 (46%) | 24×44, 28×26, 22×22, 32×11, 40×7, 72×3 | **역할 없음.** 크기만 다르고 의미가 없다 = "크기만 조금 다르다"의 원인 |
| 그중 `weight="bold"` | 137 (50%) | 전 화면 | 굵기가 위계 수단이 못 됨 |
| 글자색 스타일 | inkTitle 30·inkSub 27·ink 17 | Text20 기본 `color.ink`(Text20.tsx:34) | 셋 다 갈색(#4E2F14/#744821/#85592F) = "같은 색" |
| 원시 `fontSize: 숫자` | 9 (6파일) | KeyboardStep.tsx:347·364, RoleChoiceButton.tsx:55-56, DeleteLink.tsx:17, OtpField.tsx:25, ChildLogin.tsx:231, DeleteAccountScreen.tsx:170 | 입력칸 3곳이 각자 22/24/34 |
| RN `Text` 직접 import | 4파일 | BackBar.tsx:42, SocialButton.tsx:30, RoleChoiceButton.tsx, DeleteLink.tsx | Text20 우회(한국어 줄바꿈·확대 상한 빠짐) |
| 헥스·rgba 직접 | 2 | PolaroidStack.tsx:139-140 (boxShadow) | 색 규칙은 잘 지켜짐 |
| 고정 width/height | 28 | 대부분 썸네일·스탬프·아이콘 원(KeyboardStep.tsx:346·353·368, StampRow.tsx:79) | 글자 상자 고정은 없음(문제는 다른 곳) |
| `numberOfLines` | 0 | — | 말줄임은 TextInput 한 줄 placeholder 에서 발생 |
| features 안 직접 `<Pressable>` | 23파일 | ChildHome.tsx:116(응원 선택지), ToCourseHomeLink.tsx, DeleteLink.tsx | 버튼·행·링크 공용 우회의 주 경로 |

**중복 컴포넌트**: 뒤로/보조 링크 4종 — BackBar(app/BackBar.tsx:47, 22 bold, 밑줄 없음) · TextLink(ui/TextLink.tsx:42, 20 bold 밑줄, 터치 48) · ToCourseHomeLink(20 bold 밑줄, inkSub, 터치 64) · DeleteLink(원시 Text 20). 버튼 4종 — BigButton · SmallButton · SocialButton(높이 60, 반경 12, 확대 1.3) · RoleChoiceButton. 선택지 2종 — SelectCard(라디오) · ChildHome 시트 option(Pressable+Text20 22).

## 2. 잘림의 구조적 원인

| 캡처 | 원인 코드 | 설명 |
|---|---|---|
| ① C0 카카오 잘림 | ui/Screen.tsx dock `maxHeight: height × 0.4`(layout.dock.maxHeightRatio, tokens.ts) + 안쪽 ScrollView, ChildLogin.tsx:156-163 | dock에 소셜 2(60+60)+약관 3줄+연령 1줄+링크 48+여백 ≈ 400dp 이상, S25 높이 40%(≈310dp)를 넘겨 dock이 안에서 스크롤되고 첫 버튼 윗부분이 가려진다. 스크롤된다는 표시도 없다(본문에만 있는 페이드, Screen.tsx FADE_H). **"고정 영역 상한 + 내용 과적"이 원인이고 버튼 높이는 원인이 아니다** |
| ② P6 카드 잘림 | Screen.tsx `KeyboardAvoidingView behavior="padding"` + top 고정(BackBar+StepHeader, KeyboardStep.tsx:196-202) + dock 고정(다 썼어요 72) | 자판이 열리면 본문 높이 = 화면 − 자판 − top − dock, 남는 높이가 카드보다 작아 카드 윗부분이 top 아래로 스크롤된다. impl-drift #1에서 이미 짚은 문제가 실기기에서 나옴 |
| ② 안내 말줄임 | KeyboardStep.tsx:231 `placeholder` + :364 `fontSize 34`, 한 줄 TextInput | Android 한 줄 TextInput은 placeholder를 말줄임한다. 34 글자에 "여기를 누르면 자판…"은 들어가지 않음. 안내는 placeholder가 아니라 입력칸 밖 라벨(Field.hint)이 맡아야 한다 |
| ③ 시트 선택지 단조 | ChildHome.tsx:116-126, :182-186 | 선택지 4개가 같은 Pressable+Text20 22, 위계·아이콘 없음. 시트 안 컴포넌트 규칙이 없음 |
| 뒤로 링크 작음 | BackBar.tsx:47 `fontSize 22` + `maxFontSizeMultiplier 1.5`, 아이콘 없이 문자 "‹" | 제목(28~32) 바로 위에 22 → 상대적으로 작아 보임. 문자 꺾쇠는 글자 크기를 따라 작아진다 |

곁가지: SocialButton.tsx:30 `maxFontSizeMultiplier={1.3}`, KeyboardStep.tsx:312 `={1}` 처럼 확대 상한이 컴포넌트마다 숫자로 흩어져 있다(FONT_SCALE_MAX 1.5 / BODY 2 규칙 밖).

## 3. 공통 컴포넌트와 API 초안

```ts
type Audience = 'elder' | 'child';           // Provider로 화면 트리에 한 번, prop로 덮기 가능
type TextRole = 'display'|'title'|'section'|'body'|'bodyStrong'|'caption'|'label'|'numeral'|'hand';
type Tone = 'default'|'muted'|'accent'|'done'|'danger'|'onAction';

<Text role="body" tone="muted">              // size/weight/color/style.fontSize 금지. 대체: Text20(size·weight), 원시 Text 4곳
<Heading level={1|2|3}>                      // = Text role title/section + accessibilityRole header 자동. 대체: Text20 size 28/24 bold 70건
<Screen variant="form"|"step"|"list"|"sheetHost"|"intro" top={<TopBar/>} dock={<Dock/>}>
  // variant가 dock 상한·키보드 정책을 정한다. form/step: 자판 열리면 dock을 자판 위로 붙이고 top을 접음
<TopBar back={{label, onPress, kind:'prev'|'course'}} title? action?>   // 대체: BackBar·TopBar·StepHeader 머리
<BackLink kind="prev"|"course" />            // 아이콘(chevron 28)+글자 role label(elder 24), 터치 64. 대체: BackBar 본체·ToCourseHomeLink
<Button kind="primary"|"secondary"|"text"|"danger" size="dock"|"inline" label icon? loading? disabledReason?/>
  // audience로 높이·글자 결정. 대체: BigButton·SmallButton·TextLink·DeleteLink·SkipLink
<SocialButton provider="kakao"|"google" />  // 브랜드 가이드 고정, ui/로 이동, minHeight만(고정 height 없음)
<Dock primary secondary? note? />            // 최대 버튼 1+보조 1+한 줄 note. 그 이상은 타입 에러(note는 string 1개)
<Card tone="paper"|"polaroid"|"notice"> / <Section title>   // 대체: 화면별 card 스타일(KeyboardStep styles.card 등)
<ListRow title subtitle? leading? trailing="chevron"|"switch"|ReactNode onPress?>  // 대체: SettingsRow·RoleChoiceButton·ParentFamily rowIcon
<Sheet title body? actions?> / <Dialog>      // BottomSheet·Dialog 이름 유지, 본문은 Text role만
<Choice items={{key,label,icon?,hint?}[]} mode="radio"|"action" layout="card"|"chip" />  // 대체: SelectCard, ChildHome 응원 option
<Field label hint? error? kind="text"|"email"|"otp"|"word" />  // 안내는 hint(여러 줄), placeholder 금지. 대체: 입력칸 4곳
<Banner tone> / <Toast tone>                 // 기존 유지, 글자 role caption 이상(자녀 20, impl-drift #5)
<StateView kind="loading"|"empty"|"error" title body action? />  // 대체: 화면별 error·loading 분기(ChildHome.tsx:76-86)
```

## 4. 토큰 v4 구조

3층: `palette`(원시: brown50~900, green, red, sun, neutral) → `role`(ink.title/body/muted/accent, surface.paper/card/sunk, action.*, status.*) → `component`(button.primary.bg, text.title.size …). 컴포넌트·화면은 role/component만 import, palette는 ui/tokens 밖에서 import 금지.
- audience별 role 값: `type.elder.title = {size:32, weight:'700', line:44, tone:'title'}`, `type.child.title = {size:30 …}`. 단조로움 해결은 **크기 아니라 weight 3단(400/600/800)·tone 대비(title 진한 갈색 vs muted 회갈색 vs accent 1색)** 를 role에 박는 것 — 값 결정은 비주얼 위원 몫.
- 원본은 `design-system/tokens-v4.json` 하나, `scripts/gen-tokens.ts`로 `ui/tokens.generated.ts` 생성. designSystem.test.tsx의 "tokens = tokens-v3.json" 비교를 v4 생성물 비교로 바꾸고 v3 이름은 별칭(@deprecated)으로 한 릴리스 유지.

## 5. 규칙을 코드로 강제

```js
// .eslintrc.js overrides — files: ['src/features/**','src/app/**'] (ui/ 제외)
'no-restricted-syntax': ['warn',
  {selector: "Property[key.name=/^(fontSize|fontWeight|lineHeight|color)$/]", message: 'Text role/tone 사용'},
  {selector: "Property[key.name=/^(height|maxHeight)$/][value.type='Literal']", message: '글자 담는 상자 고정 높이 금지(minHeight)'},
  {selector: "JSXAttribute[name.name=/^(numberOfLines|maxFontSizeMultiplier|placeholder)$/]", message: '확대 상한·말줄임은 ui 컴포넌트만'},
  {selector: "JSXAttribute[name.name='size'][parent.name.name='Text20']", message: 'role 사용'}],
'no-restricted-imports': [{name:'react-native', importNames:['Text','TextInput','Pressable'], message:'ui/ 컴포넌트 사용'}]
```
- 타입: `Text`의 props를 `Omit<TextProps,'style'> & {role; tone?; style?: LayoutOnlyStyle}`(margin·align만 허용)로 막는다. 기존 layerBaseline처럼 `__tests__/dsBaseline.test.ts`가 위반 수를 고정(늘면 실패).
- RNTL로 되는 것: fontScale 2.0 주입(`useWindowDimensions` mock) 후 dock 내용 수·Dock 슬롯 초과 검사, 각 role의 `maxFontSizeMultiplier`·minHeight 존재, 응원 Choice 항목 a11y role. **안 되는 것**: 실제 줄바꿈·잘림·자판 높이(Yoga 레이아웃 측정 없음). 이건 Maestro(글자 200%·320×640 에뮬레이터 캡처+`assertVisible` 카카오/입력칸) + 실기기 S25 체크리스트로.
- 대비: tokens-v4.json의 허용 조합(tone×surface) 목록을 테스트가 WCAG 식으로 계산해 4.5 미만이면 실패(본문 20+, 큰 글자 3.0).

## 6. 이행 전략·추정 (모두 추정)

| 단계 | 내용 | 시간 |
|---|---|---|
| 0 | tokens-v4.json + 생성 스크립트 + 대비 테스트 | 4~6h |
| 1 | Text/Heading/Button/BackLink/TopBar/Dock/Field/Choice/SocialButton(ui 이동) + 단위 테스트, 기존 이름은 새 컴포넌트를 감싸 호환 | 12~16h |
| 2 | Screen variant(dock 상한·자판 정책) + C0·P6·응원 시트 먼저 교체(캡처 3건 해결) | 6~8h |
| 3 | 화면별 교체(53 tsx, 하루 8~10화면) + lint warn | 16~24h |
| 4 | 기준선 0 도달 후 lint error, Maestro 200% 플로 4개 | 6~8h |
| 계 | | **약 44~62h** |

## 7. 쟁점과 입장

1. **"크기 키우기" vs "역할로 대비"** (비주얼·접근성 위원): 글자를 더 키우면 dock 과적이 심해진다. 크기는 유지하고 weight·tone·면(Card)으로 위계 → 찬성 쪽.
2. **dock 상한 40% 유지 여부** (UX): 상한은 유지하되 Dock 슬롯을 타입으로 제한하고 약관 같은 글은 dock 밖 본문 끝으로. 상한을 풀면 200%에서 본문이 사라진다.
3. **placeholder 금지** (카피): 안내는 Field.hint로 입력칸 밖에 여러 줄. 입력칸 안 짧은 예시만 허용하자는 안엔 반대(34 글자에선 짧은 예시도 잘림).
4. **lint error 시점**: 한 번에 error로 올리면 기존 PR이 다 막힌다. 기준선 테스트로 "늘지 않게"만 먼저, error는 4단계 → 빨리 막자는 쪽과 부딪힐 것.
