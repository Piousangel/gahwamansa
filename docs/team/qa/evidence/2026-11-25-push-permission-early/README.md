# H1 알림 묻기 시작 단계로 — 에뮬레이터 캡처 (push/permission-early, 2026-11-25)

- 기기: emulator-5556(AVD gahwa_small, Android 34), stagingDebug + fake API. 찍은 뒤 에뮬레이터를 껐다(시작 전 꺼져 있었음).
- 임시 설정(커밋하지 않음): fake API를 받기 동의 전(`pushEnabled: false`)으로 만들고, 자녀 대기 화면이 네 번째 확인할 때 어르신 연결을 흉내 냈다. fake 앱 기본값(받는 중)에서는 두 화면 모두 지금과 같다(N1 없음, 줄 없음).
- 흐름: `capture-flow.yaml`(임시 Maestro 흐름 사본, 저장소의 흐름 목록에는 넣지 않음).

| 파일 | 장면 |
|---|---|
| `h1-parent-n1-after-connect.png` | 어르신: 번호 연결 → 답 보여 주기 '좋아요' → 코스 홈에 들어오자 N1(기존 문구 그대로) |
| `h1-parent-p3-after-no.png` | '안 받을게요' 뒤 코스 홈(사진 보기) — 다시 묻지 않음 |
| `h1-child-c3.png` | 자녀 C3: 받기 동의 전이라 '연결되면 알려 드릴게요 · 알림 켜기' 줄 |
| `h1-child-connect-done.png` | 자녀 연결 직후: 새 줄 '엄마께서 답을 고르시면 한 번 알려 드릴게요' + 알림 켜기(라이터 확인 전) |

- 200% 글자·작은 화면 캡처는 하지 않았다(새 줄은 C3 줄과 같은 부품·간격).
