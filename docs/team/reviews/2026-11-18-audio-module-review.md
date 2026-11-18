# 리뷰: L4 AU-03 오디오 모듈 + 0034 이벤트 계약 (2026-11-18)

- 대상: 브랜치 worktree `agent-aa68f8ed427a630c6`, 커밋 `2c29e22`(오디오) · `8dea998`(이벤트 계약), 기준 `03c4d62`(main 조상)
- 검토자: 독립 리뷰어(작성자 아님). 코드 수정 없음.
- 기준: DECISIONS 296·297·317·341, 계획 13 AU-03, `docs/team/dev-audio-spike.md`, `docs/team/pm/bgm-proposal.md`, `docs/team/ARCHITECTURE.md` 2절
- 참고: 리뷰하는 동안 worktree 작업 트리에서 다른 작업(main 병합, `jest.config.js` UU 충돌)이 진행 중이었다. 그래서 검증은 커밋 스냅샷을 scratchpad에 풀고, worktree의 node_modules를 링크해서 돌렸다.

## 실행 결과

| 대상 | tsc | jest (`--testPathIgnorePatterns __integration__ --maxWorkers=2`) |
|---|---|---|
| 브랜치 단독 `8dea998` | 통과 (exit 0) | 72/73 스위트, 689/692 통과. 실패 3건은 모두 `eventsContract`(서버 0034·push-daily 파일이 기준 시점에 없음, 예상한 실패) |
| 브랜치 + 현재 main 모의 병합 (`git merge-tree`, `jest.config.js` 충돌은 두 줄 모두 남겨 해소) | 통과 (exit 0) | 78/78 스위트, 755/755 통과. 계약 비교 3건도 main의 0034·`push-daily/lib.mts`로 통과 |
| eslint (변경 파일) | 경고 0 | — |

- 병합 충돌: `app/jest.config.js` 1건뿐이다(main `testTimeout` 추가와 이 브랜치의 `moduleNameMapper`가 같은 자리). 두 줄 모두 남기면 된다. `package.json`·`stampFeedback.ts`는 자동 병합된다(main의 `hapticConfirm` 변경 유지).

## 높음

### H1. 도장 소리가 실기기에서 한 번도 나지 않음 — react-native-sound 0.13.0은 `require()` 자산 번호를 받지 않는다
- `app/src/audio/engines.ts:55`, `:76`: `new Sound(asset, undefined, cb)`에 `require('../ui/assets/stamp.wav')`(숫자)를 넘긴다.
- 0.13.0의 `node_modules/react-native-sound/src/index.ts:74`는 생성자 첫 줄에서 `filename.startsWith("http")`를 호출한다. 숫자를 넘기면 TypeError가 나고, `loadSound`의 catch가 이를 삼켜 `null`을 돌려준다. 그 결과 `stampFeedback`의 player가 `null`이 되어 촉각만 남고 소리는 영원히 나지 않는다. 오류도 남지 않는다. 이 버전에는 `resolveAssetSource` 처리가 없다.
- jest 모의(`app/jest.setup.js` Sound 클래스)는 숫자를 그대로 받으므로 테스트가 이 문제를 가린다. 커밋 메시지의 "에뮬레이터 E2E 통과"는 소리를 확인하지 않는다.
- 권장 수정:
  - `loadSound`에서 숫자 자산을 `Image.resolveAssetSource(asset).uri` 문자열로 바꿔 넘긴다. debug에서는 Metro http URL로, release에서는 `src_ui_assets_stamp` res/raw 이름으로 풀리고, 0.13.0은 상대 이름을 raw로 찾는다.
  - 또는 `android/app/src/main/res/raw/stamp.wav`에 두고 `loadSound('stamp')` + `Sound.MAIN_BUNDLE`(Android에서는 `''`)로 연다.
  - 함께 할 일: jest 모의가 실제처럼 문자열만 받게 바꾸고(`if (typeof asset !== 'string') throw`), engines 테스트에 "loadSfx가 문자열을 넘긴다" 단언을 추가한다.
  - 실기기·에뮬레이터에서 소리를 실제로 들어 본다(QA-04 3번).

## 중간

