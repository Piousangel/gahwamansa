# 배경 음악(BGM) 결정안 (PM, 2026-11-17) — 사용자 결정 대기

## 1. 득실
- 얻는 것: "우리 집 앨범"을 넘기는 따뜻한 분위기, 매일 여는 의식감. 조용한 아침에 혼자 쓰는 어르신에겐 정서적 동반자.
- 잃는 것: ① **음성 읽어주기(TTS)와 겹침** — 이 앱의 핵심 접근성 기능(SPEC §3, 아직 미구현). 음악이 깔리면 말이 묻힘 ② **보청기**는 배경 소음과 말소리를 구분하기 어려워 음악이 안내를 가림(일반론, 출처 확인 전이라 가정) ③ 병원 대기실·버스 등 **공공장소에서 갑자기 소리** — 어르신은 끄는 법을 몰라 앱을 닫고 다시 안 열 위험 ④ 다른 앱(유튜브·라디오) 소리를 끊음 ⑤ 자녀 화면엔 이유 없음(빠르게 확인하고 나가는 화면).

## 2. 권고 형태
| 항목 | 권고 |
|---|---|
| 기본값 | **꺼짐**. 첫 코스 완료 화면(P7)에서 한 번만 "음악을 틀어 드릴까요? [들어 볼게요] [괜찮아요]" — 미리 듣기 후 선택 |
| 재생 위치 | **어르신 코스 홈(P3)과 완료 화면(P7)만**. 사진·고르기·한글 단계, 번호 입력·동의·설정·자녀 화면 전부 없음 |
| 볼륨 | 시스템 미디어 볼륨의 약 30%(가정, 실기기로 조정), 시작 2초 페이드 인 |
| TTS와 관계 | 읽어주기가 시작되면 음악을 멈추거나 10% 이하로 낮춤(Android 오디오 포커스 '덕킹') |
| 끄는 법 | 코스 홈 위쪽 "음악 끄기/켜기" 글자 버튼(아이콘만 쓰지 않음, 64 터치) + 설정 토글. 무음·진동 모드, 이어폰 뽑힘, 앱 백그라운드 → 즉시 정지 |
| 효과음 | BGM과 별개로 도장·완료 짧은 소리 2~3종은 기본 켜짐 권장(무음 모드 존중) |

## 3. 음원 확보 방법 비교 (라이선스 리스크를 확실/불확실로 구분)
| 방법 | 확실한 것 | 불확실한 것 | 비용·시간 |
|---|---|---|---|
| **A. AI 생성 (Google Lyria 3, Gemini API 키 보유)** | 결과물 소유권을 Google이 주장하지 않음("Google won't claim ownership", Gemini API 추가 약관, 2026-03-23 시행) · 18세 이상, 사업·전문 용도 대상 · 출력 MP3 44.1kHz 스테레오, 연주곡만 가능, 모든 출력에 **SynthID 워터마크**(들리지 않음) · Clip 모델 30초 고정(루프용), 3.5는 수 분 | **남이 비슷한 곡을 받을 수 있음**(약관: "same or similar content for others") · AI 생성물은 사람의 창작 기여 없으면 한국에서 저작권 등록 안 됨(저작권위원회 안내서, 2차 자료로 확인) → 남이 베껴도 막기 어려움 · 무료 등급은 입력·출력을 Google이 학습에 씀 · 가격은 공식 pricing 페이지 미확인 · 기존 곡과 닮았을 때의 면책(indemnity) 적용 여부 미확인 | 낮음, 반나절 |
| **B. 무료 라이선스 음원 (Pixabay)** | 상업 이용·무료·출처 표시 선택(라이선스 요약) · 금지: "Standalone" 판매·배포(창작적 가공 없이 파일 그대로), 소유권 주장(약관 2026-10-20 갱신) | **앱 안에 MP3를 그대로 넣는 것이 Standalone 배포인지 문구상 불명확**(APK에서 파일 추출 가능) · 업로더가 권리자가 아닐 위험은 사용자 책임 · 콘텐츠 ID 분쟁(우리 마케팅 영상에 쓰면 해당) |
| **B'. 공유마당(한국저작권위원회)** | 권리 처리된 저작물, 곡마다 CCL·공공누리 조건 | NC(비영리)·ND 표시 곡은 불가, 출처 표시 의무 곡별 확인 | 낮음 |
| **C. 작곡 의뢰(크몽 등)** | 계약서에 저작재산권 양도·앱 내 사용 범위를 명시하면 가장 깨끗 | 단가·기간(통상 수일~2주, 가정) — 빌드1 일정과 안 맞음 | 중간~높음 |

권고: **빌드1은 A(Lyria Clip, 연주곡 30초 루프 2곡: 코스 홈·완료)** — 우리 콘텐츠 사진도 이미 AI 생성이라 고지 체계가 같고, 일정 안에 끝남. 사용자가 유료 키로 생성(무료 등급의 학습 사용 회피), 프롬프트에 특정 가수·곡명 금지, 생성 결과·프롬프트·날짜를 docs/team/assets-manifest.md에 기록. 출시 후 반응이 좋으면 빌드2에서 C로 대표곡 교체.
작곡 의뢰 전까진 "우리만의 곡"이 아니라는 점을 받아들여야 한다.

## 4. 용량·구현
- 형식: OGG Vorbis 또는 AAC(m4a) 모노 64~96kbps → 30초 약 250~360KB, 2곡 1MB 이하(추정). 앱 안 res/raw 번들(첫 실행 오프라인에서도 재생). 다운로드형은 빌드2.
- 라이브러리 후보(의존성 최소 순): ① `react-native-sound` — 작고 단순, 루프·볼륨 지원, 유지보수 활발한지 미확인 ② `react-native-audio-api`(Software Mansion) — 활발, 포커스 처리 직접 필요 ③ `react-native-track-player` — 잠금화면·백그라운드용이라 과함, 제외. TTS 라이브러리(A1)와 오디오 포커스 충돌을 같이 검증해야 함 → 개발이 TTS와 묶어 1회 스파이크(2~3h, 가정).

## 5. 사용자 결정 질문
1. **빌드1에 BGM을 넣을까요?** (권고: 넣되 기본 꺼짐·코스 홈과 완료 화면만·첫 완료 때 한 번 권유) / 아니면 효과음만 넣고 BGM은 빌드2
2. 넣는다면 **음원은 Lyria로 직접 생성(권고, 유료 키로)** vs 무료 음원(Pixabay·공유마당) vs 작곡 의뢰(빌드2)?

출처: Gemini API 추가 약관 https://aistudio.google.com/docs/terms · Lyria 3 문서 https://aistudio.google.com/docs/music-generation.md.txt · Vertex Lyria(SynthID) https://docs.cloud.google.com/vertex-ai/generative-ai/docs/music/generate-music · 배포 권리 질의(미해결) https://discuss.ai.google.dev/t/can-music-generated-with-lyria-3-5-gemini-api-gemini-app-be-distributed-to-streaming-services-through-a-distributor-like-distrokid/191171 · Pixabay 약관 https://pixabay.com/service/terms/ · 요약 https://pixabay.com/service/license-summary/ · 공유마당 https://www.copyright.or.kr/business/gongu/index.do · AI 저작물 등록 안내(2차 자료) https://www.lawtimes.co.kr/news/articleViewAmp.html?idxno=209882
