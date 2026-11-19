# 디자인 도구 조사: "Claude Code를 디자인 스튜디오로" 목록 검증 (2026-11-19)

계기: 오너가 링크드인 글 캡처("Claude Code를 디자인 스튜디오로 만들어주는 무료 도구 20개")를 보내며 참고할 만한 레포가 있는지 찾아보라고 했다.

범위: **조사·추천만** 했다. 스킬·MCP·npm은 하나도 설치하지 않았다. 원격 파일은 `gh api`로 읽기만 했고, 데이터 일부(UI UX Pro Max 팔레트 CSV)는 임시 폴더에 내려받아 대비만 계산했다.

수치 출처: 스타·라이선스·최근 push는 GitHub API(`gh api repos/…`)로 **2026-11-19에 확인**했다. 글에 적힌 수치와 소속은 이 값으로 바로잡았다.

## 우리 맥락 (판정 기준)
- **RN 0.88.1 CLI 앱**이다. 웹 앱이 아니다. 시안만 HTML(`docs/design/**/*.dc.html`, Chrome headless 렌더)이다.
- 사용자는 **어르신(70대)과 자녀** 두 부류다. 어르신 글자 대비는 7:1, 자녀는 4.5:1, 경계·아이콘은 3:1이다(RULES-V4 R-01, `allowed` 표).
- 디자인 시스템 v4가 이미 있다.
  - 값: `design-system/tokens-v4.json`
  - 규칙: `RULES-V4.md` R-01~R-20(검사 방법 포함)
  - 대비 계산: `contrast-v4.py --check`
  - 컴포넌트: `app/src/ui/ds`
  - 시안 색인: `docs/design/V4-INDEX.md`
- UX 깊이 회의 결론(`docs/team/board/2026-11-19-ux-deep/SUMMARY.md` (g))에 따라 **빌드 1에는 런타임 라이브러리를 추가하지 않는다.** dev 의존성은 eslint-plugin-react-native-a11y만 선택 사항이다.
- 이미 쓰는 도구:
  - gstack 스킬: design-review, design-consultation, design-shotgun, design-html, diagram(Excalidraw)
  - Figma MCP(공식)
  - Claude in Chrome, Playwright MCP
  - Maestro(`app/e2e`)
  - vercel-react-native-skills

## 1. 확인 표

판정 기준:
- **A**: 지금 우리 워크플로에 바로 도움이 된다.
- **B**: 참고만 한다(문서·아이디어를 빌려 온다).
- **C**: 맞지 않는다.