### M1. 앱 백그라운드·화면 이탈·화면 읽기 켜짐·전화 수신 때 정지 계약이 모듈에 없다
- `audioCore.ts`, `hooks.ts`: `audioPolicy`는 `appActive=false`일 때 `ttsAllowed:false`를 내지만, 이를 적용해 `stopSpeaking()`을 부르는 곳이 없다. 홈으로 나가거나 TalkBack을 켜거나 화면을 떠나도 읽어 주기가 계속된다.
- 읽어 주기가 계속되는 동안 `speaking=true`도 유지되므로 효과음이 막히고 BGM 덕킹도 이어진다.
- 전화 수신:
  - BGM은 `setCategory('Ambient', true)` 때문에 Android에서 mixWithOthers=true다. 이 경우 react-native-sound가 오디오 포커스를 잡지 않으므로(`Sound.kt:202`, `:398`) 벨이 울리는 동안 BGM이 그대로 나온다. heads-up 수신 화면은 AppState를 바꾸지 않는다.
  - TTS의 `ducking:true`가 등록하는 포커스 리스너는 빈 함수다(`RNSpeechModule.kt:105`). 그래서 포커스를 잃어도 멈추지 않는다.
- 권장 수정:
  - `audio` 모듈 안에 AppState 리스너를 두어, background·inactive가 되면 `stopSpeaking()`을 부르고 등록된 bgm을 정지한다.
  - `useReadAloud()` 훅을 제공한다. 언마운트될 때와 `screenReader`가 true로 바뀔 때 `stopSpeaking()`을 부른다.
  - 전화 수신은 QA-04 5번에서 확인한다. 막을 수 없으면 BGM만 포커스(`AUDIOFOCUS_GAIN`, mixWithOthers=false)를 잡게 하거나 로컬 모듈을 쓴다(스파이크 6절 8번).

### M2. 앱으로 돌아오면 BGM이 저절로 다시 재생된다 (스파이크 6절 5번 "돌아와도 자동 재생 안 함" 위반)
- `hooks.ts:67-73`: `appActive`가 true로 돌아오면 정책이 다시 `play`가 되고 `ctl.play()`가 불린다. 주석(`:50`)은 이를 의도한 동작으로 적었지만, 스파이크·bgm-proposal과 어긋난다. 이어폰 빠짐(`outputLost`)이 들어오면 같은 문제가 생긴다.
- 권장 수정: background나 출력 끊김으로 멈춘 경우 "사용자가 다시 켤 때까지 정지" 상태를 `useBgm`에 둔다. 아니면 결정을 리드에게 확인하고 DECISIONS에 적는다.

### M3. 효과음 판단이 세 곳으로 갈라졌다 (AU-03 "이중 판단 정리"와 반대)
- 세 곳: `stampFeedback.ts:14-16`의 `stampSoundAllowed`, `audioCore.ts:114-128`의 `playSfx`, `audioPolicy.ts:50`의 `sfx`.
- 도장은 `audio().playSfx('stamp')`를 쓰지 않고 자기 player(`stampFeedback.ts:61-68`)를 따로 만든다. 그래서 같은 wav의 Sound 인스턴스(MediaPlayer)가 둘이 될 수 있고, `playSfx`는 호출부가 0인 죽은 경로다.
- 연결 3곳(player·ringer·ttsSpeaking) 자체는 모두 이어져 있다. 무음·진동·모름이면 효과음 금지, 설정 '도장 소리' 꺼짐이면 금지, 읽어 주는 중이면 금지도 유지된다.
- 권장 수정: `stampFeedback`의 소리 쪽을 `audio().playSfx('stamp')` 한 줄로 바꾸고, `stampSoundAllowed`는 `playSfx`가 쓰도록 lib로 옮겨 판단을 한 곳에 둔다.

### M4. 읽어 주기 속도 `rate: 0.5`의 뜻이 플랫폼마다 다르다
- `engines.ts:12`: Android에서는 1.0이 보통 속도라 0.5는 절반 속도다. iOS는 AVSpeech 기본이 0.5라 보통 속도다. 스파이크(6절 1번)는 0.9~1.0을 후보로 적었다.
- 권장 수정: `Platform.select({android: 0.9, ios: 0.45})`처럼 나누고 QA-04 1번에서 확정한다. 근거를 DECISIONS에 남긴다.

