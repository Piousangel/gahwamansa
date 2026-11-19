# 미리 생성 음성 (Google Cloud TTS Chirp 3 HD)

근거: DECISIONS 11-19 "미리 생성 음성 빌드 1에 넣음", UX 깊이 회의 SUMMARY (f)·r1/F.
'읽어 주세요'가 읽는 글은 모두 고정 문구다(콘텐츠 시드와 copy의 응원 4개). 그래서 개발자 PC에서 한 번 합성해 앱에 넣는다.

- 앱이 실행 중에 외부로 보내는 것은 없다.
- 합성할 때 Google로 가는 것은 고정 문구뿐이다. 사용자 데이터는 0이다.
- 파일이 없는 문장은 앱이 기기 TTS로 읽는다.

## 구성
| 파일 | 하는 일 |
|---|---|
| `lines.mjs` | 읽을 문장 목록을 만든다. 시드(14d·30d)의 사진 질문·낱말·고르기와 copy 응원을 앱과 **같은 함수**(`app/src/audio/readText.ts`)로 만들고 나눈다. 개인정보 검사도 한다(숫자 4자리 이상, @·주소, 틀 자리표시) |
| `synth.mjs` | `--dry-run`(숫자만 출력), `--samples`(보이스 고르기), `--voice`(전체 생성·설치) |
| `tts.test.mjs` | `node --no-warnings --test scripts/tts/tts.test.mjs` |

## 사용자가 실행할 순서 (샘플 만들기까지)
키 파일(JSON)은 만들지 않는다. 로그인은 브라우저로 사용자가 직접 하고, 토큰은 gcloud가 이 Mac 사용자 폴더에만 둔다. 스크립트는 그 토큰을 메모리에서만 쓰며 출력하지 않는다. 토큰이나 키를 저장소나 채팅에 붙이지 않는다.

1. **gcloud 설치**(이 Mac에는 아직 없음). 공식 문서는 https://cloud.google.com/sdk/docs/install 이다.
   - macOS 탭에서 Apple silicon(ARM64)용 압축 파일을 받는다.
   - 압축을 푼 뒤 `./google-cloud-sdk/install.sh`를 실행하고, 새 터미널을 연다.
   - `gcloud --version`이 나오면 설치된 것이다.
2. **로그인**(브라우저가 열리면 결제 계정이 있는 Google 계정으로 허용한다)
   ```sh
   gcloud auth login                                   # gcloud 명령용(3단계 API 켜기에 필요)
   gcloud config set project gahwa-mansaseong
   gcloud auth application-default login               # 스크립트용(애플리케이션 기본 사용자 인증 정보)
   gcloud auth application-default set-quota-project gahwa-mansaseong
   ```
3. **Text-to-Speech API 켜기**. 켜져 있는지 먼저 확인하고, 안 나오면 켠다. 결제는 기존 Blaze 결제 계정을 쓴다.
   ```sh
   gcloud services list --enabled --project gahwa-mansaseong | grep texttospeech
   gcloud services enable texttospeech.googleapis.com --project gahwa-mansaseong
   ```
4. **숫자 확인**(네트워크 없음)
   ```sh
   node --no-warnings scripts/tts/synth.mjs --dry-run
   node --no-warnings scripts/tts/synth.mjs --samples --dry-run
   ```
