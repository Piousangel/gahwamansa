# 디자인 시스템 v4 규칙 (값 확정, 2026-11-19)

원문: `docs/team/board/2026-11-19-design-system-v4/SUMMARY.md` 2~3절, 표결 Q2~Q11. 값의 원본은 `tokens-v4.json`(DS 레인이 코드 토큰으로 옮김). v3 이름은 한 릴리스 별칭(`v3Aliases`). 대비 계산은 `design-system/scripts/contrast-v4.py`(값이 바뀌면 다시 실행, `--check`로 검사).

## 규칙 표 (검사 가능한 문장)
검사 방법 약어: **토큰** = 토큰 테스트(tokens-v4.json 기반), **lint** = eslint 규칙, **렌더** = RNTL 화면 렌더 테스트, **캡처** = Maestro·실기기 캡처 회귀, **사람** = 디자인 리뷰.

| ID | 규칙 | 검사 방법 | 담당 |
|---|---|---|---|
| R-01 | 글자색·면의 짝은 `allowed` 표(역할×면)에 있는 것만 쓴다. 어르신 7:1, 자녀 4.5:1, 경계·아이콘 3:1 | 토큰: `contrast-v4.py --check` OK + 컴포넌트가 쓰는 짝이 allowed에 있는지 | DS 레인(L4) |
| R-02 | 화면은 역할(role·tone)만 고른다. hex 색·fontSize·fontWeight·lineHeight 숫자 리터럴 금지 | lint: `no-restricted-syntax`(features/·app/) → 처음엔 warn, AU-10에 error | DS 레인 |
| R-03 | RN의 Text·TextInput·Pressable 직접 import 금지(공통 컴포넌트만) | lint: `no-restricted-imports` | DS 레인 |
| R-04 | 한 화면에 700 굵기를 쓰는 역할은 **어르신 화면 2개 이하, 자녀 화면 3개 이하(제목·버튼·answer)**, 본문은 400. v4의 '2개'는 Jua 서체 강조(answer)를 따로 셌기 때문이며, Jua 폐기(A2)로 answer가 Noto Sans KR 700이 되었다. 어르신 화면에는 answer가 없으므로 2개를 그대로 유지하고(리드 결정 11-20), 자녀 화면만 answer 1개를 더해 3개다 | 렌더: 화면 트리에서 role별 weight 집계(audience별 상한) | 화면 레인 |
| R-05 | 인접 역할 크기 비율 1.2 이상. 보완 쌍(`tests.ratioCompensatedPairs`)만 굵기·색으로 보완 | 토큰 | DS 레인 |
| R-06 | 누를 수 있는 것은 면·밑줄·아이콘 중 하나를 반드시 함께 쓴다. action 글자색은 누르는 것에만 | 렌더: Button·Link·BackLink·ListRow 컴포넌트 계약 테스트 | DS 레인 |
| R-07 | accent는 화면당 1곳이고 dangerInk와 같은 화면에 쓰지 않는다 | 렌더: 화면 렌더에서 accent·danger 톤 개수 | 화면 레인 |
| R-08 | info 글자는 infoSoft 띠 위(7.10)에서, 면 + ⓘ 아이콘과 함께 쓴다(단독 글자색 금지). **v5: 누르는 파랑(action)과 정보 시멘트(info)는 명도 대비가 1.06이라 색만으로 구분되지 않는다 → info 글자에는 밑줄을 쓰지 않고, 누르는 파랑 글자는 밑줄·면(버튼·알약)·아이콘 중 하나를 반드시 함께 쓴다.** | 토큰(allowed) + 렌더(Banner 계약, 링크 밑줄/면/아이콘 있음·info 밑줄 없음). **렌더 테스트는 L4에 넘길 항목** | DS 레인(L4) |
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
| R-21 | 자녀 화면의 '어르신이 고른 답·쓴 낱말'은 `answer`(대표 1개, 자녀 40/52, 확대 상한 1.3)·`answerRow`(목록·시트·여러 분 행, 26/36)만 쓴다(Noto Sans KR 700, inkTitle). 호칭 머리글(sub 16~20)보다 항상 크고 위에 온다. **자녀 화면의 700 굵기 글자 역할은 3개 이하(제목·버튼·answer, R-04)이고 그중 `answer`는 1개**(어르신 화면에는 answer가 없어 2개). `title`(화면 제목)과 `answerRow`는 크기가 같지만 title은 화면 제목 1개, answerRow는 답 행이다. | 토큰(typeRoles.answer·answerRow) + 렌더(역할 사용·화면당 answer 1개) | DS 레인·자녀 레인 |

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

