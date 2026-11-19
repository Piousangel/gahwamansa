# r1 위원 ① 레퍼런스 리서처 A — 시니어·가족 연결 앱 (2026-11-19)

범위: 시니어 대상 앱, 가족 사진 공유, 회상 치료, 하루 한 질문·일일 리듬, 시니어 친화 인터페이스, 두뇌 게임(피할 것 위주). 33개 조사, 실재 확인 29개.
방법: 웹 검색(출처 URL 표기). 출처 대부분이 제조사 마케팅·제휴 리뷰라 사용성 주장은 "회사 주장" 수준. 어르신 실사용 검증은 0회. 시간·수치 추정은 "추정"으로 표시.
우리 화면 기준: app/src/features/course(CourseHome·PhotoStep·QuestionStep·KeyboardStep·CourseDone·CheerDialog), home(ChildHome·cheerLogic), link(RoleSelect·ConnectScreen), copy/copy.ko.json. 사진은 실제 가족 사진이 아니고 "AI가 만든 옛날 장면"이라는 점을 전제로 둔다(photo.zoom_a11y, child.app_info.ai_body).

## 1. 한 장 요약 — 레퍼런스가 우리에게 말하는 것
1. 잘 되는 가족 연결 제품은 **어르신 쪽 결정을 0에 가깝게, 준비는 가족이 대신** 한다(Komp, Nixplay, Aura). 우리 퍼널도 "자녀가 다 준비 → 부모님은 링크 한 번·버튼 하나"가 맞다.
2. 반응은 **한 탭 감정 신호**가 가장 많이 쓰인다(Aura "love", みてね 반응). 우리 응원(자녀→부모)은 있는데 **부모→자녀 한 탭 신호가 없다**. 경쟁력·독창성 1순위 후보.
3. **사진은 대화의 제3자**(CIRCA 연구). 우리 앱의 진짜 결과물은 "고른 답"이 아니라 "자녀가 그 사진으로 거는 전화 한 통"이다. 자녀 화면이 그 전화를 돕게 깎아야 한다.
4. **타이핑은 숙제가 된다**(Storyworth 독립 리뷰). P6 자판 쓰기는 가장 큰 이탈 위험 단계(추정). "넘어갈게요"를 동등한 출구로 유지.
5. 두뇌 게임·치매 앱이 쓰는 **점수·연속·위험도·효과 주장**은 그대로 피할 목록이다(Lumosity FTC 200만 달러 합의, Elevate Streak Freeze, 치매체크 위험도).

## 2. 레퍼런스 표

