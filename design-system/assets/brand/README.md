# 가화만사성 브랜드 심볼 사용 규칙
확정안: C3D-2 v2 D안(DECISIONS 2026-11-17). 살구빛 인장 '家' 앞, 빛바랜 사진이 오른쪽 위로 비켜 뒤에 놓임. 미리보기: `brand-sheet.png`

## 파일
| 용도 | 파일 |
|---|---|
| 3D 상세판(96px 이상: 스플래시·스토어·소개) | `symbol-3d.svg`, `png/symbol-3d-512.png` |
| 3D 단순판(72px 이하. 사진을 키우고 하늘을 푸르게 해 48dp에서도 사진으로 읽히게) | `symbol-3d-small.svg` |
| 3D 단순판 꽉 채움(런처 전경 전용. 사진 +7°·인장 -4°로 겹침을 키워 64dp까지 확대) | `symbol-3d-small-compact.svg` |
| 평면판(보관. 24dp 미만 단색 아이콘 등 특수 용도만 — 앱 화면엔 쓰지 않음, 2026-11-17 결정) | `symbol-flat.svg`, `png/symbol-flat-40(@2x·@3x).png` |
| 단색(테마 아이콘) | `symbol-mono.svg` |
| Android 적응형 아이콘(108dp 캔버스. 배경 = 짙은 갈색 그라디언트 #6A4424→#4E2F14, 전경 = compact 64dp, 바깥 반경 실측 33dp 이하라 안전 원 66dp 안) | `android/res/mipmap-*/ic_launcher_{foreground,background,monochrome}.png`, `mipmap-anydpi-v26/*.xml` |
| 레거시 런처 48dp(mdpi 48 · hdpi 72 · xhdpi 96 · xxhdpi 144 · xxxhdpi 192px) | `android/res/mipmap-*/ic_launcher(_round).png` |
| 스플래시(Android 12: 288dp 캔버스, 내용은 지름 192dp 원 안, 배경 없음) | `android/res/drawable-*/splash_icon.png` |
| Play 스토어 512×512(불투명 정사각, 모서리는 Play가 깎음) | `play-store-512.png` |
| 스테이징(배지 "T"(흰 테두리) + 아래 남색 띠 #2E4699와 그 위 크림 선 1.8dp. 갈색 바탕과 구분되게 남색을 밝힘. 앱 이름 "테스트 가화만사성") | `android/staging/res/…`(구조 동일. 스테이징 빌드의 `src/staging/res`에 복사) |
| 원본 SVG·생성기 | `android/src`, `android/staging/src`, `_src/gen.mjs`(SVG) → `_src/render.sh`(PNG, 헤드리스 크롬) |

## 색
- 새 브랜드 토큰 제안: `brandSeal #EE6A44`(인장), `brandSealDeep #C44F2E`(두께·그림자), `brandSealGlyph #FFFAF3`(家), `iconBgTop #6A4424`·`iconBgBottom #4E2F14`(런처 바탕 그라디언트, 2026-11-17 확정 ③), `stagingNavy #2E4699`
- 평면판의 나머지 색은 기존 토큰(card·inkTitle·sky·sun·doneSoft)만 사용

## 런처 바탕을 갈색으로 정한 이유
- 밝은·어두운 홈 모두에서 꽉 찬 타일로 보이고(크림은 밝은 홈에서 '흰 동그라미'), 살구 인장·흰 사진과의 대비가 가장 큼. 비교: `launcher-bg-compare.png`
- 마스크 모양(원·스쿼클·둥근 사각)은 런처·제조사가 정한다. 우리가 정하는 건 배경 레이어와 전경 배치뿐

## 여백·최소 크기
- 사방 여백은 심볼 크기의 1/4 이상. 다른 그림·글자를 그 안에 넣지 않는다
- 최소 크기: 평면판 24dp, 3D판은 런처를 빼면 48dp 이상. 런처 전경은 꽉 채움 단순판, 앱 안 40dp는 상세판(@2x·@3x에서 뭉개지지 않음 실측)
- 워드마크: 3D 상세판 PNG 40dp(@2x·@3x) + 이름(22 이상) + 한 줄 설명, 심볼과 이름 사이 12dp

## 배경별 사용
- 종이색·흰색·밝은 사진 위: 그대로. 다크(#2A211B 등): 그대로(사진 흰 테두리가 경계를 만든다)
- 살구·주황·빨강 바탕 위에는 두지 않는다(인장이 묻힘). 꼭 필요하면 흰 원판(심볼의 1.4배) 위에 올린다
- 복잡한 사진 위에는 두지 않는다

## 금지
- 늘리기·찌그러뜨리기, 색 바꾸기, 인장(-6°)·사진(+11°) 기울기 바꾸기, 사진과 인장 떼어 쓰기
- 목록·버튼·머리글 같은 반복 UI 요소에 심볼을 장식으로 남발하지 않음(대기 화면·첫 화면 워드마크에만)
- 家 획 수정, 시판 서체 글자로 대체, 외곽선 추가, 그림자 추가

## 권리 기록
- 모든 그림은 손으로 작성한 SVG(AI 생성 이미지 없음). '家'는 서체가 아니라 `_src/gen.mjs`의 `GLYPH`에 직접 설계한 획 10개(宀 3 + 豕 7). 배지 "T"도 사각 패스
- 워드마크 글자 서체는 미확정(글꼴 라이선스 TODO). 확정 시 라이선스 자유 서체로 아웃라인화

## 앱 반영 시(이번 작업 범위 밖)
- 기존 `drawable/ic_launcher_foreground.xml`(벡터)과 `splash_symbol.xml`을 PNG 레이어로 교체(그림자 블러는 VectorDrawable로 옮길 수 없음). `styles.xml`의 `windowSplashScreenAnimatedIcon`은 `@drawable/splash_icon`으로
- (반영 완료, 2026-11-17 결정) 앱 안 심볼은 전부 **3D 상세판**(`png/symbol-3d-*` 40dp @2x·@3x, 스플래시 164dp). 평면판은 앱 화면에 쓰지 않음(위 표). 해+폴라로이드 `symbol-sun-polaroid.svg`는 은퇴