5. **샘플 만들기**: 보이스 6개 × 같은 글 3개 = 18파일이고 약 500자다(무료 한도 안).
   ```sh
   node --no-warnings scripts/tts/synth.mjs --samples
   open content/audio-raw/tts-samples/rate-1
   ```
   - 보이스 폴더마다 `1.mp3`(사진 질문), `2.mp3`(둘 중 고르기), `3.mp3`(낱말 "학교종. 한 글자씩, 학, 교, 종.")이 있다.
   - 기본 후보는 Kore·Aoede·Leda·Sulafat(여), Charon·Orus(남)다. 다른 보이스는 `--voices Achernar,Gacrux`로 고른다. 이름은 [공식 보이스 표](https://cloud.google.com/text-to-speech/docs/chirp3-hd)에 있다.
   - 조금 느린 쪽도 들어 보려면 `--samples --rate 0.9`를 실행한다. 결과는 `rate-0.9` 폴더에 생긴다.
   - 샘플 폴더(`content/audio-raw/`)는 커밋하지 않는다.
6. 사용자가 보이스 1개와 속도를 고른다.
7. **전체 생성·설치**(팀이 하거나 사용자가 한다)
   ```sh
   node --no-warnings scripts/tts/synth.mjs --voice Kore --rate 1.0
   ```
   - 원본은 `content/audio-raw/tts/<해시>.mp3`에 저장된다. 이미 있는 파일은 건너뛴다.
   - ffmpeg로 -16 LUFS·모노·48kbps로 맞춘다. ffmpeg가 없으면 원본을 그대로 쓴다.
   - 결과는 `app/src/assets/voice/`에 들어가고 `app/src/audio/voiceClips.generated.ts`가 갱신된다. 쓰지 않는 옛 파일은 지운다.
   - `content/audio-raw/tts/review.tsv`를 보며 **사람이 귀로 발음을 검수**한다. 옛 낱말은 합성 음성의 정답률이 낮다(Wolters 2007).
8. (선택) 끝나면 스크립트용 로그인을 지운다: `gcloud auth application-default revoke`

### 다시 만들기
- **문장 하나만 발음이 틀릴 때**: 그 문장의 원본(`review.tsv`의 file)을 지우고 7단계를 다시 실행한다. 없는 것만 만든다. 그래도 틀리면 라이터와 문장을 고친다(문장이 바뀌면 해시도 바뀐다).
- **문구나 시드가 바뀌었을 때**: 7단계를 다시 실행한다. 바뀐 문장만 새로 만들고 옛 파일은 지운다.
- **새 콘텐츠 날을 게시할 때**: `--batch <publish 묶음.json>`을 붙인다. 다만 번들 방식에서는 앱을 업데이트해야 들린다. 그 전까지는 기기 TTS로 읽는다. 아래 '저장 위치'를 본다.

## 파일 이름·형식·크기
- **이름**: `sha256("<보이스>\n<속도>\n<문장>")` 앞 16자리 + `.mp3`. 문장은 `readText.splitSentences`가 나눈 한 문장이다(공백을 하나로 줄임).
  - 앱은 문장 원문으로 찾는다. 생성 TS가 문장 → `require(파일)` 표라서 앱에는 해시 계산이 필요 없다.
  - 문장 하나라도 파일이 없으면 그 글 전체를 기기 TTS로 읽는다. 한 글 안에서 목소리가 섞이지 않게 하기 위해서다.
- **형식**: API는 MP3 24kHz로 받는다. 설치할 때 MP3 모노 48kbps, -16 LUFS로 바꾼다. Android 릴리스에서는 `res/raw/src_assets_voice_<해시>`로 들어간다(소문자·숫자라 자원 이름 규칙에 맞음).
- **크기**(`--dry-run`, 한국어 6.5자/초 추정):

| 범위 | 문장·글자 | 길이 | 크기 |
|---|---|---|---|
| 지금 시드 30일 + 응원 | 185문장 · 2,433자 | 약 6분 | **약 2.1MB** |
| 하루치 | 약 81자 | 약 12초 | 약 73KB |
| 1년치 | 약 3만 자 | 약 76분 | 약 26MB |

## 비용
공식 가격 페이지는 https://cloud.google.com/text-to-speech/pricing 이다(**2026-11-19 확인**).
- Chirp 3 HD는 **월 0~100만 자 무료**, 넘으면 **문자당 US$0.00003**(100만 자당 $30)이다.
- 공백과 줄바꿈도 글자 수에 들어간다.

| 작업 | 글자 | 무료 한도 안 | 한도를 넘었다면 |
|---|---|---|---|
| 샘플(6보이스 × 3글) | 492자 | $0 | $0.01 |
| 전체 30일 + 응원 1회 | 2,433자 | $0 | $0.07 |
| 보이스·속도 바꿔 5번 다시 | 약 1.2만 자 | $0 | $0.37 |
| 1년치 | 약 3만 자 | $0 | $0.89 |

같은 결제 계정의 다른 TTS 사용량과 무료 한도를 함께 쓰는지는 Cloud Console 결제 보고서로 확인한다.

## 저장 위치 결정안
- **빌드 1 = 앱 번들**(이번 PR이 구현한 방식).
  - 30일치 + 응원이 약 2MB라 앱 크기 영향이 작다.
  - 오프라인에서도 되고, 서버·마이그레이션·Storage 정책이 필요 없다.
  - 들은 파일 그대로 고정된다.
- **31일째 이후 = Supabase Storage**(후속).
  - 1년치를 번들에 넣으면 약 26MB라 맞지 않는다. 사진처럼 공개 버킷(예: `content-audio/<해시>.mp3`)에 올리고, 하루치(약 73KB)를 받게 한다.
  - 파일 이름이 이미 문장 해시라서 앱이 같은 규칙으로 sha256을 계산하거나, 콘텐츠 행에 파일 이름 컬럼을 두면 된다. 앞쪽이 의존성 0이다.
  - 받는 것은 공개 콘텐츠 파일이라 실행 중 사용자 데이터 전송은 여전히 0이다.
  - 붙이는 시점은 `publish-content.mjs`에 단계를 하나 더하는 때다.
- 앱 정보에는 미리 생성 음성이 하나라도 있을 때만 "읽어 주는 목소리는 AI가 만든 목소리예요. 사람이 읽은 게 아니에요"(`app_info.ai_voice`, 라이터 확정)가 보인다.