### 2-1. 가족 사진 공유·디지털 액자
| # | 앱 | 분류 | 무엇을 하는가 | 배울 것(UI·플로우 수준) | 피할 것 | URL |
|---|---|---|---|---|---|---|
| 1 | FamilyAlbum(みてね, Mitene) | 가족 사진 공유 | 부모가 올린 아이 사진을 초대 가족이 보고 댓글·반응. 앱 또는 계정 없는 브라우저 열람 가능 | ① 조부모는 **계정 없이 브라우저로도** 볼 수 있음 → 자녀 쪽 진입 장벽 낮추는 대체 경로 ② 계절마다 **1초 영상 자동 요약**(우리: 한 달 폴라로이드 묶음, 기기 안 생성) | "みたよ履歴"(누가 언제 봤는지 기록) — 우리 화면에 넣으면 부모 열람 감시가 됨 | https://help.family-album.com/hc/en-us/articles/360038267214-What-is-FamilyAlbum , https://help.family-album.com/hc/en-us/articles/360038259714 , https://appmatch.jp/935672069-3/ |
| 2 | Tinybeans | 가족 앨범 | 가족 일기·사진, 조부모에게 즉시/매일/매주 이메일 요약 | 받는 사람이 **빈도(즉시·매일·매주·끔)를 고름** → 자녀 알림 빈도 선택(응원 유도 푸시 과다 방지) | 한 리뷰: 이메일 끄기 토글 부족, 어르신이 이메일이 전부라 오해 | https://tinybeans.com/photo-sharing-app/ , https://apps.apple.com/us/app/-/id521633042 |
| 3 | Aura Frames | 디지털 액자 | 가족이 앱·문자로 사진 추가, 액자에서 **두 번 톡 또는 스와이프로 "love"**를 올린 사람에게 보냄 | ① **어르신 쪽 원탭 감정 신호 → 보낸 사람 앱에 알림**(부모→자녀 "잘 받았어요" 1탭) ② 2025-12 "Text to Frame": 앱 없이 문자로 보내기 | 신호를 "읽음 확인"처럼 쓰면 압박. 안 누른 상태를 자녀에게 표시 금지 | https://blog.bestbuy.ca/smart-home/aura-carver-smart-photo-frame-review , https://petapixel.com/2025/12/10/you-can-now-text-your-photos-to-aura-digital-picture-frames , https://techcrunch.com/2025/04/16/digital-frame-maker-aura-introduces-the-aspen-a-299-frame-with-more-intelligent-features/ |
| 4 | Nixplay | 디지털 액자 | 가족 계정 초대로 업로드, 이메일 업로드, Google Photos 동기화 | "**한 번 설정하면 다시 앱을 열 필요 없음**" — 어르신 쪽 설정은 첫날 한 번으로 끝내야 함 | 업로더마다 계정 필수, 재생목록 개념 등 설정 복잡, 구독 | https://shuttermuse.com/nixplay-smart-photo-frame-review , https://www.smarthomeperfected.com/digital-picture-frame-for-grandparents/ |
| 5 | Skylight Frame | 디지털 액자 | 액자마다 고유 이메일 주소, 이메일만 보내면 표시 | 보내는 쪽에 **설치 0** 경로 존재 → 자녀 초대 링크가 앱 없이도 "무엇을 하는 앱인지" 보여 주는 웹 미리보기 | 앱·캡션은 유료 구독 뒤에 숨김 | https://ca.skylightframe.com/frame , https://wetried.it/?p=2093 |
| 6 | Komp (No Isolation) | 원버튼 화면 | 버튼 하나(켜기·끄기·음량). 가족이 앱으로 사진·메시지 전송, 화면에 자동 순환. 영상통화는 10초 후 자동 연결 | ① **어르신 결정 0, 가족이 전부 준비** ② 사진이 "알아서 와 있음" — 앱을 열면 이미 오늘 사진이 크게 떠 있어야 함(P3 목록 대신 P4로 바로) | 어르신이 응답할 길이 없음(터치 없음, 수신만) — 단방향은 우리 목표와 다름 | https://abilitynet.org.uk/news-blogs/komp-one-button-computer-seniors-your-questions-answered , https://apps.apple.com/us/app/komp/id1317876340 |
| 7 | Famileo | 인쇄 가족 신문 | 가족이 앱에 올린 글·사진을 자동 편집해 큰 글씨 A4 신문으로 우편 발송(주·격주·월) | ① **가족 기여를 모아 한 번에 전달** 리듬 ② 편집을 자동화해 쓰는 사람 부담 0 | 유료 구독, 우편 물류. 31일 파기 정책과 장기 보관 충돌 | https://www.yorkshireeveningpost.co.uk/lifestyle/family-and-parenting/end-the-digital-divide-famileo-turns-your-familys-social-messages-into-a-printed-newsletter-for-grandparents-3942890 , https://honestmum.com/famileo-a-personalised-family-newspaper-and-app/ |
| 8 | Marco Polo | 비동기 영상 메신저 | 녹화 영상을 주고받는 "영상 무전기" | ① **같은 시간에 접속할 필요 없음** — 응원·답이 비동기라는 점을 문구로 안심시킴 ② 대화가 **사람별로 묶임**(받은 응원 다시 보기를 보낸 사람별로) | 과거 영상 전체 보기 유료화 | https://wtop.com/tech/2022/12/data-doctors-what-to-know-about-the-marco-polo-app , https://stories.marcopolo.me/2019/02/26/how-a-great-grandmother-stays-connected/ |