### M5. BGM 트랙 해제(release) 책임이 정해져 있지 않다
- `audioCore.ts:131-156`의 `bgm().stop()`과 `hooks.ts:61-65`의 `useBgm` 정리는 `track.stop()`만 부르고 `release()`는 부르지 않는다. 화면이 `loadSound`로 만든 트랙을 직접 release해야 한다는 규칙이 문서·주석 어디에도 없다. 화면을 오갈 때마다 MediaPlayer가 새는 위험이 있다(AP-04 연결 때 터질 지점).
- 권장 수정: `useBgm`이 트랙 생성(자산 받기)과 해제를 모두 맡게 하거나, 주석과 훅 시그니처에 "호출부가 release"를 명시한다.

### M6. 벨소리 리스너 해제가 다른 구독까지 끊는다
- `engines.ts:35`의 `removeRingerListener`는 volume-manager 안에서 `SilentListenerNativeModule.unregisterObserver()`를 전역으로 부른다(`module.ts:310-317`).
- native-stack은 이전 화면을 마운트한 채로 둔다. 그래서 `useAudioInputs`가 두 개 동시에 있다가 하나가 언마운트되면, 남은 쪽은 벨소리 변경을 받지 못한다. AppState 복귀 때 다시 읽기는 남는다.
- 권장 수정: 모듈 수준에서 구독 수를 세어, 마지막 구독이 해제될 때만 `removeRingerListener`를 부른다. 그 밖에는 `sub.remove()`만 한다.

## 낮음

- **L1** `engines.ts:103-109` `hasKorean`: false 결과도 영구 캐시한다. 사용자가 한국어 음성 데이터를 설치하고 돌아와도 앱을 다시 켤 때까지 "음성 없음"으로 남는다. true만 캐시하거나, 앱이 active로 돌아올 때 캐시를 비운다.
- **L2** `audioCore.ts:84-102` `speak`: 이전 발화를 멈추지 않고 큐에 쌓인다(두 번 누르면 두 번 읽음). 이전 발화의 `onFinish`·`onStopped`가 다음 발화의 `setSpeaking(true)` 뒤에 도착하면 잠깐 덕킹이 풀린다. 시작 전에 `stop()`을 부르고, 발화 id로 이벤트를 거르기를 권한다. 엔진이 start·done을 끝내 보내지 않으면 `speaking`이 true로 남아 효과음이 계속 막히므로, 안전 타이머도 검토한다.
- **L3** `speak(text, {screenReader})`: 화면 읽기 값을 호출부가 넘겨야 한다. 판단 함수는 하나지만 입력이 틀릴 여지가 있다. `useReadAloud()`(M1)가 `useScreenReader`를 직접 읽게 하기를 권한다.
  - SunBubble(`SunBubble.tsx:67`)은 `!screenReader`를 `readAloudAllowed(screenReader)`로 바꿨을 뿐 동작이 같아 회귀가 없다. 기존 R16 테스트(`u0SunBubble.test.tsx:57`)도 통과한다.
- **L4** `audioCore.ts:133`: BGM 기본 볼륨이 1이다. bgm-proposal은 "약 30%, 2초 페이드 인"이다. 덕킹 10%가 절대값인지 기본 볼륨에 대한 상대값인지 AP-04 전에 정한다.
- **L5** iOS: `ducking:true`가 AVAudioSession 카테고리를 바꾸면, react-native-sound의 Ambient(무음 스위치 따름)가 덮일 수 있다. 빌드 1은 Android 우선이라 보류해도 되지만, QA 목록에 적어 둔다.
- **L6** 레이어: `src/audio/`가 ARCHITECTURE 2절에 없고, `audio → ui`(a11y, assets) 의존이 있다. 2절 그림과 `.eslintrc.js`에 audio 계층 규칙(features·app·copy import 금지)을 추가한다.
- **L7** `package-lock.json`의 루트 version이 0.0.1에서 1.0.0으로 함께 바뀌었다(package.json과 맞춘 것이라 무해). 커밋 설명에 한 줄 적으면 충분하다.
- **L8** `audioEngines.test.ts:13`: `Platform.OS = 'android'`를 되돌리지 않는다. 파일 단위로 격리되므로 영향은 작다.

## 항목별 확인

