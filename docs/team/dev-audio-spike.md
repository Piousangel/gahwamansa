# U1 오디오 스파이크: 내장 TTS · 효과음 · BGM · 덕킹 · 무음 (앱 개발, 2026-11-17)

범위: 마스터 계획 10 §2 U1. 근거: DECISIONS 11-17 "읽어주기: 휴대폰 내장 한국어 TTS", "배경 음악: 빌드1 포함, 기본 꺼짐", `docs/team/pm/bgm-proposal.md`, TalkBack 명세 R16.
**상태: 리드 승인 대기. package.json 에 아무것도 넣지 않았다.** 실기기 확인은 하지 않았다(QA가 폰 사용 중) → 아래 "실기기 확인 항목"은 QA 게이트(실기기 2종)에서.
버전·날짜는 2026-11-17 `npm view <pkg> time` 로 직접 확인. "배포 2주 이상" = 2026-11-03 이전 배포.

## 1. 결론(권고안)
| 역할 | 권고 | 고정 버전 | 배포일 | 새 아키텍처 |
|---|---|---|---|---|
| 내장 TTS | `@mhpdev/react-native-speech` | **1.4.4** | 2026-10-26 (22일) | TurboModule 전용(README "Only New Architecture", codegenConfig 있음) |
| 효과음·BGM | `react-native-sound` | **0.13.0** | 2025-10-15 | TurboModule(codegenConfig type all) |
| 무음 모드(Android) | `react-native-volume-manager` | **2.2.0** | 2026-09-04 | README "New Architecture projects are the supported path" |

- 덕킹: **앱 안에서 직접**. 둘 다 우리 앱 소리라 OS 오디오 포커스 덕킹에 기대지 않고, TTS 시작·끝 이벤트에 맞춰 BGM `setVolume(0.1)` ↔ `1`. 결정 규칙은 이미 순수 함수로 작성·테스트함: `app/src/lib/audioPolicy.ts`(`BGM_DUCK_VOLUME = 0.1`). 다른 앱(유튜브·라디오) 소리 덕킹은 speech 라이브러리의 선택 옵션(README "Optional Audio Ducking")으로.
- 무음 존중: Android 는 미디어 소리가 벨소리 무음에 꺼지지 않으므로 `getRingerMode()`가 normal 이 아니면 BGM·효과음 끔. **읽어 주기는 사용자가 직접 누른 소리라 무음에서도 허용**(정책 결정 필요 시 리드). iOS 는 react-native-sound 가 `AVAudioSessionCategoryAmbient` 를 써서 무음 스위치를 자동으로 따른다(README).
- 화면 읽기(TalkBack) 켜짐: '읽어 주세요' 숨김(SunBubble 구현 완료) + BGM 자동 정지(audioPolicy).
- 대안(의존성 0): 3번째 패키지(volume-manager)를 빼고 싶으면 Android `AudioManager.getRingerMode()` 한 줄짜리 로컬 TurboModule(약 30줄 Kotlin)로 대체 가능. TTS 도 같은 방식(Android `TextToSpeech` 직접, 약 150줄)이 가능하지만 iOS·일시정지·이벤트까지 하면 라이브러리가 싸다.

## 2. TTS 후보 비교
| 후보 | 버전·배포 | 새 아키텍처 | 장점 | 탈락·위험 |
|---|---|---|---|---|
| **@mhpdev/react-native-speech** | 1.4.4 · 2026-10-26 | TurboModule 전용 | 활발(2026년 5회 배포), 이벤트, Android 일시정지 자체 구현(API 26+), 선택 덕킹 | 개인 메인테이너(버스 팩터 1). 이벤트 이름·한국어 음성 조회 API는 설치 후 확인 |
| react-native-tts | 4.1.1 · 2024-06-14 | 옛 브리지(인터롭 레이어로만 동작) | 오래 쓰임, `setDucking`, iOS 무음 스위치 옵션 | 2년 넘게 정체, 새 아키텍처 미지원 → **제외** |
| expo-speech | 58.0.4 · 2026-11-11 | 지원 | 품질 | peer `expo` 필요(맨 RN CLI 에 expo-modules 인프라 추가) + 배포 2주 미만 → **제외** |
| 로컬 모듈 직접 | — | 직접 작성 | 의존성 0 | iOS·일시정지·이벤트 비용, 출시 일정 → 보류(대안) |