### 2-2. 질문·이야기 기록 / 일일 리듬
| # | 앱 | 분류 | 무엇을 하는가 | 배울 것 | 피할 것 | URL |
|---|---|---|---|---|---|---|
| 9 | Storyworth | 주 1회 질문 | 자녀가 선물 → 부모에게 주 1회 질문 이메일, 답장으로 답하면 가족에게 전달, 1년 뒤 책 | ① **로그인 없이 받은 메시지에 바로 답** ② 가족이 질문을 고르거나 직접 씀(빌드 2 F13 근거) ③ 놓친 주는 나중에 답 가능 — 부재 압박 없음 | 독립 리뷰: 매주 글 쓰기가 **숙제처럼 느껴져** 많은 사람이 책을 못 끝냄 → P6 자판 쓰기 부담 경고 | https://welcome.storyworth.com/faq , https://www.remento.co/journal/storyworth-faq-15-things-to-know-before-you-buy |
| 10 | Remento | 음성 이야기 기록 | 주 1회 질문을 문자·이메일로, 링크 → 녹음 페이지에서 큰 버튼 하나로 녹음, 자동 글 변환, 책(QR로 원음 재생) | ① 링크 → **큰 단일 버튼** 화면, 다운로드·로그인 0 ② 가족이 질문·**사진**을 추가하고 다음 질문에 투표 | 음성 데이터(우리 정책 F06 선행), AI 문장 다듬기(우리 AI 즉석 생성 기각과 충돌). 버튼 색이 마케팅(빨강)·도움말(초록) 불일치 = 미확인 | https://help.remento.co/en/articles/8865319-getting-started-as-a-storyteller , https://www.remento.co/journal/remento-faqs-can-older-people-actually-use-remento , https://help.remento.co/en/articles/8365903-does-a-remento-storyteller-have-to-be-tech-savvy |
| 11 | BeReal | 일일 리듬 SNS | 하루 한 번 무작위 알림, 2분 안에 촬영, 내 것을 올려야 친구 것이 보임 | **모두 같은 순간을 공유**한다는 감각 — "오늘 모든 집이 같은 사진을 받았어요"(사실이면) 같은 동시성 | 2분 압박, "late" 낙인(한 기자는 "수치의 표시"라 표현), 상호 공개 강제(우리: 응원은 답과 무관해야) | https://www.npr.org/2022/04/16/1092814566/bereal-app-gen-z-download , https://www.bothrs.com/story/dissecting-the-app-bereal |
| 12 | Wordle | 하루 하나 퍼즐 | 하루 한 문제, 전원 같은 문제, 내용 없는 공유 격자 | ① **하루 하나로 끝, 다음은 내일** — 과몰입 없음(우리 done.next_photo_time과 같은 방향) ② **내용을 숨긴 공유 카드**가 대화거리·전파 수단 | 결과 격자(시도 횟수)가 곧 성적 — 우리는 결과 공유 금지(F32 기각 유지) | https://www.smithsonianmag.com/smart-news/heres-why-the-word-game-wordle-went-viral-180979439/ , https://www.internetmatters.org/advice/apps-and-platforms/online-gaming/wordle/ |
| 13 | 오리함께 | 국내 가족 문답 | 한 질문에 가족이 각자 답·공유, 주기적 질문(iOS) | 가족 단위 질문 카드 형식 | 매일이 아닌 주기형이라 습관 고리가 약함(추정) | https://apps.apple.com/kr/app/%EC%98%A4%EB%A6%AC%ED%95%A8%EA%BB%98/id1663580958 |
| 14 | 앤서록 | 국내 1:1 문답 | 1:1로 연결된 상대와 2~3일마다 질문 답, 상대에게만 공개 | **1:1 공개 범위**를 첫 화면에서 분명히 — 우리 P13 "가족에게는 고른 답과 날짜만" 문구와 같은 축 | 한 번에 5문항 몰아주기 = 부담 | https://apps.apple.com/cm/app/%EC%95%A4%EC%84%9C%EB%A1%9D-%EA%B0%80%EC%A1%B1-%EC%86%8C%ED%86%B5-%EC%95%B1/id6448796716 |
| 15 | MindBridge | 국내 하루 한 질문 | 매일 마음 질문 한 장, 커플·가족·혼자 유형 | "한 장이 도착해요" — **카드가 온다**는 은유(우리 "내일 새 사진이 와요"와 일치) | 마음·감정 질문은 어르신에게 민감할 수 있음(추정) | https://apps.apple.com/kr/app/mindbridge-%EB%A7%88%EC%9D%B8%EB%93%9C%EB%B8%8C%EB%A6%BF%EC%A7%80-%EB%A7%88%EC%9D%8C-%EC%A7%88%EB%AC%B8-%EB%8B%A4%EC%9D%B4%EC%96%B4%EB%A6%AC/id6478144221 |