1. **의존성·권한**
   - `package.json`·lock 모두 정확 고정이다: speech 1.4.4, sound 0.13.0, volume-manager 2.2.0(`^` 없음, integrity 있음). 설치본 버전도 같다.
   - 라이브러리 매니페스트: speech는 `<queries>` TTS_SERVICE만 있다. sound는 빈 매니페스트(옛 `package=` 속성만). volume-manager는 빈 매니페스트다. 새 권한은 없다.
   - 세 라이브러리 모두 .so가 없다(Kotlin·JS만).
   - APK 크기: 커밋에 debug +983,131바이트로 기록돼 있다. release·AAB 증가량은 기록되지 않았다. AU-03 확인 방법이 "APK 크기 기록"이므로 release 값을 추가하기를 권한다.
2. **audioCore**
   - 덕킹 순서는 맞다. 시작 전에 true로 바꿔 10%로 낮추고, done(끝·멈춤·오류)에 false로 바꿔 1로 되돌린다. 정지된 bgm은 리스너를 해제한다.
   - 오류는 모두 catch되어 화면에 영향이 없다. 단, H1처럼 조용히 실패하는 문제를 가린다.
   - 정지·해제·메모리 문제는 M1·M2·M5·M6에 정리했다.
3. **readAloudAllowed**: 정확하다. 무음·진동에서는 허용하고 TalkBack이면 막는다. SunBubble 회귀는 없다. 효과음 금지도 유지된다(M3은 구조 문제).
4. **stampFeedback 연결 3곳**: player·ringer·ttsSpeaking 모두 연결돼 있다. 다만 player가 H1 때문에 실기기에서 항상 null이다.
5. **훅 언마운트 정리**: `useSpeaking`·`useAudioInputs`(alive 가드, ringer 해제, AppState remove)·`useBgm`(stop)은 정리된다. release(M5)와 전역 해제(M6)가 남은 문제다.
6. **이벤트 계약 비교 테스트**
   - 구조는 좋다. 마지막으로 정의한 마이그레이션을 찾고, 주석을 제거한 뒤 값까지 비교한다. main 병합 뒤 5/5 통과한다.
   - 견고성 보강점 (`eventsContract.test.ts`):
     - `:26` 정규식이 `public.` 접두와 공백 없는 `(`만 잡는다. 새 마이그레이션이 `function log_event (`이나 접두 없이 정의하면 옛 파일로 조용히 비교한다. `\s*`과 선택적 스키마를 허용하기를 권한다.
     - `:28` 정의를 못 찾으면 `file`이 undefined가 되어 TypeError가 나고 메시지가 불친절하다. `expect(hits.length).toBeGreaterThan(0)`을 먼저 둔다.
     - `:31` 본문 끝을 `$$;`로만 찾는다. `$function$` 같은 태그 달러 인용을 쓰면 본문이 잘못 잘린다.
     - `:47` describe 본문에서 파일을 읽으므로, 실패하면 테스트 단위가 아니라 스위트 수집 오류로 나온다. `beforeAll`로 옮긴다.
     - `:35` 이름 추출 정규식이 `[a-z_]+`라 숫자가 든 이름은 빠진다. 실패는 시끄럽게 나므로 위험은 낮다.
   - push-daily 채널 id 비교(`:72-78`)는 적절하다.
7. **테스트 품질**
   - 정책 단위 테스트(audioCore 13건)는 결정 규칙을 잘 고정한다.
   - 그러나 네이티브 모의가 실제 API보다 관대해 H1을 놓쳤다.
   - 훅 테스트(언마운트 정리, background 때 정지, useBgm 복귀 동작)가 0건이다. M1·M2·M5를 고칠 때 함께 추가하기를 권한다.

## 판정

**조건부 통과 — H1 수정 뒤 병합.**

- H1은 기능이 통째로 무음이 되는 결함이다. 수정한 뒤 실제 재생을 확인하고, jest 모의도 실제처럼 바꿔야 한다.
- M1~M6은 AP-03·AP-04가 이 모듈을 쓰기 전에 고치기를 권한다. 특히 M1·M2·M5는 화면 연결 뒤 고치면 비용이 커진다. M3·M4는 이번 병합 범위에서 처리하기를 권한다.
- 병합 때 `jest.config.js` 충돌은 두 줄을 모두 남기면 된다.
