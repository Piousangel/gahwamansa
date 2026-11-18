# 2026-11-18 l2-ap10-14 브랜치 리뷰 (독립 리뷰어)

- 대상: f89d35c(AP-14 useBusyLatch 8곳), 463c66a(AP-10 해님 첫 인사·AP-12 테이프 크기), 05f026c(AP-11 useReturnFocus). 갈라진 지점 ed054ef, 최신 main 89bba24와 대조.
- 방법: 별도 worktree에서 실행(jest는 `--cacheDirectory` 별도), 코드 수정 없음.

## 실행 결과

| 항목 | 결과 |
|---|---|
| `git merge-tree main l2-ap10-14` | **충돌 1파일 `app/src/lib/prefs.ts`**. main(B1)의 ZOOM_OPENED·PHOTO_VISITS·PHOTO_VISIT_DAY와 이 브랜치의 FIRST_GREETING이 같은 자리에 들어간다. 양쪽 키를 모두 두면 되는 단순 충돌 |
| `npx tsc --noEmit` | 통과 |
| jest `--maxWorkers=2` | 77 suites / 751 tests 통과. 첫 두 번은 공용 `node_modules`를 누군가 다시 설치하는 중이라 jest가 시작조차 못 해 다시 실행했다 |

## 높음

없음.

## 중간

### M1. 코스 홈의 전환 뒤 실행(`afterTransition`)이 일을 하나만 기억해서, 체크 모션과 포커스 복귀가 서로 덮어쓴다
- 위치: `useAfterTransition.ts`(`pending.current = f`), `CourseHome.tsx`(체크 모션 `setJustDone`과 `useReturnFocus`가 같은 `afterTransition` 사용)
- 단계를 마치고 돌아오는 순서:
  1. 기록이 반영되면 `afterTransition(setJustDone)`이 맡겨진다(아직 가려진 상태).
  2. `popTo`로 focus 이벤트가 오고, useReturnFocus가 `isScreenReaderEnabled` 결과를 기다렸다가 `afterTransition(포커스)`를 맡긴다. 이때도 아직 가려진 상태다.
  3. 대기 칸이 하나뿐이라 2가 1을 덮어쓴다 → **화면 읽기가 켜져 있으면 체크 모션(줄이기 모드 200ms 페이드)이 영영 실행되지 않는다.**
- 화면 읽기가 꺼져 있으면 useReturnFocus가 일을 맡기지 않아 문제가 없다. 그래서 테스트(화면 읽기 켜짐 + 단계 완료 후 복귀)에서 `step-check-anim`을 확인하지 않는 한 드러나지 않는다.
- 권장: `pending`을 배열(대기열)로 바꿔 '보임' 때 순서대로 모두 실행한다. 회귀 테스트로 "화면 읽기 켜짐 + 단계 완료 복귀 → 체크 행과 주 버튼 포커스 둘 다"를 넣는다.

### M2. AP-14 누락: ChildLogin `send`는 여전히 같은 틱에 두 번 보내진다
- 위치: `ChildLogin.tsx`의 `send`(`beginBusy()`의 반환값을 보지 않고, 그 앞에 `isBusy()` 검사도 없음)
- 메일 보내기·다시 보내기를 빠르게 두 번 누르면 `sendEmailCode`가 두 번 불린다. 보낸 횟수 제한(rate_limited)에 빨리 닿는다.
- `verify`는 `verifying` ref로 따로 막혀 있다.
- 권장: `if (!beginBusy()) return;` 패턴으로 통일한다. `begin()`이 false를 돌려주도록 만들어 놓고 8곳 모두 반환값을 쓰지 않으니, 호출부를 이 한 줄로 바꾸면 `isBusy()` 검사와 잠그기가 한 번에 된다.

## 낮음

- **L1. 잠금 해제**
  - 8곳 모두 `finally`나 catch에서 `end()`를 불러, 오류·취소 뒤에도 잠금이 풀린다. 그래서 영구 잠김은 없다.
  - 예외 하나: ChildSettings `doLogout` 성공 경로는 풀지 않는다. 하지만 `resetRole`로 화면이 사라지므로 의도대로다.
  - 남는 위험은 API 약속이 끝나지 않을 때(네트워크가 멈춤)뿐이고, 이건 기존 동작과 같다(시간 제한 없음).
  - 미연결 `useFinishStep` 경로(로컬 도장 `addToday` → `applyStep`)는 잠그기 전에 return해서 잠금 대상이 아니다. 두 번 눌러도 같은 날짜·같은 단계라 결과는 같지만, 일관성을 위해 잠그는 것을 권장한다.
- **L2. AP-11 타이밍**
  - 돌아올 때: 전환 끝(또는 600ms 폴백) 뒤 300ms에 포커스한다. Screen의 제목 포커스는 처음 들어올 때만이라 300/500ms 경합이 없다.
  - 사라진 대상: React 19 ref cleanup으로 맵에서 지워지고 날짜 줄 제목으로 대체된다(테스트 있음).
  - 화면 읽기 꺼짐: 아무것도 안 한다(테스트 있음).
  - '다시 정하기'로 연 설정: 화면 제목 300ms, 확인 제목 500ms로 시간 차이에 기대는 방식이다. 느린 기기에서 Screen 포커스가 늦게 오면 순서가 뒤집힐 수 있다. 더 확실한 방법은 Screen에 "첫 포커스 대상" prop을 두는 것이다.
- **L3. AP-10 1회 기록의 범위**
  - 기록은 기기 단위(prefs, 계정 구분 없음)이고 화면에 보인 순간 바로 남긴다.
  - (a) '모두 지우기'로 계정을 지우고 같은 기기에서 다시 연결해도 인사가 나오지 않는다. 삭제 때 prefs를 지우는지 확인하고, 안 지운다면 1회 기록을 함께 지울 것.
  - (b) 이 기능이 나오기 전부터 연결돼 있던 기존 사용자는 업데이트 뒤 처음 열 때 인사를 보게 된다(빌드 1 전이라 사실상 없음).
  - 문구 `connect.greeting` "안녕하세요, 해님이에요"는 해님이 말하는 범위(첫 만남) 안이다.
- **L4. AP-12 200%**
  - 테이프 = 라벨 폭 + 24, 높이 = 라벨 줄 높이(최소 28)이고, 200%에서 높이 56을 따라가는 테스트가 있다.
  - 라벨이 한 줄 고정이라 아주 좁은 폭 + 200%에서 테이프 폭이 행보다 넓어질 수 있다. 행에 `overflow` 지정이 없어 테이프가 행 밖으로 비칠 수 있으니 실기기 320폭·200%를 한 번 볼 것.
  - 재기 전 값 140×28에서 잰 값으로 바뀌는 순간 한 프레임 깜빡일 수 있다(눈에 띄기 어려움).
- **L5. 테스트 품질**
  - 두 번 누름 테스트(모두 지우기·동의 철회·가족 그만두기)는 같은 틱 두 번 누름을 재현하고, 늦게 온 도장 응답의 언마운트 테스트도 있어 좋다.
  - 빠진 것: M1 조합, ChildLogin send 두 번 누름, 8곳 중 RelationScreen·ConsentScreen·ChildSettings 새 번호의 두 번 누름.

## 합치기 판정

**조건부 합치기.**
- M1(대기열)과 M2(send 잠금)는 각 몇 줄 수정이라 이 브랜치에서 고친 뒤 합치기를 권장한다.
- prefs.ts 충돌은 키를 모두 남겨 해결한다.
- 낮음은 후속으로 처리한다.