### 2-3. 회상(reminiscence) 치료·연구
| # | 앱 | 분류 | 무엇을 하는가 | 배울 것 | 피할 것 | URL |
|---|---|---|---|---|---|---|
| 16 | CIRCA | 회상 대화 보조(연구) | 터치스크린으로 사진·영상·음악을 보여 주며 치매 어르신과 돌봄자 대화 지원 | 연구: CIRCA 사용 시 어르신이 **대화를 먼저 꺼내고 더 동등한 상대**가 됨 → 사진은 "대화의 제3자". 자녀 화면 "이야기 꺼내기"를 사진과 함께 크게 | 치료 효과 수치(60% 개선)는 원 논문 미확인. 의료 효과 주장 금지 | https://research-portal.st-andrews.ac.uk/en/publications/using-a-touch-screen-computer-to-support-relationships-between-pe/ , https://researchportal.northumbria.ac.uk/en/publications/developing-circa-bc-and-exploring-the-role-of-the-computer-as-a-t/ |
| 17 | BBC RemArc | 회상 아카이브 | BBC 영상·소리·사진 1500여 건을 주제별로 회상 자료로 제공(2016, 오픈소스) | **사진만이 아니라 그 시절 소리**(라디오, 거리 소리)가 회상을 끌어냄 → P4 배경음을 장면별 효과음으로 | 현재 운영 여부 미확인 | https://learningonscreen.ac.uk/viewfinder/articles/bbc-remarc , https://app.dundee.ac.uk/news/2016/researchers-work-with-bbc-to-help-dementia-patients-enjoy-conversation.php |
| 18 | Book of You | 디지털 생애 책 | 사진·영상·글·음악으로 개인 생애 책 제작(Bangor대·Nesta 시범) | 함께 만드는 과정 자체가 연결 | 개인 생애 정보 대량 수집 — 우리 "개인정보 최소"와 정반대 | https://bangor.ac.uk/news/archive/helpful-app-for-people-with-dementia-22524 |
| 19 | Memory Lane Games | 사진 회상 퀴즈 | 옛 사진 기반 퀴즈, 보호자·가족과 함께 플레이 | "**함께 보며 웃는 것**"을 목표로 둠(회사 RCT: 보호자 83%가 웃었다고 응답, 회사 주장) | 정답이 있는 퀴즈 → 틀림·평가. 우리 P5는 "정답은 없어요" 유지 | https://apps.apple.com/us/app/id1517193093 , https://livingmadeeasy.org.uk/product/memory-lane-games |
| 20 | Replay: Sporting Memories | 스포츠 회상 | 스포츠 장면으로 회상 대화 유도 | 주제 묶음(시즌 풀 아이디어와 같은 방향) | 특정 관심사 가정 | https://apps.apple.com/us/app/-/id1559270545 |

