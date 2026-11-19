# 디자인 시스템 v4 규칙 (값 확정, 2026-11-19)

원문: `docs/team/board/2026-11-19-design-system-v4/SUMMARY.md` 2~3절, 표결 Q2~Q11. 값의 원본은 `tokens-v4.json`(DS 레인이 코드 토큰으로 옮김). v3 이름은 한 릴리스 별칭(`v3Aliases`). 대비 계산은 `design-system/scripts/contrast-v4.py`(값이 바뀌면 다시 실행, `--check`로 검사).

## 규칙 표 (검사 가능한 문장)
검사 방법 약어: **토큰** = 토큰 테스트(tokens-v4.json 기반), **lint** = eslint 규칙, **렌더** = RNTL 화면 렌더 테스트, **캡처** = Maestro·실기기 캡처 회귀, **사람** = 디자인 리뷰.

| ID | 규칙 | 검사 방법 | 담당 |
|---|---|---|---|
| R-01 | 글자색·면의 짝은 `allowed` 표(역할×면)에 있는 것만 쓴다. 어르신 7:1, 자녀 4.5:1, 경계·아이콘 3:1 | 토큰: `contrast-v4.py --check` OK + 컴포넌트가 쓰는 짝이 allowed에 있는지 | DS 레인(L4) |
| R-02 | 화면은 역할(role·tone)만 고른다. hex 색·fontSize·fontWeight·lineHeight 숫자 리터럴 금지 | lint: `no-restricted-syntax`(features/·app/) → 처음엔 warn, AU-10에 error | DS 레인 |
| R-03 | RN의 Text·TextInput·Pressable 직접 import 금지(공통 컴포넌트만) | lint: `no-restricted-imports` | DS 레인 |
| R-04 | 한 화면에 700 굵기를 쓰는 역할은 2개 이하, 본문은 400 | 렌더: 화면 트리에서 role별 weight 집계 | 화면 레인 |
| R-05 | 인접 역할 크기 비율 1.2 이상. 보완 쌍(`tests.ratioCompensatedPairs`)만 굵기·색으로 보완 | 토큰 | DS 레인 |
| R-06 | 누를 수 있는 것은 면·밑줄·아이콘 중 하나를 반드시 함께 쓴다. action 글자색은 누르는 것에만 | 렌더: Button·Link·BackLink·ListRow 컴포넌트 계약 테스트 | DS 레인 |
| R-07 | accent는 화면당 1곳이고 dangerInk와 같은 화면에 쓰지 않는다 | 렌더: 화면 렌더에서 accent·danger 톤 개수 | 화면 레인 |
| R-08 | info 글자는 infoSoft 띠 위(7.35)에서, 면 + 아이콘과 함께 쓴다(단독 글자색 금지) | 토큰(allowed) + 렌더(Banner 계약) | DS 레인 |
| R-09 | 높이는 minHeight만(어르신 주 72·보조 64·링크 64·간격 12, 자녀 56/48). 글자 상자에 height·maxHeight 숫자 금지 | lint: height·maxHeight 숫자 + 토큰(role minHeight 존재) | DS 레인 |
| R-10 | 말줄임 금지(numberOfLines·ellipsize). 예외 3곳(낱말 칸·브랜드 버튼·번호 칸)은 ui/ 안에서 주석과 테스트로 | lint: `numberOfLines`·`ellipsizeMode` + 렌더: 예외 3곳 | DS 레인 |
| R-11 | 확대 상한은 역할 토큰에서만(본문 2.0, 큰 제목·Dock·번호 1.5). 화면이 `maxFontSizeMultiplier`를 고르지 못한다. **배율과 상관없이 적용**(200%에서도 입력 카드는 잘리지 않고, 넘치는 것은 본문 스크롤로 닿는다). **Field 입력 글자(`typeRoles.fieldInput`)의 상한은 1.5로 항상 고정**(자판 열림 여부·화면과 무관, 화면별로 값을 정하지 않는다) | lint: `maxFontSizeMultiplier` 금지 + 렌더: fontScale 2.0 주입 | DS 레인 |
| R-12 | Dock 슬롯은 주 1 + 보조 0~1 + 한 줄 note. 약관은 본문 끝. 넘치면 note → 보조 순으로 본문 끝, 최후에 '더 있음' 표시 + 테스트 실패. **단서(SocialGroup)**: 로그인 화면은 주 슬롯 안에 `SocialGroup`(카카오 → 구글 → Apple(iOS만), 최대 3개, 같은 높이·폭·반경)을 둔다. 그룹이 들어가도 Dock ≤ 40%이고, 넘치면 보조 링크가 본문으로 간다(`dock.socialGroup`). 간격: 주 버튼과 링크 24 이상, 요소 사이 8 이상. **예외(자판 열림, 11-19 결정)**: 자판이 열려 보이는 창이 작아지면 Dock 40%는 **자판을 뺀 보이는 창** 기준으로 계산하고, 글자 200%에서 주 버튼 하나만으로 40%를 넘으면(예: C0-b 210 > 152) **Dock을 풀고 주 버튼을 입력 카드 바로 아래 본문**에 둔다(카드·버튼은 통째로 보이고 위 영역은 접힘 유지). 넘길 슬롯이 없을 때만 쓰며, 자판이 닫히면 다시 Dock으로 돌아간다 | 타입(슬롯 수) + 렌더: fontScale 2.0에서 Dock ≤ 40% | DS 레인 |
| R-13 | placeholder 금지. 안내는 Field의 label·hint | lint: `placeholder` 금지 + 타입(Field에 prop 없음) | DS 레인 |
| R-14 | BackLink 하나(화살표 28/24·글자 24/18·알약 card + line 1.5, 64×120/56), 목적지 문구, 보이는 글 = TalkBack 라벨, 배율로 숨기지 않음 | 렌더: a11y 라벨 일치·배율 2.0에서 존재 | DS 레인 |
| R-15 | 자판이 열리면 form·step 틀은 위 영역을 BackLink 한 줄로 접고, 입력 카드는 통째로 보이거나 숨긴다. **배율과 상관없이 적용**: 320·200%에서 자판이 열려도 입력 카드(칸 전체)가 잘리면 안 된다. 방법은 위 영역 접기, Dock의 보조·주 버튼을 본문으로 보내기, 안내문·링크는 스크롤로 닿기. **모든 배율에서 접힘 경계는 줄/요소 경계**(스크롤 영역이 끝나는 곳에서 글줄·버튼·키 줄이 반쯤 잘려 보이면 안 된다. 걸치는 요소는 간격으로 통째로 아래로 밀고 '더 있음' 띠를 둔다) | 캡처(Maestro 자판 열림 assertVisible) + 사람 | 화면 레인 |
| R-16 | 화면은 틀 6종(step·list·form·done·state·intro) 중 하나를 고르고 한 화면 한 목적 | 타입(Screen variant) + 사람 | 화면 레인 |
| R-17 | 400/700 두 단계만(500은 S25 실측 뒤). 어르신 본문 20(22는 어르신 확인 뒤). **단서**: 소셜 버튼(카카오·구글·Apple) 글자 500은 브랜드 가이드 예외로 700 역할 집계에 넣지 않는다. 한 화면 700은 2역할까지(제목·버튼)이며 약관 링크는 400 + 밑줄 | 토큰(typeRoles weight 집합) | DS 레인 |
| R-18 | 어르신 글자 20 미만·손글씨 30 미만, 자녀 16 미만 금지 | 토큰(typeRoles 최소) | DS 레인 |