| 도구 | 실제 저장소 | 무엇 | 라이선스 | 스타(11-19) | 최근 push | 판정 | 우리에게 |
|---|---|---|---|---|---|---|---|
| UI UX Pro Max | [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) | 스타일·팔레트·폰트 조합 CSV를 검색하는 디자인 스킬(Python 검색 스크립트), v2.15.0 | MIT | 151,572 (글의 '15만+'와 일치) | 2026-11-19 | **B** | 3-3절. 7:1 기준과 충돌하고 RN 지침이 우리 결정과 어긋나며, 플러그인이 스킬 7개를 한꺼번에 깐다 |
| frontend-design (Anthropic) | [anthropics/skills/skills/frontend-design](https://github.com/anthropics/skills/tree/main/skills/frontend-design) | 'AI가 만든 티'가 나는 기본값을 피하고 의도적으로 고르게 하는 지침. SKILL.md 한 파일, 스크립트 없음 | Apache-2.0 (스킬 폴더 LICENSE.txt) | 저장소 197,493 | 스킬 2026-09-03 (41bbe19) | **A**(시안 HTML 한정) | 3-5절. 웹 지침이지만 `.dc.html` 시안을 그릴 때 기본값 점검표로 쓸 수 있다 |
| canvas-design (Anthropic) | [anthropics/skills/skills/canvas-design](https://github.com/anthropics/skills/tree/main/skills/canvas-design) | 포스터·정적 그림을 PNG/PDF로 만든다(폰트 묶음 포함) | Apache-2.0 | 〃 | 〃 | **B** | 스토어 그래픽·마케팅 이미지에 쓸 수는 있다. 앱 UI와는 무관하다 |
| pptx (Anthropic) | [anthropics/skills/skills/pptx](https://github.com/anthropics/skills/tree/main/skills/pptx) | PowerPoint 생성·편집 | Apache-2.0 (스킬 폴더 기준) | 〃 | 〃 | **C** | 디자인 작업과 무관하다. 이미 내장 스킬(anthropic-skills:pptx)로 쓸 수 있어 중복이다 |
| theme-factory·brand-guidelines (Anthropic, 글 밖) | [anthropics/skills](https://github.com/anthropics/skills/tree/main/skills) | 테마 10종 적용, Anthropic 브랜드 적용 | Apache-2.0 | 〃 | 〃 | **C** | 문서·슬라이드용이고 Anthropic 브랜드 전용이다 |
| DESIGN.md (Google Labs, Stitch) | [google-labs-code/design.md](https://github.com/google-labs-code/design.md) | YAML 토큰 + 마크다운 '이유'를 한 파일에 담는 형식. lint·diff·export(DTCG·Tailwind) CLI `@google/design.md` 0.4.0, 스스로 **alpha**라고 밝힘 | Apache-2.0 | 28,958 | 2026-11-18 | **B**(병행 생성물 후보) | 3-1절. 대체하지 않고, 필요할 때 tokens-v4.json에서 파생 파일로 만든다 |
| awesome-design-md (글 밖) | [VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md) | 유명 브랜드 DESIGN.md 모음 | MIT | 128,217 | 2026-10-28 | **B** | 파일 쓰는 법의 예시로만 본다. 브랜드를 따라 하면 안 된다 |
| Astryx (Meta) | [meta/astryx](https://github.com/meta/astryx) (facebook/astryx에서 옮겨짐) | React 19 + StyleX 웹 디자인 시스템(150+ 컴포넌트, CLI·MCP·llms.txt), v0.7.16, Beta | MIT | 30,763 (글의 9천·6.2천은 옛 스냅샷) | 2026-11-19 | **B** | 3-2절. 웹(DOM·CSS) 전용이라 RN에 가져올 수 없다. API 규약과 'vibe test'는 빌려 올 만하다 |
| Figma Context MCP (Framelink) | [GLips/Figma-Context-MCP](https://github.com/GLips/Figma-Context-MCP) | Figma 레이아웃을 요약해 에이전트에 준다. 개인 Figma API 토큰이 필요 | MIT | 16,262 | 2026-11-15 | **C** | 공식 Figma MCP를 이미 쓰고 있어 중복이다. 토큰을 하나 더 관리해야 한다 |
| Figma MCP 가이드 (글 밖) | [figma/mcp-server-guide](https://github.com/figma/mcp-server-guide) | 공식 Figma MCP 사용 가이드·스킬 | 표기 없음 | 2,212 | 2026-11-18 | **B** | 이미 쓰는 Figma MCP를 쓸 때 참고한다 |
| agent-browser (Vercel) | [vercel-labs/agent-browser](https://github.com/vercel-labs/agent-browser) | 에이전트용 브라우저 자동화 CLI(Chrome for Testing·CDP) | Apache-2.0 | 52,771 | 2026-11-19 | **C** | 웹 전용이다. 시안 렌더는 Chrome headless·Playwright·Claude in Chrome으로 이미 하고 있어 중복이다 |
| Excalidraw MCP | [excalidraw/excalidraw-mcp](https://github.com/excalidraw/excalidraw-mcp) / [yctimlin/mcp_excalidraw](https://github.com/yctimlin/mcp_excalidraw) | 손그림풍 다이어그램 생성 | 공식은 표기 없음 / MIT | 5,691 / 2,670 | 03-24 / 11-10 | **C** | gstack `diagram` 스킬이 이미 .excalidraw를 만든다. 공식 저장소는 8개월째 push가 없다 |
| 아이콘: Lucide | [lucide-icons/lucide](https://github.com/lucide-icons/lucide) | 오픈소스 아이콘 세트(lucide-react-native 있음) | ISC | 25,864 | 2026-11-19 | **B** | 자체 `ui/assets/icons`가 있고 런타임 추가 0 원칙이 있다. SVG를 골라 쓸 원천으로만 본다 |
| 배경 제거: rembg | [danielgatis/rembg](https://github.com/danielgatis/rembg) | 로컬 배경 제거(Python) | MIT | 25,580 | 2026-11-06 | **B** | 스토어·마케팅 이미지 작업에 쓸 수 있다. 앱 런타임과는 무관하다 |
| 배경 제거: background-removal-js | [imgly/background-removal-js](https://github.com/imgly/background-removal-js) | 브라우저 배경 제거 | **AGPL-3.0** | 7,379 | 2025-07-18 | **C** | AGPL이고 1년 넘게 push가 없다 |
| Tailwind CSS | [tailwindlabs/tailwindcss](https://github.com/tailwindlabs/tailwindcss) | 유틸리티 CSS | MIT | 98,647 | 2026-11-18 | **C** | RN StyleSheet와 역할 토큰(R-02: 숫자·hex 직접 지정 금지) 체계와 맞지 않는다. Tailwind를 전제로 한 도구도 전부 C다 |
| mobile-mcp (글 밖) | [mobile-next/mobile-mcp](https://github.com/mobile-next/mobile-mcp) | 에이전트가 Android·iOS 에뮬레이터와 **실기기**를 접근성 트리와 스크린샷으로 조작하는 MCP, 1.0.18 | Apache-2.0 | 10,712 | 2026-11-18 | **A** | 3-4절. 우리 빈칸(실기기·에뮬레이터 확인)을 직접 메운다 |
| Maestro (글 밖) | [mobile-dev-inc/Maestro](https://github.com/mobile-dev-inc/Maestro) | 모바일 E2E | Apache-2.0 | 16,454 | 2026-11-19 | (이미 사용) | `app/e2e`의 캡처 회귀(R-15 검사 방법) |
| Callstack RN 스킬 (글 밖) | [callstackincubator/agent-skills](https://github.com/callstackincubator/agent-skills) | RN 모범 사례·업그레이드·내비게이션 스킬 | MIT | 1,713 | 2026-10-08 | **C**(디자인 범위 밖) | 디자인 도구가 아니다. vercel-react-native-skills와 겹친다 |
| 모바일 접근성 스킬 (글 밖) | [Community-Access/accessibility-agents](https://github.com/Community-Access/accessibility-agents) (`kb-mobile-accessibility`) | RN·네이티브 접근성 점검 지식 스킬 | MIT | 449 | 2026-11-16 | **B** | WCAG 2.2 AA 기준이다. 어르신 7:1·200% 기준은 우리 RULES가 더 엄격하다. 점검 항목만 참고한다 |
| 웹 품질 스킬 (글 밖) | [addyosmani/web-quality-skills](https://github.com/addyosmani/web-quality-skills) | 웹 접근성·성능 | MIT | 3,110 | 2026-08-24 | **C** | 웹 전용이다 |
| Style Dictionary (글 밖) | [style-dictionary/style-dictionary](https://github.com/style-dictionary/style-dictionary) | 토큰을 여러 플랫폼 코드로 변환하는 빌드 도구 | Apache-2.0 | 4,887 | 2026-11-03 | **B** | 지금은 토큰 → TS 변환 1곳뿐이라 과하다. 토큰 소비처가 3곳 이상(웹 site·앱·시안)으로 늘면 다시 본다 |
| DTCG 명세 (글 밖) | [design-tokens/community-group](https://github.com/design-tokens/community-group) | W3C 디자인 토큰 형식 | W3C(NOASSERTION) | 2,178 | 2026-11-01 | **B** | DESIGN.md export가 이 형식이다. 외부 교환이 필요할 때의 공통어 |
| Material Color Utilities (글 밖) | [material-foundation/material-color-utilities](https://github.com/material-foundation/material-color-utilities) | HCT 색공간 톤 팔레트(톤 차이로 대비를 보장) | Apache-2.0 | 2,305 | 2026-11-16 | **B** | 3-3절. 단조로움을 깨는 옅은 면 색을 7:1을 지키며 뽑는 방법 |
| Pretendard (글 밖) | [orioncactus/pretendard](https://github.com/orioncactus/pretendard) | 한국어 system-ui 대체 글꼴 | SIL OFL 1.1 (LICENSE 원문) | 3,657 | 2026-07-23 | **B** | `fontCandidate.compareChecklist`(20px 받침, 1·7·0·6 구분, 굵기 3단)로 비교할 후보에 넣는다. 번들 여부는 별도 결정 |
| Android ATF (글 밖) | [google/Accessibility-Test-Framework-for-Android](https://github.com/google/Accessibility-Test-Framework-for-Android) | Android 접근성 검사(터치 크기·대비·라벨) | Apache-2.0 | 526 | 2024-04-03 | **C** | 2년째 push가 없다. RN 렌더 테스트와 Maestro로 대신한다 |

글의 '20개' 가운데 캡처에 이름이 나온 것만 확인했다. 나머지 목록 항목은 **미확인**이다(원문 캡처에 이름이 없다).

## 2. 분류 요약
- **A (지금 도움)**
  - **mobile-mcp**: 실기기·에뮬레이터 확인과 디자인 리뷰 자동화
  - **frontend-design**: `.dc.html` 시안 품질(기본값 점검)
- **B (참고)**
  - DESIGN.md·awesome-design-md
  - Astryx(API 규약·vibe test)
  - UI UX Pro Max(데이터만)
  - canvas-design, Lucide, rembg, Figma MCP 가이드
  - 접근성 스킬(점검 항목)
  - Style Dictionary·DTCG, Material Color Utilities, Pretendard
- **C (맞지 않음)**
  - **웹 전용**: agent-browser, web-quality-skills
  - **중복**: Figma Context MCP(공식 Figma MCP), Excalidraw MCP(gstack diagram), pptx·theme-factory·brand-guidelines
  - **Tailwind 전제**: Tailwind
  - **라이선스·방치**: imgly background-removal-js(AGPL), Android ATF(2년째 push 없음)
  - **범위 밖**: Callstack RN 스킬

## 3. 깊이 본 것

### 3-1. DESIGN.md를 쓰면 지금 방식보다 나은가 → 대체하지 않는다. 필요할 때 파생 파일로만 만든다
DESIGN.md가 하는 일:
- YAML 토큰(colors, typography, rounded, spacing, motion, components)에 '이유' 산문을 붙이고, 산문 절 순서를 고정한다(Overview → Colors → … → Do's and Don'ts).
- lint·diff·export CLI가 있다.
- 출처: [README](https://github.com/google-labs-code/design.md), 0.4.0(2026-07-27).

우리 `tokens-v4.json`+`RULES-V4.md`와 비교:

| 기준 | DESIGN.md | 지금(v4) |
|---|---|---|
| 대비 검사 | `contrast-ratio` 규칙이 **WCAG AA 4.5:1 고정**이고 component의 backgroundColor/textColor 짝만 본다 | 역할×면 **전수** 계산 + 대상별 7:1/4.5:1/3:1 + `allowed` 표 일치(`contrast-v4.py --check`) |
| 대상별(어르신·자녀) 값 | 중첩 그룹으로 흉내만 낼 수 있다. 의미 규칙은 없다 | `audience`별 typeRoles·minHeight·확대 상한 |
| 단위 | px·em·rem(웹) | dp 숫자, `maxFontSizeMultiplier` 역할 토큰 |
| 규칙 강제 | Do's/Don'ts 산문(사람·에이전트가 읽음) | R-01~R-20이 lint·렌더·캡처 검사에 묶여 있다 |
| 다른 도구와의 호환 | Stitch·Figma Make·외부 에이전트가 바로 읽고, DTCG로 export한다 | 우리 저장소 안에서만 읽는다 |
| 성숙도 | alpha(형식·CLI가 아직 바뀜) | 확정(11-19) |

결론:
- 정본은 지금처럼 tokens-v4.json + RULES-V4.md로 둔다. DESIGN.md로 옮기면 7:1·allowed 표·audience 구분을 잃는다.
- 빌려 올 것 두 가지:
  - ① 값마다 **'왜' 한 줄**을 붙이는 산문 절. RULES-V4 하단 "바꾼 것(이유)"처럼 이미 일부는 하고 있다.
  - ② **Do's and Don'ts** 절을 에이전트용 요약으로 두기
- 병행 조건: 외부 생성 도구(Figma Make·Stitch 등)에 우리 톤을 넘길 일이 생기면 `design-system/DESIGN.md`를 **tokens-v4.json에서 스크립트로 생성**한다. 손으로 고치면 두 정본이 생긴다.
  - lint의 contrast 경고는 4.5 기준이라 믿지 않는다. 대비 검사는 `contrast-v4.py`가 계속 맡는다.

### 3-2. Astryx에서 우리 ds 컴포넌트 API에 빌려 올 점
Astryx는 React DOM + StyleX라 코드는 쓸 수 없다. 대신 규약과 평가 방법을 볼 만하다.
- 출처: [API Conventions wiki](https://github.com/meta/astryx/wiki/API-Conventions), [vibe test 글](https://github.com/meta/astryx/blob/main/apps/docsite/src/content/blog/posts/vibe-tests.md), 11-19 확인.

빌려 올 규약:
- **상태 불리언에 `is`/`has` 접두사**(`isDisabled`, `isLoading`). 우리 `Button`은 `disabled`·`loading`이다. 새 컴포넌트부터 맞출지는 DS 레인이 판단한다. 바꾸면 호출부가 바뀌므로 빌드 1에는 권하지 않는다.
- **비활성 이유를 prop으로 받는다**(`disabledMessage`). 툴팁으로 감싸지 않는다. 우리 `disabledReason`과 같은 방향이라 지금 설계가 맞다는 근거다.
- **`label`은 누르는 요소의 필수 prop**이다. 우리 Button도 `label: string` 필수다. BackLink·Choice·ListRow에도 같은 원칙(보이는 글 = TalkBack 라벨, R-14)을 타입으로 강제할 수 있다.
- **방향 prop은 start/end**(`startIcon`)다. RTL이 없어도 이름을 통일할 가치가 있다.
- **계약 prop(role·aria)은 `...rest` 뒤에 둔다.** 호출부가 접근성 역할을 덮어쓰지 못하게 한다. RN에서는 `accessibilityRole`·`accessibilityLabel`을 `...rest`보다 뒤에 펼친다.
- **escape hatch는 정해진 길 하나**만 둔다(xstyle→className→style). 우리 `LayoutOnlyStyle`(배치만 허용)이 더 엄격하고 R-02에 맞다. 유지한다.

다른 점:
- Astryx 원칙 "Guidance over enforcement"(값을 넘기면 그대로 그린다)는 우리 R-02(숫자·hex 금지)와 정반대다.
- 어르신 7:1처럼 틀리면 바로 사고가 나는 기준은 강제가 맞다. Astryx를 따라 풀지 않는다.

가장 빌려 올 만한 것은 **vibe test**다.
- 방식: 맥락 없는 하위 에이전트에게 같은 프롬프트("○○ 화면을 만들어라")로 우리 ds를 쓰게 하고, 별도 판정 에이전트가 결과를 채점한다(없는 컴포넌트를 지어냄, 원시 Text·Pressable 사용, 숫자 리터럴, 잘못 고른 틀).
- 효과: 에이전트가 ds를 얼마나 맞게 쓰는지 측정해 문서·API가 나쁜 곳을 찾는다.
- 비용: 설치 없이 지금 도구(Agent·lint·RNTL)로 할 수 있다. 빌드 2 후보로 둔다.

### 3-3. UI UX Pro Max 팔레트·폰트가 '단조로움'에 주는 시사점 (7:1과 충돌하는지)
팔레트 194개(`colors.csv`, v2.15.0)를 WCAG 2.x 상대휘도로 계산했다(11-19, 스크립트는 저장소 밖 임시 파일).

| 짝 | 7:1 이상 | 4.5:1 이상 | 최솟값 |
|---|---|---|---|
| Foreground / Background | 192/194 | 194 | 5.92 |
| Muted Foreground / Background | 135/194 | 193 | 1.63 |
| On Primary / Primary(버튼 글자) | **68/194** | 194 | 4.60 |
| Primary / Background(링크·행동 글자) | **40/194** | 100 | 1.11 |
| On Accent / Accent | 22/194 | 194 | 4.70 |

- 다섯 짝이 모두 7:1인 팔레트는 **2개**(Museum/Gallery, Earth Observation)뿐이다.
- 'Senior Care/Elderly' 팔레트(#0369A1 계열):
  - 본문 8.87, 보조 7.11은 7:1을 넘는다.
  - 버튼 글자 5.93, 행동 글자 5.57, 강조 6.37은 **어르신 7:1 미달**이다.
- 즉 이 데이터는 **AA(4.5) 기준으로 만든 것**이다. 그대로 가져오면 R-01이 깨진다.

다른 문제:
- 폰트 조합 74개 중 한국어는 'Korean Modern'(Noto Sans KR+Noto Sans KR) 1개뿐이다. 이미 쓰는 글꼴이다.
- RN 지침 CSV가 "Use expo-image"를 권한다. UX 깊이 회의 (g)의 '넣지 말 것'(Expo 모듈이 통째로 들어옴)과 충돌한다.
- 플러그인은 스킬 **7개**(banner-design, brand, design-system, design, slides, ui-styling, ui-ux-pro-max)를 한 번에 깐다.
  - 스크립트(.cjs·.py)가 함께 들어온다.
  - 저장소 `stack/.claude/settings.json`에는 `enableAllProjectMcpServers: true`와 `Read(//home/**)` 허용 같은 넓은 권한 예시가 있다.
- 글의 '80 스타일·192 팔레트·74 폰트'는 README 기준 **80(활성 51)·194·74**다.

시사점:
- 단조로움의 원인(v4 SUMMARY A1~A6)은 팔레트가 부족해서가 아니다. **구분 신호가 '갈색 명도'와 '크기 조금'뿐**이었던 것이 원인이다. v4는 이미 역할 분리(inkTitle·inkSub·action·info·accent 1곳)로 이 문제를 풀고 있다.
- 빌릴 것은 팔레트 값이 아니라 **팔레트의 구조**다. 제품 유형마다 Primary / Accent / Muted / Border 역할을 따로 둔다.
- 변화를 더하는 쪽은 7:1 대상이 아닌 곳에 둔다.
  - **면(surface)**: 옅은 띠·카드 바탕. 경계 3:1만 지키면 된다.
  - **아이콘·일러스트**
- 옅은 면 색을 늘릴 때는 Material Color Utilities의 HCT처럼 **톤 값을 고정하고 색상(hue)만 바꾸는** 방식으로 뽑는다. 그러면 글자 대비가 유지된다. `contrast-v4.py`로 다시 검증한다.

덧붙임(frontend-design에서):
- 이 스킬은 'AI가 만든 티' 1번으로 "**#F4F1EA 근처 따뜻한 크림 바탕** + 테라코타 계열 강조"를 든다.
- 우리 종이 #F6F3EE와 갈색·주홍 도장이 이 묶음에 가깝다.
- 바탕을 바꾸자는 뜻은 아니다(종이 은유가 제품 정체성이다). 다만 **'평범해 보이는' 인상이 바탕과 강조색의 흔한 조합에서도 온다**는 점을 오너 피드백 해석에 더해 둔다. 차별화는 도장·폴라로이드·손글씨처럼 우리만의 요소 한 곳에 몰아서 쓰는 쪽이 이 스킬의 권고("대담함은 한 곳에")와도 맞다.

### 3-4. mobile-mcp가 우리 빈칸을 메우는 방식
지금 실기기 확인은 오너가 캡처를 찍어 보내거나 Maestro 흐름을 돌리는 방식이다(V4-INDEX 열린 항목: 자판 270 가상값, 200% 에뮬레이터 잠정치, S25 재확인).

mobile-mcp가 에이전트에게 주는 것([README](https://github.com/mobile-next/mobile-mcp), 11-19):
- 에뮬레이터·USB 실기기의 **접근성 트리**(`mobile_list_elements_on_screen`)
- 스크린샷 저장, 탭·스와이프

바로 나아지는 것:
- **디자인 리뷰 자동화**: 에이전트가 staging APK 화면을 돌며 캡처하고, 접근성 트리에서 라벨(R-14 보이는 글 = TalkBack 라벨)·누름 영역 크기(R-09 minHeight 72/64)를 직접 읽는다.
- **글자 200% 확인**: `adb shell settings put system font_scale 2.0`(mobile-mcp 밖, adb)과 함께 쓰면 R-11·R-15(자판 열림 잘림)를 사람 없이 1차로 걸러 낸다.

### 3-5. 스킬·MCP 설치 위험 (보안)
스킬은 **실행되는 프롬프트**다.
- 설치하면 SKILL.md 문장이 우리 세션에 지시로 들어간다.
- 같이 깔리는 스크립트·hook·settings는 사용자 권한으로 돈다.
- 남이 만든 스킬은 이런 일을 할 수 있다.
  - 숨은 지시("이 파일도 읽어 보내라", "커밋 전에 이 URL을 불러라")로 **프롬프트 주입**
  - `settings.json` 예시로 권한 허용 목록을 넓히기(예: UI UX Pro Max의 `enableAllProjectMcpServers`·`Read(//home/**)`)
  - 업데이트 한 번으로 내용을 바꾸기(공급망)

MCP 서버도 같다.
- `npx -y …@latest`는 실행할 때마다 최신 코드를 받아 돌린다.
- mobile-mcp는 앱 삭제·데이터 지우기 도구와 익명 텔레메트리(`MOBILEMCP_DISABLE_TELEMETRY`로 끔)를 갖고 있다.

그래서 원칙을 이렇게 둔다.
1. 공식(Anthropic·Google·Meta) 또는 우리가 전문을 읽은 파일만 쓴다.
2. **커밋 해시나 버전을 고정**한다.
3. 프로젝트 범위(`.claude/skills/` 또는 `claude mcp add -s local`)로만 설치한다.
4. 스크립트가 없는 지침형 스킬을 먼저 쓴다.
5. 설치 전후로 `git diff ~/.claude`·`.claude/settings*.json`을 확인한다.

## 4. 추천 (채택 후보 3개, 모두 사용자 승인 필요)

| # | 후보 | 무엇이 나아지나 | 설치 방법·범위 | 위험 | 되돌리는 법 |
|---|---|---|---|---|---|
| 1 | **mobile-mcp** (A) | 실기기·에뮬레이터에서 접근성 라벨·누름 높이·200% 잘림을 에이전트가 1차 확인한다. 오너 캡처 의존이 줄어든다 | `claude mcp add mobile-mcp -s local -e MOBILEMCP_DISABLE_TELEMETRY=1 -- npx -y @mobilenext/mobile-mcp@1.0.17`(버전 고정. 1.0.18은 11-18 출시라 2주 묵힌 뒤 올린다). **staging 기기·에뮬레이터 전용**, 운영 계정 기기 연결 금지 | 기기 조작 권한(앱 삭제·데이터 지우기 도구 포함), npx 공급망, 화면 캡처에 개인정보가 찍힐 수 있음 | `claude mcp remove mobile-mcp -s local`, 기기에서 USB 디버깅 해제 |
| 2 | **frontend-design 스킬** (A, 시안 HTML 한정) | `.dc.html` 시안을 그릴 때 'AI 기본값' 점검(크림 바탕+테라코타, 같은 카드 반복, 대문자 라벨, '→' 붙이기)과 "대담함은 한 곳에" 원칙으로 단조로움·흔한 인상을 줄인다 | anthropics/skills 41bbe19의 `skills/frontend-design/SKILL.md`를 **전문을 읽은 뒤** 프로젝트 `.claude/skills/frontend-design/`에 복사한다(스크립트 없음, Apache-2.0 고지 유지). 맨 위에 "RULES-V4·tokens-v4가 이 지침보다 우선, 앱 RN 코드에는 쓰지 않음" 한 줄을 덧붙인다 | "미적 위험을 감수하라"는 문장이 R-01·R-17과 부딪힐 수 있다 → 우선순위 줄로 막는다. 웹 전제 문장(hero·hover) 혼입 | 폴더 삭제 한 번 |
| 3 | **DESIGN.md 파생 파일 + vibe test 방식** (B → 필요할 때) | 외부 생성 도구에 우리 톤을 한 파일로 넘긴다. 에이전트가 ds를 맞게 쓰는지 측정한다(Astryx식) | 설치 없음. ① `design-system/scripts/`에 tokens-v4.json → `DESIGN.md` 생성 스크립트(정본은 JSON, 생성물은 손대지 않음). lint는 `npx @google/design.md@0.4.0 lint`를 일회성으로만 쓰고, 대비 판정은 `contrast-v4.py`. ② vibe test는 Agent 도구 + lint·RNTL로 빌드 2에 시험한다 | DESIGN.md는 alpha라 형식이 바뀐다. contrast 경고가 4.5 기준이라 오해할 수 있다 | 생성 파일·스크립트 삭제 |

**사용자 승인이 필요한 항목**
- 1번: MCP 추가 자체, adb로 실기기 연결, 텔레메트리 끄기 확인
- 2번: 외부 스킬 파일을 저장소에 넣는 것
- 3번: `npx @google/design.md` 일회 실행(네트워크로 패키지를 받아 실행), 생성 스크립트 추가

**지금 하지 않을 것**
- UI UX Pro Max 설치(7:1 충돌, expo-image 권고, 스킬 7개 묶음, 넓은 권한 예시)
- Figma Context MCP·Excalidraw MCP·agent-browser(중복)
- Tailwind 계열 전부