### 2-4. 시니어 친화 인터페이스
| # | 앱·기기 | 분류 | 무엇을 하는가 | 배울 것 | 피할 것 | URL |
|---|---|---|---|---|---|---|
| 21 | GrandPad | 시니어 태블릿 | 큰 아이콘, 가족 원(Family Circle) 연락처만, 전용 뒤로 버튼, 75~100세 자문단 테스트 | ① **뒤로 버튼이 늘 같은 자리** ② 고령 자문단이 기능마다 시험 → 우리도 출시 전 어르신 3명 관찰(검증 0회 해소) | 화면이 "spartan", 월 구독 고가 | https://www.techradar.com/reviews/grandpad , https://www.laptopmag.com/reviews/grandpad |
| 22 | Lively Jitterbug Smart4 | 시니어 폰 | 아이콘 격자 대신 **글자 목록형 메뉴** | 85세 리뷰어가 목록형을 유용하다고 평가 → 우리 CourseHome 단계 행(글자 라벨 + 상태)은 맞는 방향, 아이콘만 쓰는 버튼 금지 | 전용 요금제 | https://ncoa.org/adviser/cell-phones/best-cell-phones-for-seniors , https://www.safewise.com/jitterbug-phone-review |
| 23 | Apple Assistive Access | OS 단순 모드 | 고대비 큰 버튼, 격자/행 레이아웃 선택, **화면당 선택지 줄이기** 권고(WWDC25) | 한 화면 선택지 수를 세어 줄이는 원칙 → P6 화면 버튼 수 점검 | iOS 전용(우리 Android 우선) | https://www.apple.com/accessibility/cognitive/ , https://nonstrict.eu/wwdcindex/wwdc2025/238/ |
| 24 | 갤럭시 쉬운 사용 모드 | OS 단순 모드 | 홈 화면을 크고 단순하게(설정 > 디스플레이) | 부모님 폰은 이 모드가 켜져 있을 가능성(추정) → **쉬운 모드 + 글자 최대**에서 S25 QA 1회 | 메뉴 경로가 모델마다 다름 | https://www.samsungsvc.co.kr/solution/23712 |
| 25 | 카카오톡 글자 크기 | 앱 내 글자 설정 | 앱 자체 글자 크기 설정(목록·채팅) | 어르신이 가장 익숙한 "큰 글씨" 기준점. 우리는 시스템 글자 따르기(F04 기각) 유지, 공유 메시지는 카톡 큰 글씨에서 줄바꿈 확인 | 2026년 별도 "큰 글씨 모드" 출시 여부 미확인 | https://extrememanual.net/46836 |
| 26 | 클로바 케어콜 | AI 안부 전화 | AI가 어르신에게 전화, 이전 통화 요약을 기억해 다음 대화에 이어감 | **"지난번 이야기"로 이어지는 연속성**이 만족을 높임(네이버 주장 만족 90%) → 어르신 본인 기록 안에서만 "어제는 이 사진을 보셨어요" 한 줄(기기 안, 추론 없음) | 건강·식사·수면 기록 = 민감·감시. 우리 개인화 회의의 추론 금지와 충돌 | https://www.navercorp.com/story/storyDetail?seq=33109 , https://zdnet.co.kr/view/?no=20230330173631 |
| 27 | ElliQ | 동반 로봇 | 먼저 말을 거는 제안형 AI, 가족용 Caregiver 앱 | 제안을 "적절한 때"에만 — 알림 시각을 부모님이 고름 | 가족이 건강·활동을 **자동 모니터링**하는 Caregiver Solution = 우리가 피할 감시 모델 | https://elliq.com/blogs/elliq-blog/proactive , https://www.therobotreport.com/intuition-robotics-tailors-elliq-to-help-the-aged-overcome-isolation/ |

### 2-5. 두뇌 게임·국내 치매 예방 앱 (주로 피할 것)
| # | 앱 | 분류 | 무엇을 하는가 | 배울 것 | 피할 것 | URL |
|---|---|---|---|---|---|---|
| 28 | Lumosity | 두뇌 훈련 | 게임형 인지 훈련 | 없음에 가까움 | 2016 FTC 기만 광고 200만 달러 합의(나이 관련 질환·실생활 효과 근거 없음). 스토어 문구에 "치매 예방·두뇌 건강" 금지 | https://www.ftc.gov/node/44800 , https://www.apa.org/monitor/2016/09/jn |
| 29 | Elevate | 두뇌 훈련 | 하루 3게임 워크아웃, Streak Freeze | **고정된 짧은 3단계**는 우리 코스와 같은 구조(익숙함 근거) | 연속 기록·Streak Freeze = 부재 압박 장치 | https://elevateapp.com/blog/how-to-build-daily-habits-that-keep-mind-sharp |
| 30 | Peak | 두뇌 훈련 | 3~5게임 약 10분, 연속 기록 | 오프라인에서도 끊기지 않음(우리: 오프라인 시 사진 캐시) | 점수·순위·연속 | https://nibble-app.com/blog/peak-app-review |
| 31 | 치매체크(보건복지부·중앙치매센터) | 공공 치매 앱 | 인지·우울 자가검사로 위험도, 3·3·3 수칙, 배회감지 | 공공 신뢰 문구 형식 | **위험도 검사·배회감지(위치)** 프레이밍 = 감시·불안. 앱스토어 평점 2.4(62건) | https://apps.apple.com/kr/app/id664587531 , https://www.korea.kr/multi/visualNewsView.do?newsId=148975344 |
| 32 | 실비아 | 국내 인지 훈련 | 기억·주의·시공간·언어·실행 5영역 훈련 | 큰 글씨·한 화면 한 과제 | 훈련 진도·영역 점수 | https://apps.apple.com/kr/app/id1604009305 |
| 33 | 두칭 / 두뇌톡톡 | 국내 두뇌 훈련 / 건강 일기 | 두칭: 7영역 훈련(유료). 두뇌톡톡: 실재, 단 두뇌 게임이 아니라 감정·식사·운동 일기(iPad, 개인 개발) | 두뇌톡톡: 하루 기록을 짧게 | 건강 기록 수집, 유료 훈련 | https://apps.apple.com/us/app/id6444273112 , https://apps.apple.com/us/app/id6745116786 |