## 3. 효과음·BGM 후보 비교
| 후보 | 버전·배포 | 새 아키텍처 | 장점 | 탈락·위험 |
|---|---|---|---|---|
| **react-native-sound** | 0.13.0 · 2025-10-15 | TurboModule | 작고 단순, 번들 파일 재생·루프·볼륨, Android MediaPlayer + 오디오 포커스 처리, iOS Ambient | 스트리밍 불가(필요 없음: 30초 곡 2개·효과음 2~3개 번들) |
| react-native-audio-api | 1.0.1 · 2026-11-16 / 1.0.0 · 2026-11-03 / 0.13.6 · 2026-09-23 | TurboModule(C++) | Web Audio 수준 제어 | 과함(C++·크기), 1.0 직후 nightly 매일 → **제외** |
| react-native-nitro-sound | 0.2.20 · 2026-09-06 | Nitro | — | `react-native-nitro-modules` 추가 의존, 녹음 중심 → **제외** |
| expo-audio | 58.0.12 · 2026-11-11 | 지원 | — | expo 인프라 + 2주 미만 → **제외** |

## 4. 무음 모드 후보
| 후보 | 버전·배포 | 비고 |
|---|---|---|
| **react-native-volume-manager** | 2.2.0 · 2026-09-04 | Android 벨소리 모드 읽기·구독(`getRingerMode`, `addRingerListener`), iOS 무음 스위치. 읽기에는 방해 금지 권한 불필요(설정 변경에만 필요, 우리는 안 씀). "OEM·버전에 따라 다를 수 있음"(README) |
| react-native-ringer-mode | 2.0.1 · 2024-03 | 정체 → 제외 |
| react-native-silent-switch | 0.1.0 · 2022 | peer react ^16 → 제외 |

## 5. 연결 설계(승인 후, 화면 수정 최소)
- `src/lib/audioPolicy.ts`(완료, 테스트 7건): 입력(설정·화면·벨소리·화면 읽기·TTS 중·앱 활성·출력 끊김) → `{bgm, bgmVolume, sfx, ttsAllowed}`. 벨소리를 모르면 조용한 쪽.
- 다음(승인 후): `src/audio/`(가칭) — `useAudioInputs()`가 AppState·volume-manager·`useScreenReader`(ui/a11y)·speech 이벤트를 모아 policy 에 넣고, react-native-sound 인스턴스에 적용. 화면은 `speak(text)`·`playSfx('stamp')`·`useBgm(screen)`만 부른다. 라이브러리 교체 시 이 폴더만 바뀐다.
- Android 11+ 패키지 가시성: TTS 엔진 조회에 매니페스트 `<queries><intent><action android:name="android.intent.action.TTS_SERVICE"/></intent></queries>` 필요(일반 Android 규칙, 라이브러리 문서 재확인 필요).
- 한국어 음성 없음(엔진 미설치·데이터 미다운로드): '읽어 주세요'를 숨기지 말고 누르면 배너로 "휴대폰에 한국어 읽기 기능이 없어요"(라이터 문구 필요) — 판정은 speech 의 음성 목록에 `ko` 가 있는지.

## 6. 실기기 확인 항목(QA 게이트, 2종: 삼성 One UI + 픽셀)
1. 한국어 음성이 기본으로 있는지(삼성 TTS / Google TTS), 속도 0.9~1.0 이 어르신에게 알맞은지
2. BGM 재생 중 '읽어 주세요' → BGM 10%로 줄고 끝나면 복귀(끊김·튐 없음)
3. 벨소리 무음·진동 → BGM·효과음 안 남, 읽어 주기는 남
4. 유튜브 재생 중 앱 열기 → 우리 BGM 은 기본 꺼짐이라 유튜브 유지, 읽어 주기 시 유튜브 줄어듦(덕킹 옵션)
5. 이어폰 빼기·홈으로 나가기·전화 수신 → 즉시 정지, 돌아와도 자동 재생 안 함
6. TalkBack 켜짐 → '읽어 주세요' 없음, BGM 정지, TalkBack 말과 겹침 없음
7. Android 빌드: 새 아키텍처 자동 링크·codegen 통과, APK 크기 증가량
8. 미확인(가정): react-native-sound 의 Android 오디오 포커스가 TTS 와 서로 포커스를 뺏는지 → 뺏으면 BGM 재생을 `AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK` 쪽으로 바꾸는 패치 또는 로컬 모듈 필요

## 7. 추정
- 승인 후 연결·테스트: 4~6h(가정). 실기기 확인: QA 1~2h.