| R-19 | '더 있음' 표시는 **본문이 넘칠 때만** 보이고, 글자 위에 겹치는 흐림이 아니라 스크롤 영역 밖 24 띠(아래 화살표 아이콘만, 읽기 제외)로 둔다. 넘치지 않으면 띠도 없다 | 렌더: 표시 띠가 스크롤 영역과 겹치지 않음 | DS 레인 |
| R-20 | 인접 크기 비율 1.2 미만 쌍은 색·밑줄·아이콘으로 보완하고 `tests.ratioCompensatedPairs`에 이름을 둔다(link/sub 추가) | 토큰 | DS 레인 |
| R-21 | 자녀 화면의 '어르신이 고른 답·쓴 낱말'은 `answer`(대표 1개, 자녀 40/52)·`answerRow`(목록·시트·여러 분 행, 26/36) 역할만 쓴다(Jua 400, inkTitle, 상한 1.5). 같은 화면의 호칭 머리글(sub 16~20)보다 항상 크고 위에 온다. 한 화면 700 굵기 역할은 2개 이하(answer·answerRow는 집계 제외). 노란 팻말은 answer 뒤 면 accentSun 1개(inkTitle 9.54) | 토큰(typeRoles.answer·answerRow, allowed에 accentSun) + 렌더(역할 사용·화면당 answer 1개) | DS 레인·자녀 레인 |

## 디자인이 SUMMARY 값에서 바꾼 것 (이유 포함)
1. **BackLink 알약 면: paperSoft → card(흰) + line 테두리 1.5.** action 글자가 paperSoft 위에서 6.47로 어르신 7:1에 못 미친다(card 위 7.80). SUMMARY 2-5·Q7에는 정정 줄을 붙였다.
2. **금지 목록 → 허용 목록(allowed).** 옅은 면 위 글자 제한을 문장으로 나열하지 않고 역할×면을 전수 계산해 7:1·4.5:1·3:1을 넘는 조합만 허용한다. info 글자는 infoSoft 띠 위(7.35)가 허용된다.
3. **비활성 버튼**(진단 A6): SUMMARY가 값을 정하지 않아 line 테두리 1.5 + 이유 글자 한 줄을 제안으로 추가(어르신 확인 대상).
4. **인접 크기 비율 1.2**: bodyLg 22/body 20(1.10)·heading 26/bodyLg 22(1.18)(자녀 20/18, 18/16도)는 1.2 미만이라 굵기·색으로 보완하는 쌍으로 이름을 박았다(`tests.ratioCompensatedPairs`).
5. **onAction 토큰 추가**(흰 #FFFFFF, action 면 위). `ink`는 `color`에서 빼 `v3Aliases`로 옮겼다(action과 값이 같은 것은 의도: 브랜드 갈색을 '누르는 것'으로 좁힘).

## 열린 항목
- action on paper 7.05(여유 0.05): 값을 바꾸면 R-01이 바로 깨진다. 더 진하게(#6F4420 ≈ 7.5) 할지는 오너 색감 확인 뒤 `tokens-v4.json`의 action 값만 바꾸고 `contrast-v4.py`를 다시 돌린다.
- 시안(화면 묶음별 PR)은 이 값을 쓴다.

## 검증
- `python3 design-system/scripts/contrast-v4.py --check` → OK(textMatrix·nonTextMatrix 전수 + allowed 일치). 렌더 확인은 해당 없음(값·문서만).