## v5 값 매핑 — B2 v2 '장날 팻말' (오너 결정 11-20: O-1·O-2·O-6·O-8)
원본: `design-system/tokens-v5.json`(생성: `scripts/map-v5.py`, 대비: `scripts/contrast-v4.py design-system/tokens-v5.json`). **tokens-v4.json의 역할×면 체계는 그대로**이고 값만 바뀐다. v4 파일은 L4 생성기가 v5로 넘어갈 때까지 유지한다.

### 색 매핑 (모든 역할의 새 hex, 어르신 7:1·자녀 4.5:1·비텍스트 3:1은 contrast 표로 검증)
| 역할 | v4 | v5 | 대비(종이/카드) | 메모 |
|---|---|---|---|---|
| paper | #F6F3EE | **#F4F5F2** 회백 | — | 바탕 |
| card | #FFFFFF | #FFFFFF 흰 | — | |
| paperSoft / noticeSoft / infoSoft / sky | 크림 계열 | #E9EBE6 / #ECEEE9 / #E6E8E3 / #E4EAF4 | — | 톤 고정, 중성에 가까운 색상만 이동 |
| inkTitle / inkBody | #4E2F14 / #2E2924 | **#151515** 먹 (둘 다) | 16.69 / 18.26 | 제목·본문 같은 먹, 위계는 크기·굵기 |
| inkSub / inkSubChild | #544B43 / #6E655C | **#484B50** 시멘트 / #5A5E64 | 8.00 / 8.76, 5.96 | |
| action | #744821 갈색 | **#1A4C99** 차일 파랑(누르는 것 전용) | 7.56 / 8.28 | 흰 글자 8.28 |
| actionSoft / actionPressed | #EFE0CF / #5A3716 | #E4EAF4 / #123A78 | action on actionSoft 6.85(<7) | 선택 면 위 글자는 inkBody |
| accent | #8F2F15 주홍 | **#151515** 먹 | — | Tag(accent) = 먹 면 + 흰 글자 + 글자('지금 할 차례'), 색 아닌 모양으로 구분 |
| info / infoSoft | #1E4E7A 남색 / #E3EEF7 | **#484B50 시멘트 / #E6E8E3** | 7.10 | **info 남색과 누름 파랑 겹침(패널 5) 해결: info는 파랑을 쓰지 않고 시멘트 회 + ⓘ 아이콘 + 옅은 회 면**. 파랑은 누르는 것 전용 |
| line / lineSoft / lineGhost | #A67C5A … | #7A7E84 / #D2D5CF / #E0E2DC | line 3.73/4.08 | 조작 요소 테두리(3:1) |
| **sign / signInk / signEdge** | (없음) | **#FFD43B 팻말 노랑 / #151515 / #151515** | signInk on sign 12.81 | **노랑은 sign 전용**: 부모님이 고르신 쪽(P5 선택)만 싣는다. 다른 면·글자·버튼·장식에 쓰지 않는다. 바탕과 1.3이라 먹 테두리 2 필수 |
| doneInk / dangerInk | 유지 | 유지(기능 색) | 8.23 / 7.51 | 팔레트 6색 밖, 의미 전용 |
| disabledBg / disabledInk | | #E4E6E1 / #5F6368 | | |
| **폐기** | sun·sunRay·blush·accentSun·accentPeach·brandSeal*·tape | 삭제 | | 장식 폐기(O-8) |

