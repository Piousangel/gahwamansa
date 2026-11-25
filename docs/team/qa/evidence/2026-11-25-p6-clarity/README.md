# P6 낱말 쓰기 영역 구분·사진 잘림 실측 · 2026-11-25 (DS-1)

회의록: [docs/design/2026-11-25-p6-clarity/README.md](../../../../design/2026-11-25-p6-clarity/README.md)

## 찍은 조건

- **기기**: 에뮬레이터 gahwa_small(emulator-5556, `-read-only`, 창 없음). S25는 연결하지 않았다.
  - 시작 때 화면 설정: 1080×2340, density 440, 글자 1.0, TalkBack 끔(`enabled_accessibility_services` = null)
  - 다른 레인(P7)이 같은 에뮬레이터를 쓰는 동안 기다렸다가 꺼진 뒤 시작했다.
  - 호스트 부하 1분 평균: 장면 시작 전 15 이하를 기다렸다. 찍는 순간은 대부분 4~16이었고, 첫 장면(before 360-100 3단계)만 22였다. 정적 화면이라 결과에 영향 없음.
- **빌드**: 에뮬레이터에 있던 staging 디버그 APK는 gorhom(#255) 이전 것이라 `RNGestureHandlerModule`이 없어 JS를 못 띄웠다. 같은 날 다른 레인이 만든 staging 디버그 APK(gesturehandler·reanimated·worklets 포함)를 설치했다(read-only라 끄면 사라짐).
  - Metro 8092(이 worktree). 앱의 개발 서버 주소(debug_http_host)를 `10.0.2.2:8092`로 바꿨다(read-only라 끄면 사라짐). 8081·8091은 건드리지 않았다.
- **임시 상태** (커밋하지 않았고 모두 되돌렸다)
  - `config.local.ts`: 예시 파일 복사(`API_MODE: 'fake'`). 끝난 뒤 지웠다.
  - `App.tsx`: 장면 파일(`scene.tmp.ts`)의 `createFakeApi({linked, consented, realImage, completedSteps, recallSlot})`로 앱을 띄우고 `restore`를 켰다. 5단계 스위치는 #254와 같은 방식(`setFeature('fiveSteps', …)`).
    - 3단계: `completedSteps: ['photo','question']` → 낱말 쓰기 3 / 3, 낱말 '나무'
    - 5단계: `completedSteps: ['photo','recall','question'], recallSlot: 2` → 낱말 쓰기 4 / 5, ②에서 고른 '참새'
  - fake 사진 주소: `http://localhost:8097/day-01.jpg`(`content/photos`를 맥에서 띄우고 `adb reverse tcp:8097`). 1일차 사진 1152×928.
  - '전' 캡처는 `KeyboardStep.tsx`·`photoFrame.ts`를 잠깐 origin/main 판으로 바꿔 찍고 되돌렸다.
- **크기**
  - 360×640dp 100%: `wm size 990x1760`, `font_scale 1.0`
  - 360×780dp 100%(오너 S25 근사 — 오너 캡처에서 사진이 보이던 크기): `wm size 990x2145`
  - 320×640dp 200%: `wm size 880x1760`, `font_scale 2.0`
- **끝난 뒤 되돌린 것**: `wm size reset`(1080×2340), density 440, `font_scale 1.0`, TalkBack 끔(null)을 확인했다. reverse를 지웠다. 에뮬레이터·Metro 8092·사진 서버 8097을 껐다.

## 사진 잘림 원인 (실측)

| | 사진 틀(dp) | 틀 비율 | 보이는 부분 |
|---|---|---|---|
| 전 (360×780) | 312 × 56(고정 `PHOTO_STRIP_H`) + `cover` | 5.6 : 1 | 1152×928(1.24:1) 사진의 가운데 약 22% 띠 |
| 후 (360×780) | 142 × 114(`photoFrame` + fit) + `contain` | 1.24 : 1 | 사진 전체 |

- 후 360×780 실측(uiautomator, ÷2.75): 본문 창 374, 접힘 350. 입력 칸 아래 끝 348 → 접힘 안(여유 2.5).
- 360×640 100%는 전·후 모두 사진이 접힌다(입력 칸 우선, #104 ②). 후에는 보기 판에 낱말만 남는다.

## 캡처

파일 이름: `{전 before | 후 after}-{크기}-{배율}-{3step | 5step}-{장면}.png`. closed = 자판 내림, open = 입력 칸을 눌러 자판 올림.

| 장면 | 전 | 후 | 보는 것 |
|---|---|---|---|
| 360×780 100% 3단계 닫힘 | `before-360x780-100-3step-closed.png` | `after-360x780-100-3step-closed.png` | 전: 사진이 얇은 띠로 잘림, 테두리 상자 셋, 이유 줄이 본문. 후: 보기 판(사진 원본 비율 → 고지 한 줄 → 나무) / 안내 → 입력 칸(유일한 테두리) / 이유 줄은 Dock 꺼진 버튼 위 |
| 360×780 100% 5단계 닫힘 | `before-…-5step-closed.png` | `after-…-5step-closed.png` | 4 / 5, '떠올리신 낱말을 아래 칸에 써요', 참새 |
| 360×780 100% 열림 | `before-…-open.png` | `after-…-open.png` | 같음: [낱말][입력 칸] 한 줄 + 다 썼어요 |
| 360×640 100% 3·5단계 닫힘 | `before-360-100-*-closed.png` | `after-360-100-*-closed.png` | 사진 접힘(전·후 같음). 후: 낱말이 보기 판에, 안내가 칸 바로 위 |
| 360×640 100% 3·5단계 열림 | `before-360-100-*-open.png` | `after-360-100-*-open.png` | [낱말][입력 칸] 한 줄이 자판·'더 있음' 띠에 가리지 않음. 이유 줄은 열림에서 그리지 않음(아래 문제 2) |
| 320×640 200% 닫힘 | `before-320-200-*-closed.png` | `after-320-200-*-closed.png`, `…-closed-scrolled.png` | 쓰기 칸이 접힘에 걸쳐 통째로 아래(R-15, 전·후 같음). 스크롤하면 안내·입력 칸·읽어 주세요 |
| 320×640 200% 열림 | (못 찍음 — 아래) | `after-320-200-*-open.png`, `…-typed.png` | Dock 풀림(리드 결정 b): [낱말][입력 칸] → 바로 아래 '다 썼어요'. 글자를 치면 버튼이 켜짐 |

- **못 찍은 것**: 전 320×640 200% 자판 열림. 입력 칸이 접힘 아래라 자동 누르기가 실패했다(파일 지움). 전 코드도 본문 '다 썼어요'에 같은 이유 줄(`disabledReason`)을 달고 있었다(origin/main `KeyboardStep.tsx` 325줄).

## 찍으며 찾아 고친 것

1. **고지 두 줄 → 사진 접힘**(360×780): 보기 판 안쪽 좌우 12 때문에 고지가 288 폭에서 두 줄로 꺾여 fit 84 < 바닥 96 → 사진이 접혔다. 판 좌우 여백 0(고지 본문 폭 312에서 한 줄, P4와 같음)과 고지 줄 수 어림(판 폭 기준)으로 고침 → 사진 142×114.
2. **자판 열림 이유 줄**(360×640 100%): 꺼진 버튼 위 이유 줄 때문에 자판 위 Dock이 커져 [참새][입력 칸] 줄이 '더 있음' 띠에 가렸다(중간 캡처). 열림에서는 이유 줄 없이 힌트만.
3. **200% 자판 열림 이유 줄**(320×640): 본문 '다 썼어요' 위 두 줄 이유가 버튼을 띠 아래로 밀었다(중간 캡처, 전 코드에도 있던 줄). 힌트만으로 → 버튼이 입력 칸 바로 아래에 보임.

## 시험

- `app/__tests__/p6Clarity.test.tsx`(새): 영역 순서·테두리 하나·이유 줄 자리(닫힘 Dock / 열림 힌트만)·읽기 순서(고지 → 낱말 → 안내 → 입력 칸)·사진 contain + 원본 비율 + fit·pending·자판 열림 한 줄(100%·200%)·`p6PhotoFit`.
- `p6KeyboardOpen.test.tsx`: 닫힘 구조·#104 ② 사진 접힘 규칙을 새 구조로. `fiveStepsOn.test.tsx`: ④ 보기 판·안내 단언 추가.
- 실패 확인(일부러 깨뜨림): `resizeMode="cover"`로 되돌리고 이유 줄을 옛 힌트 방식으로 → `p6Clarity` 2개 실패(`Expected: "contain" / Received: "cover"`, 이유 줄 단언). 되돌리면 통과.

## #265 QA-2 M1 재캡처 (시각 여유 12)

- 같은 조건(gahwa_small 5556, 같은 staging 디버그 APK 재설치, Metro 8092, 사진 서버 8097, 부하 1분 7~9). 찍은 뒤 1080×2340·440·1.0·TalkBack 끔 확인, 에뮬레이터·Metro·사진 서버 끔.
  - 처음 띄운 직후 'System UI isn't responding' 대화상자가 떠서(부팅 부하) 부하가 내려간 뒤 다시 찍었다.
- `after-m1-360x780-100-3step-closed.png`: 사진 127×102(전 142×114, 바닥 96 위). 입력 칸 아래 끝과 접힘('더 있음' 띠 위 끝) 사이 14.5dp(전 2.5dp) — uiautomator: 입력 칸 [66,1232][924,1401], 본문 창 끝 1507 − 띠 66 = 1441.
- 위 표의 360×780 후 캡처(사진 142×114)는 여유 12를 더하기 전 판이다. 다른 크기(360×640·320×640)는 사진이 접히는 크기라 바뀌지 않는다.
