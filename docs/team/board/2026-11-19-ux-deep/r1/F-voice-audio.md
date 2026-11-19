# F. 음성·오디오 — '읽어 주기'가 기계음처럼 들리는 문제 (위원 ⑥, r1, 2026-11-19)

오너 지시: "음성 읽어 주기가 너무 컴퓨터가 읽어 주는 것 같다. 좋은 라이브러리나 쓸 만한 것을 찾아라."
표기: **확인**은 공식 문서·코드에서 직접 본 것이다. **추정**은 근거가 간접적인 것이고, **미확인**은 찾지 못한 것이다. 가격은 2026-11-19 조회 기준이다.

## 0. 결론 먼저

- **핵심 발견**: 지금 읽어 주는 문장은 **전부 고정 문구**다(코드 확인). 콘텐츠 질문·선택지·낱말은 서버 콘텐츠에서 오고, 응원은 서버 확정 키 4개(`copy.cheers.*`)의 고정 문장이다. 자녀가 직접 쓴 글이나 어르신 입력은 읽지 않는다. 그래서 **콘텐츠 게시 단계에서 고품질 음성을 미리 만들어 배포**(B안)하면 런타임에 외부로 보내는 것이 0이 되고, 개인정보 문제도 없다.
- **추천**: 단기에는 **A안(기기 TTS 튜닝, 0원, 반나절)**을 바로 적용한다. 출시 전후로 **B안(Google Cloud TTS Chirp 3 HD 또는 Gemini-TTS로 미리 생성한 오디오)**으로 바꾸고, 기기 TTS는 오디오 파일이 없을 때의 대체 수단으로만 남긴다. 비용은 1년치 콘텐츠를 다 만들어도 무료 한도 안이거나 몇 달러 수준이다(추정).
- 실시간 클라우드(C)는 B보다 나은 점이 없으므로 쓰지 않는다. 사람 성우(D)는 매일 새 콘텐츠를 녹음해야 하는 운영 부담 때문에 1차에서 제외한다.

## 1. 현재 코드가 어떻게 읽는가 (코드 확인)

| 항목 | 현재 값 | 위치 |
|---|---|---|
| 라이브러리 | `@mhpdev/react-native-speech` 1.4.4 (Android `TextToSpeech` 래핑) | `app/src/audio/engines.ts` |
| 엔진 | **지정 안 함** → 기기 기본 엔진. 라이브러리는 `getEngines()`·`setEngine('com.google.android.tts')`를 지원하는데 쓰지 않는다 | `engines.ts` `createTtsEngine` |
| 보이스 | **지정 안 함**(`voice` 옵션 없음). `language: 'ko-KR'`만 줘서 엔진의 기본 한국어 보이스를 쓴다 | `ttsOptions()` |
| 속도·피치 | Android rate 0.9, iOS 0.45, pitch 1.0, ducking true | `TTS_RATE`, DECISIONS 11-18 |
| 한국어 판정 | `getAvailableVoices('ko')`의 길이가 0보다 큰지만 본다. 품질은 보지 않는다 | `hasKorean()` |
| 보이스 품질 정보 | 라이브러리는 `quality > QUALITY_NORMAL`이면 `'Enhanced'`를 준다. `isNetworkConnectionRequired`는 넘겨주지 않는다 | `RNSpeechModule.kt:182` |
| 읽는 문장 틀 | photo `"{질문1} {질문2}"` · question `"{질문} {선택지1}, 아니면 {선택지2}."` · word `"{낱말}. 한 글자씩, {글자들}."`(글자를 `, `로 이음) · cheer `"가족이 보낸 응원이에요. {응원}"` | `copy.ko.json` `tts.read`, `ReadAloud.tsx` `ttsText` |
| 응원 출처 | 서버 키 4개 → `copy.cheers`(예: "늘 고마워요"). **자유 입력 아님** | `CheerDialog.tsx:48` |