### 반경·선·그림자 (B2 v2, 패널 5: 반경 4단·그림자 2단)
- **반경 4단**: 팻말·입력칸 **3** / 행·선택지·칩 **6** / 버튼 **8** / 시트·대화상자 **12**. 알약(36)·16~28 폐기. 키패드 키·번호 칸은 6.
- **선**: 조작 테두리 **1.5**(line), 지금 행 **3**(먹), 팻말 **2**(먹), 고른 쪽 **5**(파랑 + ✓ + 골랐어요), 포커스 4.
- **그림자 2단**: 기본 없음. 시트 `0 -4 12 rgba(21,21,21,.18)`, 대화상자 `0 8 24 rgba(21,21,21,.24)`. 팻말·카드·버튼에는 그림자 없음.

### R-22 팻말(Sign) 컴포넌트
- 위치: P3 빈 팻말 자리(점선·흰 면)·P7·P3D 홈 맨 위·지난 날·C4(자녀). 글자는 **고르신 쪽**, 낱말은 싣지 않는다(O-1).
- 크기: hero(P7·P3D·C4) 화면 너비 − 좌우 20(어르신 24)·minHeight 120, row(지난 날) minHeight 56. 끈(길이 24·선 2)과 못(지름 8, 먹)은 hero만, 움직이지 않고 판만 매달린다. **기울기 hero −2°, 목록 0°**. 처음 볼 때 3°→−2° 한 번(600ms, 동작 줄이기는 정지).
- 글자: **48dp 이상에서만 손글씨**(나눔손글씨 붓, 어르신 60×1.18·자녀 52), 그보다 작으면 Noto Sans KR 700. 확대 상한 1.3.
- 면·선: 노랑(sign) + 먹 테두리 2, 반경 3. 비어 있을 때는 흰 면 + 점선(시멘트 1.5).
- **노랑 오용 방지**: `sign` 면(#FFD43B)·`signInk`·`signEdge` 토큰은 **Sign 컴포넌트 파일 안에서만 쓰는 비공개 export**다(`ui/ds/Sign.tsx`가 토큰을 가져가고, 다른 파일은 sign 색을 import할 수 없게 lint `no-restricted-imports`/토큰 index에서 제외). 화면·다른 컴포넌트가 노랑이 필요하면 Sign을 쓴다.
- 읽기: '고르신 쪽, {글자}'(끈·못은 읽지 않음). 검사: 토큰(allowed에 signInk는 sign 위만) + 렌더(화면당 sign 1개, 노랑이 sign 밖에서 쓰이지 않음). **노랑 사용 테스트의 화이트리스트는 `sign`(Sign 컴포넌트)과 `brand.symbol`(런처·스플래시·스토어 그래픽 에셋) 둘이며 그 밖의 #FFD43B 사용은 실패**한다.

### R-23 장식 폐기와 심볼 교체안 (O-8)
- **폐기**: 해님(인사·첫 화면), 스티치(점선 구분선), 테이프, 폴라로이드 마운트·모서리, 家 인장 도장. 사진은 둘레 장식 없이 그대로 쓰고, AI 고지(사진 아래 한 줄)는 유지한다. P7 도장 연출은 '팻말이 걸리는' 연출로 교체(끈은 P6부터 걸려 있음).
- 구분은 장식이 아니라 여백·행 테두리로 한다.
- **심볼 교체안 — 후보(오너 확인 전)**: 노랑 팻말 윤곽(먹 테두리 2, 짧은 끈) 안에 **家 한 글자**(Noto Sans KR 900, 먹). 인장(주홍)·해님·폴라로이드는 쓰지 않는다. 최종 에셋은 오너 확인 뒤 제작. **채택하려면 리뷰어 조건 3가지를 함께 지킨다**: ① **런처 아이콘·스플래시·스토어 그래픽에만** 쓴다(앱 화면 안 장식으로 쓰지 않는다, sign 노랑의 브랜드 예외는 이 한정) ② **`brand.symbol` 토큰을 `sign`과 분리**해 둔다(같은 #FFD43B여도 이름·사용처를 나눠 sign 전용 규칙을 깨지 않게) ③ **스토어 설명에서 家의 뜻을 연결**한다('가화만사성'의 첫 글자 家, 라이터 문구 필요).