참고: "기억친구"는 앱이 아니라 서울시 시민 치매 인식개선 프로젝트(2015~). 회상카드 제작 봉사가 있음 — 카드 한 장에 사진 하나·질문 하나 형식은 우리 P4·P5와 같은 축. https://mediahub.seoul.go.kr/archives/2003377

## 3. 우리 화면에서 바로 가져올 미시 패턴 상위 10

판단 기준: 원칙 위반 없음(칭찬·평가·연속·감시 X) · 퍼널(설치→하루 완료) 기여 · 독창성 · 비용(추정). 시간은 모두 추정.

| 순위 | 패턴 | 출처 레퍼런스 | 우리 화면·지금 상태 | 제안(버튼 단위 '왜') | 추정 |
|---|---|---|---|---|---|
| 1 | **부모→자녀 원탭 마음 신호** | Aura "love", みてね 반응 | 응원은 자녀→부모 일방(child.cheer.*). 부모가 응원을 받고 할 수 있는 행동 없음 | 응원 받은 화면(CheerDialog)에 "고마워요" 큰 버튼 1개 → 자녀에게 푸시 "엄마가 응원을 받았어요". 왜: 자녀 재방문 이유가 생기고 부모도 "주는 사람"이 됨. 자녀 화면에 "답장 없음" 상태 금지(F22 조건) | 6~8h |
| 2 | **앱을 열면 오늘 사진이 이미 크게** | Komp, Aura(사진이 알아서 와 있음) | 진입은 CourseHome(단계 목록 + 도장) → P4 | 첫 화면 상단을 오늘 사진 큰 썸네일로, 누르면 P4. 목록 행은 그 아래 보조. 왜: "할 일 목록"이 아니라 "선물 받은 사진"으로 시작해야 숙제감이 줄어듦 | 4~6h(디자인 동결 영향 확인 필요) |
| 3 | **단일 큰 주 버튼, 화면마다 같은 자리** | Remento 큰 버튼, GrandPad 고정 뒤로 | P4 "다 봤어요", P5 "정했어요", P6 "다 썼어요" 문구는 일관. 위치·크기 일관성은 미측정 | P4~P6 주 버튼을 하단 같은 좌표·같은 높이로 고정, 뒤로는 좌상단 고정. 왜: 어르신은 위치로 기억함(추정) | 2~3h |
| 4 | **타이핑 단계의 동등한 출구** | Storyworth "숙제" 비판 | P6에 keyboard.skip "오늘은 넘어갈게요", 한 글자만 써도 진행(need_one) — 이미 좋음 | "넘어갈게요"를 작은 링크가 아니라 주 버튼 옆 같은 무게의 버튼으로, 넘어가도 도장 동일(이미 그런지 확인). 왜: 자판이 어려운 날 앱 전체를 끊지 않게 | 1~2h |
| 5 | **자녀 화면에 그날 사진을 크게 + 이야기 꺼내기 한 줄** | CIRCA(사진=대화의 제3자) | C4에 고른 답 카드 + starter("이야기 꺼내기") | 답 카드 위에 **부모님이 본 그 사진**을 크게, 그 아래 starter와 "전화하기"(OS 다이얼러, 기록 안 함). 왜: 자녀가 같은 사진을 보며 통화 → 진짜 결과물 | 4~6h |
| 6 | **"내일 또 와요" 명확한 끝** | Wordle 하루 하나 | done.next_photo_time "내일 {시각}에 새 사진을 알려 드려요" — 이미 있음 | 유지. 추가로 P7에 내일 사진의 **흐린 뒷면 1장**(내용 비공개) 티저. 왜: 연속 숫자 없이 내일 기대만 만듦 | 2~3h |
| 7 | **알림 빈도·시각을 받는 사람이 고름** | Tinybeans 빈도 선택, ElliQ "적절한 때" | 부모 알림 시각 설정(NotifyRows) 있음. 자녀 쪽 "답이 생기면 알림" 빈도 선택 여부 미확인 | 자녀 설정에 "답 알림: 바로 / 저녁에 한 번". 왜: 바쁜 자녀의 알림 피로가 이탈 원인(추정) | 3~4h |
| 8 | **목록형 + 글자 라벨, 화면당 선택지 수 세기** | Jitterbug 목록, Assistive Access | CourseHome StepRow는 글자 라벨 목록(좋음). P6는 입력칸·완료·넘어가기·한 번 더 볼까요 시트(3버튼) | 화면별 탭 가능한 요소 수를 표로 세고 P6 시트(retry·finish_as_is·your_word)를 2선택지로 줄일 수 있는지 검토. 왜: 선택지 하나 줄 때마다 망설임 감소 | 1h(점검) |
| 9 | **그 시절 소리** | BBC RemArc | P4 BGM 토글(useCourseBgm) | 사진 칸마다 짧은 환경음(장터·빗소리 등) 선택적 재생, 기본은 BGM과 동일 규칙. 왜: 사진만보다 회상 단서가 많음. 독창성 후보 | 콘텐츠 제작 6~10h + 앱 2h |
| 10 | **계정 없는 미리보기 링크** | みてね 브라우저 열람, Skylight·Storyworth 설치 0 | 연결 링크 https://<도메인>/c#번호 → 앱/Play | 링크 웹 페이지에 "매일 이런 사진과 질문이 가요" 예시 1장(child.wait.example_* 재사용) + 설치 버튼. 왜: 카톡에서 링크를 연 부모님이 무엇을 설치하는지 먼저 봄 → 설치 전환 | 3~4h(도메인 결정 후) |