### 왜 기계음처럼 들리나 (원인 가설, 실기기 확인 전)

1. **엔진과 보이스를 운에 맡긴다.** 갤럭시의 기본 TTS 엔진은 삼성 TTS일 가능성이 높다(추정). 삼성 지원 문서는 설정 > 일반 > 텍스트 음성 변환에서 삼성과 Google 중 하나를 고를 수 있다고만 안내한다([삼성 지원](https://www.samsung.com/us/support/answer/ANS00092523/)). 어느 엔진이든 지금 코드는 엔진이 정한 기본 한국어 보이스를 쓴다. 그 보이스가 오프라인용 저품질(local)일 수 있다.
2. **고품질(네트워크) 보이스를 고르지 않는다.** Google TTS는 한국어 보이스를 여러 개 두고, 보이스 이름에 `-local`·`-network`가 붙는다(추정. 기기에서 `getAvailableVoices('ko')` 결과로 확인 필요). network 보이스가 대체로 더 자연스럽다(추정).
3. **문장 틀 자체가 기계적인 패턴이다.**
   - word: "학교종. 한 글자씩, 학, 교, 종." 같은 **한 음절 나열**은 TTS가 가장 어색하게 읽는 패턴이다. 억양 없이 뚝뚝 끊어진다.
   - photo: 질문 두 개를 공백 하나로 이어 한 번에 넘긴다. 문장 사이 쉼이 짧아 숨 쉴 틈 없이 들린다.
4. **rate 0.9**는 Android 기준으로 보통보다 조금 느린 값이다. 과속이 원인일 가능성은 낮다. 오히려 0.8 근처가 어르신에게 맞는지 들어 볼 만하다(추정).
5. 숫자·기호: 지금 문장에 숫자는 거의 없다. 다만 기호와 괄호를 읽지 않거나 이상하게 읽는 엔진이 있으므로 콘텐츠 검수 규칙에 넣는다.
6. **근본 한계**: 기기 TTS는 튜닝해도 '안내 방송 톤'이 남는다. 최근 클라우드 신경망 보이스(Chirp 3 HD, Gemini-TTS, ElevenLabs v3 등)와 비교하면 차이가 크다(공식 데모 청취로 확인 권장).

## 2. A안 — 기기 TTS만으로 할 수 있는 개선 (0원, S 2~4h)

1. **엔진 우선순위**: 시작할 때 `getEngines()`로 목록을 받는다. `com.google.android.tts`가 있으면 `setEngine`을 부르고, 없으면 기본 엔진을 쓴다. 삼성 엔진이 더 나은지는 실기기에서 둘 다 들어 보고 정한다(사용자 귀로 판정).
2. **보이스 고르기**: `getAvailableVoices('ko')` 결과에서 `quality === 'Enhanced'` → 이름에 `network` 포함 → 나머지 순서로 고르고, `speak` 옵션에 `voice: identifier`를 넘긴다. network 보이스는 오프라인이거나 느리면 엔진이 local로 대체하거나 실패할 수 있다(추정). 그래서 실패하면 기본 보이스로 한 번 더 읽는다.
3. **문장을 나눠 읽기**: 문장마다 `speak`를 따로 부르면 문장 사이에 자연스러운 쉼이 들어간다. Android `TextToSpeech`는 SSML을 공식 지원하지 않는다(추정). 그래서 쉼은 문장 분리, 줄바꿈, 마침표로 만든다.
4. **문장 틀 고치기**(라이터와 함께):
   - word: "한 글자씩, 학, 교, 종" 대신 "학교종. 학… 교… 종." 또는 글자 읽기를 아예 뺀다. 글자 나열은 화면이 이미 보여 준다.
   - photo: 질문 사이에 마침표나 물음표를 넣고 따로 읽는다.
5. **속도**: Android 0.85와 0.9를 비교한다. pitch는 1.0을 유지한다. 피치를 바꾸면 기계음이 더 심해지는 경우가 많다(추정).
6. **한계**: 기기마다 결과가 다르다(어르신 폰은 S25만 있지 않다). '컴퓨터가 읽는 느낌'은 줄어들 뿐 없어지지 않는다(추정). A안은 B안이 들어오기 전까지 쓰는 다리이자, 이후에는 대체 수단이다.

## 3. 클라우드 TTS 비교표

미리 생성(B안) 용도로 본다. 우리가 보내는 텍스트는 콘텐츠와 고정 문구뿐이고 사용자 데이터는 0이다.

| 서비스 | 한국어 보이스 | 자연스러움 근거 | 가격 | 미리 생성한 파일을 앱에 넣어 배포 | 비고 |
|---|---|---|---|---|---|
| **Google Cloud TTS — Chirp 3 HD** | ko-KR 지원 **확인**. 이름 형식 `ko-KR-Chirp3-HD-<보이스>`. 속도 0.25~2.0, `markup` 필드의 쉼 태그 지원(가끔 무시됨), SSML은 Preview([공식](https://docs.cloud.google.com/text-to-speech/docs/chirp3-hd)) | 최신 세대(추정). 공식 데모에서 직접 들어 볼 것 | **$30/100만 자**(문자당 $0.00003, 공식 가격 페이지 스니펫). 무료 100만 자/월 여부는 **미확인**(3자 사이트만 그렇게 적음)([가격](https://cloud.google.com/text-to-speech/pricing)) | 공식 문서: "You can use the audio data files you create using Cloud Text-to-Speech in your applications or media"(GCP 약관 조건부)([quotas](https://docs.cloud.google.com/text-to-speech/quotas)) **확인** | 결제 계정이 이미 있음(Lyria·Gemini 사용 중) → 도입 마찰이 가장 작다 |
| Google — Neural2·WaveNet·Standard | ko-KR 보이스 있음(목록 대조는 **미확인**) | Chirp 3 HD보다 한 세대 앞(추정) | WaveNet·Neural2 약 $16/100만 자, Standard $4(**미확인**: 공식 페이지 본문을 못 읽음) | 위와 같음 | 대안 |
| **Google — Gemini-TTS**(Cloud TTS 안) | ko-KR **GA 확인**([공식](https://docs.cloud.google.com/text-to-speech/docs/gemini-tts)). 자연어 프롬프트로 톤·속도 조절(예: "따뜻하고 천천히, 어르신께 말하듯") | 표현력 최상위권(추정) | 토큰 과금. 2.5 Flash TTS 입력 $0.50/100만 토큰, 오디오 출력 $10/100만 토큰(25토큰/초)(검색 스니펫, **공식 재확인 필요**) | Cloud TTS 안의 모델이라 위 문구가 적용될 것(추정) | 결과가 매번 조금씩 다름 → 사람 검수 필수. 모델 ID·이름이 자주 바뀜 |
| **Azure Neural** | ko-KR 13종 **확인**: SunHi·InJoon·Hyunsu(Multilingual)·BongJin·GookMin·JiMin·SeoHyeon·SoonBok·YuJin, HD(DragonHD SunHi·Hyunsu), MAI-Voice-2 Haena·Junho(`softvoice` 등 스타일)([공식 표](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=tts)). **노인 보이스 표기는 없음**(Child·Senior 표시 0) | 다양하다. `softvoice` 스타일이 어르신용으로 시험해 볼 만함(추정) | Neural 약 $15/100만 자, HD 약 $22(3자 집계. 공식 페이지는 금액이 비어 있음 → **미확인**). 무료 F0 50만 자/월 **확인** | 포럼 답변이 인용한 Product Terms: 유료 등급에서 "audio output of prebuilt neural voices … including for commercial purposes"([Q&A](https://learn.microsoft.com/en-us/answers/questions/366944/is-there-audio-files-generated-by-azure-text-to-sp)). 무료 등급은 상업 이용 해석이 엇갈림 → 유료 등급 권장 | 계정을 새로 만들어야 함 |
| Amazon Polly | Seoyeon(Neural, 2025-11 Generative GA), Jihye(Neural, 2025-03)([AWS 공지](https://aws.amazon.com/about-aws/whats-new/2025/03/new-korean-voice-amazon-polly)) | Generative는 최신(추정) | **확인**: Neural $16, Generative $30/100만 자. 무료: Neural 100만 자/월, Generative 10만 자/월(첫 12개월)([가격](https://aws.amazon.com/polly/pricing/)) | 공식: "cache and replay … at no additional cost". 재배포는 명시 없음(**미확인**) | 여성 보이스만 2종 |
| NAVER CLOVA Voice / Dubbing | 한국어 특화. 화자가 많다(추정) | 국내 평판 좋음(추정) | 공식 문서 요금표가 "-"로 비어 있음 → **미확인**. 호출이 없어도 기본 요금 발생 **확인**([ncloud 문서](https://guide.ncloud-docs.com/docs/clovavoice-spec)) | Dubbing 문서: Standard는 개인·비영리만, "제품 및 서비스 탑재(소프트웨어)"는 Standard X, Premium은 CLOVA Voice 안내를 보라고 함 → **조건 확인 필요**([Dubbing 플랜](https://guide.ncloud-docs.com/docs/ko/clovadubbing-serviceplan)) | 월 기본료 구조라 소량 사용에 불리 |
| ElevenLabs | Multilingual v2·v3에 한국어 포함(추정. 공식 models 문서로 재확인 필요) | 감정 표현 최상위권(추정) | **확인**: v2·v3 $0.08/1천 자(=$80/100만 자). Starter $6/월에 7.5만 자([가격](https://elevenlabs.io/pricing/api)) | 공식 도움말: **무료 플랜은 상업 이용 불가**, 유료 구독 중 만든 결과물은 상업 이용 가능(기간 제한 없음), **Beta 서비스 결과물은 상용 금지**([도움말](https://elevenlabs.io/docs/help-center/legal/can-i-publish-the-content-i-generate-on-the-platform)) | v3가 Beta(alpha)라면 상용 불가 → 확인 필요 |
| Typecast | 한국어 강함(국내 서비스) | 캐릭터 보이스가 많음(추정) | 웹 플랜과 API 플랜이 따로임. 금액은 출처마다 달라 **미확인**([가격](https://typecast.ai/pricing)) | API 약관: 라이선스가 "non-transferable, non-sublicensable" → 앱 탑재·재배포는 **불명확**, 문의 필요([API 약관](https://help.typecast.ai/en/articles/11872662-typecast-api-terms-of-use)) | 약관 리스크 |
| Supertone Play/API | 한국어 지원 | 표현력 좋음(추정) | 한국어 페이지 기준 Starter $2.99/월에 2만 크레딧(약 30분). 영문·한국어 페이지 구성이 서로 다름([Play](https://www.supertone.ai/ko/play)) | 저가 플랜은 'Supertone' **출처 표기 조건**. 상업 범위는 페이지마다 상충 → **미확인** | 출처 표기를 앱 정보 화면에 넣어야 할 수 있음 |
| 온디바이스 신경망(sherpa-onnx KSS VITS 등) | 한국어 KSS 모델 1종(오래된 저품질 low)([sherpa 커밋](https://huggingface.co/csukuangfj/sherpa-onnx-apk/commit/c7311420ea82a09de0e0627d853033f913e3a8a4)) | 기기 TTS와 비슷하거나 낮음(추정) | 0원 | 모델 라이선스 확인 필요 | 앱 용량 수십 MB 증가. 고정 문구만 읽는 지금은 필요 없음 |

**개인정보**: B안에서 클라우드로 보내는 것은 콘텐츠 원문(공개 예정 문구)과 고정 UI 문구뿐이다. 사용자 식별자, 자녀 응원, 어르신 입력은 0이다. 처리 방침에 새 위탁 항목을 넣을 필요가 없다(추정, 정책 위원 확인 필요). 빌드 시점의 개발자 PC나 스크립트에서만 호출하므로 앱에 API 키도 넣지 않는다.

## 4. 방식 비교

**분량 가정**: 하루치 읽기 문장은 photo(질문 2개) 약 40자, question(질문+선택지 2개) 약 40자, word 약 20자로 **하루 약 100~120자**다(seed_content_30d.sql 기준 추정). 고정 UI 문구는 응원 4문장, "가족이 보낸 응원이에요", "응원이 n개 왔어요"(n=2~4) 정도로 **200자 미만**이다.

| | A 기기 TTS 개선 | **B 미리 생성 + 배포** | C 실시간 클라우드 | D 사람 성우 |
|---|---|---|---|---|
| 품질 | 중하(기기마다 다름) | **상**(한 번 듣고 고른 결과를 고정) | 상 | 최상 |
| 비용 | 0 | 1년치 약 4.4만 자 × 보이스 비교 재생성 5배 ≈ 22만 자 → Chirp 3 HD $30/100만 자로 **약 $7**, 무료 한도가 있으면 0원(추정). ElevenLabs Starter 1~3개월이면 $6~18 | 매 재생마다 과금, 사용자 수에 비례 | 녹음 단가가 공개 근거 없음(**미확인**). 하루 3문장 × 365일 = 약 1,100문장, 매 콘텐츠마다 외주. 수백만 원대 추정 |
| 용량 | 0 | mono MP3·AAC 48kbps ≈ 6KB/초. 하루 약 25초 ≈ **150KB/일**. 앱에 다 넣으면 1년치 약 55MB → **번들 금지, 사진처럼 하루치를 서버 스토리지에서 받기**. 고정 문구는 번들(<200KB) | 0(스트리밍) | B와 같음 |
| 오프라인 | 됨 | 받아 둔 날은 됨. 못 받으면 기기 TTS로 대체 | 안 됨 | B와 같음 |
| 개인정보 | 외부 전송 0 | **런타임 외부 전송 0** | 콘텐츠 텍스트를 런타임에 전송(사용자 데이터는 아님). 앱에 키를 넣거나 서버 프록시가 필요 | 0 |
| 일정 | S 2~4h | 파이프라인(생성 스크립트 + 스토리지 업로드 + 콘텐츠 행 `audio_*` 컬럼 + 앱 재생·대체) **M~L 1~2일**, 보이스 고르기 반나절(사용자 청취) | M | 섭외부터 수 주 |
| 운영 | 없음 | 콘텐츠 게시 때 자동 생성(`scripts/photos/publish-content.mjs` 흐름에 한 단계 추가), 사진처럼 검수 | 장애·지연·키 관리 | 매번 녹음 |

### B안 설계 메모

- **생성 위치**: `scripts/photos/` 게시 파이프라인. 이미 Gemini 키로 사진을 만들고 `content-gate`로 검수하는 흐름이 있다. 같은 흐름에 `gen-voice.mjs`를 넣는다.
- **단위**: 문장 하나에 파일 하나(질문1, 질문2, 질문+선택지, 낱말 문장). 재생할 때 순서대로 이어 붙인다. 응원은 고정 4개 + 머리말 파일을 번들한다. "응원이 3개 왔어요"도 n=2~4 파일 3개를 번들한다.
- **word 문장**: 한 음절 나열은 Chirp 3 HD의 `markup` 쉼 태그나 Gemini-TTS 프롬프트("한 글자씩 또박또박")로 처리한다. 결과는 사람이 귀로 검수한다.
- **재생**: 지금 쓰는 `react-native-sound` 0.13.0으로 충분하다(추정). 받아 둔 로컬 파일 경로나 URL을 재생한다. 덕킹은 `createAudio`의 speaking 상태를 '음성 파일 재생 중'에도 똑같이 세우면 된다. `TtsEngine` 인터페이스 뒤에 '파일 우선, 없으면 기기 TTS' 구현을 하나 더 두면 화면 코드(`ReadAloud`)는 바뀌지 않는다.
- **검수**: 생성 결과의 발음 오류(사투리 낱말, 옛말)는 반드시 사람이 듣는다. 틀리면 그 문장만 다시 만든다.
- **출처 고지**: BGM처럼 "AI 음성(Google)" 한 줄을 앱 정보에 둘지는 정책 위원과 정한다(Google은 표기 의무 문구를 찾지 못함 → **미확인**).

## 5. 재생 라이브러리

- **react-native-sound 0.13.0 유지 추천.** 이미 승인·설치됐고, 짧은 클립을 재생하고 볼륨으로 덕킹하는 데 충분하다. 클립이 끝났을 때 받는 콜백(`play(cb)`)으로 '다 읽으면 기본 상태로'를 구현할 수 있다(추정. `SoundHandle`에 끝 콜백을 추가해야 함).
- react-native-audio-api(Software Mansion): 이미 DECISIONS 11-17에서 '무겁다'는 이유로 제외됐다. 클립 이어 붙이기나 정밀 타이밍이 필요할 때만 다시 검토한다.
- expo-audio: expo 의존 문제로 이미 제외됐다(DECISIONS 11-17). 바꿀 이유가 없다.

## 6. 추천안

1. **이번 주 (A, S)**: 엔진은 Google 우선(없으면 기본), 보이스는 Enhanced·network 우선, 문장을 나눠 읽기, word 틀 수정(라이터), rate 0.85와 0.9 비교. QA-04 실기기에서 삼성 엔진과 Google 엔진을 귀로 비교한다.
2. **출시 전 또는 직후 (B, M~L)**: Google Cloud TTS **Chirp 3 HD** 한국어 보이스 2~3개와 **Gemini-TTS**(프롬프트 "따뜻하고 천천히") 샘플을 같은 문장 5개로 만들어 사용자가 들어 보고 고른다. 고른 보이스로 30일치 콘텐츠와 고정 문구를 생성하고, 하루치 오디오를 사진과 함께 받게 한다. 기기 TTS는 대체 수단으로만 남긴다.
3. 비교 후보로 하나를 더 듣는다면 **Azure `ko-KR-Haena:MAI-Voice-2`(softvoice)**나 ElevenLabs 유료가 있다. 다만 새 계정과 약관 검토 비용이 든다.

## 7. 사용자(오너) 결정 필요

1. **B안 착수 여부와 시점**(빌드 1 포함 vs 직후 업데이트). 서버 콘텐츠 행에 오디오 컬럼을 추가하고 스토리지를 쓰는 일이 함께 따라온다.
2. **유료 TTS 서비스 선택과 결제**: Google Cloud(기존 결제 계정, 예상 수 달러 이하)를 추천한다. 다른 서비스는 새 계정과 약관 검토가 필요하다.
3. **보이스 고르기**: 샘플 5문장 × 후보 4~6개를 듣고 1개를 고른다(남녀, 나이감).
4. **AI 음성 출처 표기**를 앱 정보에 넣을지(BGM 고지와 같은 방식).
5. (선택) 사람 성우: 지금은 비추천. 브랜드 목소리가 필요해지면 그때 다시 본다.

## 8. 미확인·후속 확인

- Google Cloud TTS 공식 가격 표 본문(페이지 본문 추출 실패): Chirp 3 HD 무료 한도, WaveNet·Neural2 단가
- Azure 공식 단가(공식 페이지 금액 비어 있음), CLOVA Voice Premium 단가와 앱 탑재 조건, Typecast·Supertone의 앱 탑재 재배포 허용 여부
- ElevenLabs v3가 Beta인지(Beta면 상용 금지)
- S25 실기기에서 `getEngines()`·`getAvailableVoices('ko')` 결과(엔진별 보이스 이름, Enhanced 여부)
