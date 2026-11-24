# 끌어 올리고 내리는 공통 시트 — gorhom 도입 vs 몽망이 sheetMath 이식 (C-3, 2026-11-24)

작성: 가화 DV-1(L4). 오너 피드백 C-3 "gorhom/react-native-bottom-sheet 처럼 손가락으로 끌어 올리고 내리는 공통 시트".
팀 간 공유 첫 사례: 몽망이 DS-2 커밋 `68863b8`(apps/mobile/src/ui/BottomSheet, 순수 함수 `sheetMath.ts` + 시험).

## 출발점

- 가화 앱(RN CLI 0.88)에는 `react-native-reanimated`·`react-native-gesture-handler` 가 **없다**. 둘 다 네이티브 모듈이라 설치는 오너 승인 사항.
- 기존 ds `Sheet`(app/src/ui/ds/Sheet.tsx)는 V14 ① 결정으로 끌기·손잡이가 없었다(닫기 = X·밖 누르기·뒤로). 사용처 3곳: 응원 시트(ChildHome), 유료 안내(PaidSheet), 호칭 겹침 안내(TitleDupNotice). 모두 내용이 짧은 단일 높이 시트.
- 몽망이는 같은 문제를 gorhom 설계(0.2초 투영, sqrt 저항, 스크롤 맨 위 규칙)를 참고한 자체 구현으로 풀었다. 단 Expo + Reanimated + RNGH 위에서.

## 두 안

| | A) gorhom 도입 | B) 몽망이 sheetMath + RN 기본 Animated·PanResponder 로 ds Sheet 확장 |
|---|---|---|
| 설치 | bottom-sheet + reanimated + gesture-handler(+ worklets). 네이티브 빌드·Podfile·Gradle·babel 플러그인 변경 → **오너 승인 필요** | 없음 |
| 60fps | 제스처·이동 모두 UI 스레드(worklet). JS 가 바빠도 손가락을 따른다 | 놓은 뒤 자리 잡기는 `useNativeDriver` 라 UI 스레드. **손가락을 따르는 동안**은 JS 스레드(PanResponder → `setValue`). 새 아키텍처(동기 브리지)에서 가벼운 화면은 60fps 가능, JS 가 무거운 순간(목록 렌더 등)엔 한두 프레임 밀릴 수 있다 |
| 안쪽 스크롤 충돌 | 스크롤과 팬 제스처를 동시에 돌려 프레임마다 소유권을 넘긴다(한 손가락으로 시트 → 스크롤 이어짐) | 같은 규칙(`stepContentDrag`)으로 **제스처 시작 때** 한 번 정한다. 맨 위 칸이 아니면 스크롤을 꺼 두고 시트가 갖는다. 한 손가락으로 "시트를 끝까지 올린 뒤 이어서 스크롤"은 안 된다(놓고 다시 밀면 된다). Android 네이티브 스크롤이 맨 위 칸·스크롤 맨 위에서 아래로 당기는 손가락을 먼저 가로챌 여지가 있다 → 손잡이는 늘 된다. 에뮬 확인 항목 |
| Android 뒤로 | `BottomSheetModal` + 직접 BackHandler 배선 | 기존대로 `Modal.onRequestClose` = onClose(바뀌지 않음) |
| 접근성 | 기본 제공이 얇다(손잡이 역할·조절 동작은 직접) | 몽망이 방식 그대로: 칸 하나 = 손잡이 **버튼**(두 번 누르기 = 닫기), 칸 여럿 = **조절 막대**(위아래 쓸기 한 칸, 값 'n단계 중 m단계'). 제목 첫 포커스·연 버튼으로 포커스 돌려주기·accessibilityViewIsModal 은 기존 그대로 |
| 모션 줄이기 | 직접 배선 | `settleDuration` 이 0 → 바로 그 자리. 여닫기는 기존대로 불투명도만 |
| 유지 비용 | 라이브러리 버전이 reanimated 메이저(3→4)·RN 업그레이드에 묶인다. 우리 Modal·포커스·토스트 가드와 겹치는 부분을 맞춰야 한다 | 순수 함수 1파일(시험 37개) + Sheet 1파일. 몽망이와 계산이 같아 한쪽 버그 수정을 다른 쪽에 옮기기 쉽다(출처 주석) |
| 위험 | 네이티브 빌드 깨짐(새 아키텍처·Hermes·babel 순서), APK 크기 증가, 기존 Jest 환경에 RNGH·reanimated 목(mock) 추가 | 위 60fps·스크롤 한계. 새 의존 0이라 되돌리기 쉽다 |

## 권장: B (이번 PR)

- 지금 시트 3곳은 **짧은 단일 높이**라 B 의 한계(손가락 따라가기 JS 스레드, 한 손가락 이어 스크롤 없음)가 거의 드러나지 않는다.
- 설치 없이 오너 피드백(끌어 올리고 내리기·끌어 닫기)을 바로 낼 수 있고, 계산은 몽망이가 리뷰·시험으로 다진 것을 그대로 쓴다.
- **A 로 옮길 신호**: 긴 목록이 든 시트(앨범·지난 날 등)를 시트로 옮기거나, 에뮬·실기기에서 손가락 따라가기가 끊겨 보일 때. 그때 reanimated·RNGH 설치를 오너에게 묻고, sheetMath 는 그대로 worklet 으로 되돌려 쓴다(몽망이 원본이 worklet).

## 남은 확인(캡처 순번 뒤)

- 에뮬레이터(360×640, 100%·200%): 응원 시트 손잡이 끌어 닫기·튕기기·천천히 놓기, 위로 과도 당김 저항(바닥 틈 없음), 화면 읽기(TalkBack)로 손잡이 두 번 누르기.
- Android 에서 내용 영역을 아래로 당겨 닫기가 스크롤에 먹히지 않는지(위 '안쪽 스크롤' 칸).