보류(정책 선행): **가족이 미리 녹음한 목소리로 질문 읽기**(Remento·Komp 계열). 독창성은 가장 크지만 음성 데이터·보관·제3자(자녀) 음성 처리 정책이 먼저(F06 정책 선행 결론과 같음). 녹음 없이 대안: 자녀가 고른 "호칭 + 한 줄 인사"를 TTS가 아니라 글로 P4 상단에 표시.

## 4. 첫 설치 → 하루 완료 퍼널에 주는 시사점
- 준비는 자녀가 대신(Komp·Nixplay). 부모님 첫 실행에서 결정은 "연결하기" 한 번이 상한(이미 ease-and-joy A안과 같은 방향).
- 링크 → 큰 버튼 하나(Remento), 로그인 0(Storyworth). 부모님 쪽 로그인 없음은 유지.
- 첫날 첫 화면은 사진부터(Komp). 목록·도장·설명은 첫날 뒤로 미룸.
- 각 단계 이탈 지점 이벤트(이미 퍼널 이벤트 계획 있음)에 P6 skip 비율을 넣어 "숙제감" 측정(내용 값 금지).

## 5. 피할 것 묶음 (레퍼런스에서 본 반례)
- 열람 기록 노출(みたよ履歴), 자동 모니터링(ElliQ Caregiver, 치매체크 배회감지)
- 연속·Streak Freeze(Elevate·Peak), 늦음 낙인(BeReal "late")
- 정답 퀴즈·점수(Memory Lane Games, 두뇌 훈련)
- 효과 주장("치매 예방", "두뇌 건강") — FTC 사례
- 매주 글쓰기 숙제(Storyworth 비판), 한 번에 여러 문항(앤서록 5문항)
- 개인 생애 정보 수집(Book of You), 건강·식사 기록(케어콜·두뇌톡톡)

## 6. 미확인 목록
- "새미" 치매 앱: 검색으로 실재 확인 못 함
- "오늘의 기억"류 국내 앱, "Grandparents" 앱(특정 제품명): 조사 못 함
- 카카오톡 2026년 별도 "큰 글씨 모드" 출시 여부(앱 내 글자 크기 설정만 확인)
- 갤럭시 쉬운 사용 모드의 길게 누르기 지연 설정 여부, One UI 8에서 메뉴 경로
- Remento 녹음 버튼 색·현재 화면(마케팅 빨강 vs 도움말 초록), 도움말 상세 페이지 404
- Komp 주요 기능 공식 페이지(404), "본 것" 피드백 기능 유무
- みてね 1초 영상의 무료/유료 범위, みたよ履歴의 공식 사양(일본 리뷰 사이트 출처뿐)
- CIRCA "60% 개선" 수치 원 논문, CIRCA·RemArc 현재 운영 여부
- Aura 최신 모델에서 멤버 열람 범위
- Hearth Display 사진 공유 방식
- Book of You 현재 운영 여부
- 클로바 케어콜 만족도·정확도 수치는 네이버 자체 발표(독립 검증 없음)
- 모든 시니어 사용성 주장: 대부분 제조사·제휴 리뷰, 독립 사용자 연구 아님
