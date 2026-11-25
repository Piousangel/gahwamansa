# 작은 화면 묶음 #277 — ⑤ 이야기 건네기 첫 화면 (2026-11-25, DS-1)

대기열 34: 5단계 ⑤를 100% 360×640으로 열면 첫 화면에 카드가 1장만 보였다.

## 찍은 조건

- **기기**: 에뮬레이터 gahwa_small(emulator-5556, `-read-only`, 창 없음). 리드가 Maestro 레인 반납을 알린 뒤에 띄웠다. S25는 연결하지 않았다.
  - 시작 때 화면 설정: 1080×2340, density 440, 글자 1.0, TalkBack 끔
- **부하**: 장면마다 1분 평균 15 이하를 기다렸다.
  - 찍는 순간 1분 평균은 6.6~12.4였다.
  - 부팅 직후 'System UI isn't responding'이 떠서 'Wait'를 누르고 부하가 내려갈 때까지 기다렸다.
- **빌드**: #265 때와 같은 staging 디버그 APK(gesturehandler 포함)를 다시 설치했다.
  - Metro는 8091이다. 앱의 개발 서버 주소(debug_http_host)를 `10.0.2.2:8091`로 바꿨다. read-only라 끄면 사라진다.
- **임시 상태** (커밋하지 않았고 모두 되돌렸다)
  - `config.local.ts`: fake
  - `App.tsx`: 장면 파일로 띄웠다(`createFakeApi({linked, consented, completedSteps: ['photo','recall','question','hangul'], recallSlot: 2, answeredChoice: 'A'})` + fiveSteps 켬)
  - '전' 캡처: `PassOnStep.tsx`만 잠깐 origin/main 판으로 바꿨다.
- **끝난 뒤 되돌린 것**: `wm size reset`(1080×2340), density 440, `font_scale 1.0`, TalkBack 끔(null)을 확인했다. reverse를 지우고, 에뮬레이터와 Metro 8091을 껐다.

## 캡처

| 장면 | 전 | 후 | 보는 것 |
|---|---|---|---|
| 360×640 100% 첫 화면 | `before-360-100-pass-on.png` | `after-360-100-pass-on.png` | 첫 화면에 보이는 카드가 **1장에서 2장**으로 늘었다(참새 얘기할게요 · 봄, 그게 좋아요). Dock에는 [건넬게요]만 있다. |
| 360×640 100% 끝까지 | `before-…-end.png` | `after-…-end.png` | 셋째 카드 → 묶음 간격 → 「오늘은 넘어갈게요」(②와 같은 자리·모양). |
| 320×640 200% 첫 화면 | `before-320-200-pass-on.png` | `after-320-200-pass-on.png` | 전과 같다. 200%는 원래 넘어가기가 본문에 있었다. 카드 1장. |
| 320×640 200% 끝까지 | `before-…-end.png` | `after-…-end.png` | 셋째 카드 아래 넘어가기 |

- 셋째 카드(「어느 쪽일지 궁금해요」 + 보조 줄)는 첫 화면 끝에 걸쳐서 R-15에 따라 통째로 아래로 밀린다. 그래서 끝까지 내린 화면에서 둘째와 셋째 카드 사이가 벌어져 보인다. ②도 같다(#259 증거 `360-100-4b-recall-skip-gap.png`).
- 대기열 50(P1c 짧은 고지)은 리드 판단대로 찍지 않았다. staging env의 TERMS_URL이 비어 있어서 링크가 아닌 일반 글자로 보이는 것이 맞다.
