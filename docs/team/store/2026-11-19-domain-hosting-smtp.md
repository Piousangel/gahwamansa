# 도메인·정적 호스팅·인증 메일(SMTP) 조사와 추천 (2026-11-19)

- 대상 결정: 로드맵 13 §5.2 Q-02(도메인·호스팅), Q-03(SMTP). DECISIONS 11-19: 구입·결제는 사용자, 조사·추천·설정 보조는 팀.
- 조사일: 2026-11-18. 가격은 결제 직전에 공식 화면에서 다시 확인한다(아래 "확인 등급" 참고).
- 확인 등급: **[공식]** 업체 공식 문서·가격표 원문 / **[실측]** 이 맥(한국 회선 1개)에서 직접 curl로 확인 / **[2차]** 비교 블로그·포럼 / **[미확인]** 찾지 못함.
- 환율은 **1 USD = 1,450원으로 가정**했다(추정치).

## 0. 결론 먼저

| 항목 | 1순위 | 연 비용(추정) | 핵심 이유 |
|---|---|---|---|
| 도메인 | **.com을 Cloudflare Registrar에서** | 약 US$11.2 ≈ **1.6만 원** (갱신가 같음) | 원가 판매라 첫해·갱신가가 같다. WHOIS 개인정보 가림이 무료·기본값. DNSSEC 지원. .kr은 Cloudflare에서 팔지 않고, 개인 등록자 실명이 WHOIS에 공개된다 |
| 정적 호스팅 | **GitHub Pages(사이트 전용 공개 저장소) + Cloudflare DNS(프록시 끔)** | **0원** | 한국에서 서울(ICN) 캐시로 응답 [실측]. `.json`을 `application/json`으로 줌 [실측]. KT 회선에서 Cloudflare 무료 프록시가 미국으로 돌아가는 사례가 반복 보고됨 [2차] |
| 인증 메일 | **Amazon SES 서울 리전(ap-northeast-2)** | 월 1,500~9,000통 기준 월 US$0.15~0.9 → 연 **약 2천~1.6만 원** | Supabase 공식 SMTP 목록에 있음. Supabase(서울)와 같은 서울 리전이라 **방침에 국외 이전 행을 추가하지 않아도 된다**. 계약 상대가 AWS Korea 유한회사. 가장 저렴하다 |
| 합계 | | **연 약 1.8만~3.2만 원** | |

대안: SES 샌드박스 해제가 거절되거나 늦으면 **Resend**(무료는 하루 100통, 넘으면 월 US$20, 데이터는 미국 저장이라 국외 이전 고지 필요). 국내 업체로만 처리하려면 **NHN Cloud Email**(통당 0.4~0.5원 [2차], SMTP 지원 [공식]).

한국 메일함(네이버·다음·카카오)에 잘 도착하는지는 **어느 업체도 공개 자료가 없었다**. 그래서 추천은 도달률 평판이 아니라 비용·데이터 위치·Supabase 지원 여부를 근거로 했다. 도달률은 §4.4 실수신 시험으로 확인한다.

---

## 1. 프로젝트 쪽 전제(읽은 것)

- `site/`: `index.html`(방침), `delete-account.html`, `c/index.html`(초대 안내), `style.css`, `.well-known/assetlinks.{production,staging}.json.template`, `drafts/`(방침 v2·약관 v1·삭제 v2 초안).
  - **주의: `drafts/`는 게시하면 안 된다.** 초안에 내부 메모(G 게이트, "불확실" 표시)가 들어 있다. 게시 대상에서 빼야 한다(§5 팀 단계).
- 앱 링크: `AndroidManifest.xml`의 intent-filter는 `https://${appLinkHost}` + `android:path="/c"`(정확히 일치), `autoVerify="true"`. 공유 링크는 `https://{APP_LINK_HOST}/c#123456`이라 번호가 URL 조각(#)에 있다. **조각은 서버로 전송되지 않으므로 호스팅 접속 기록에 초대 번호가 남지 않는다.**
- 공유는 RN `Share.share`(일반 텍스트)를 쓴다. 카카오 공유 SDK가 아니므로 카카오 디벨로퍼스에 웹 도메인을 등록할 필요가 없다.
- DECISIONS: App Links host는 env `APP_LINK_HOST`이고 없으면 비활성. staging은 별도 서브도메인을 쓴다. 패키지 `.staging`, assetlinks 템플릿이 나뉘어 있다.
- Auth: 이메일 OTP 6자리, 600초. 제목은 `[가화만사성] 인증번호`. `config.toml`의 `[auth.email.smtp]`는 주석 처리 상태이고 `rate_limit.email_sent = 60`이다.
- 원격 저장소는 아직 없다(REPO.md "열려 있는 것"). 비공개 모노레포를 권고하는 상태다.
- 발송량 가정: 하루 수십~수백 통이면 **월 약 1,500~9,000통**이다(재전송 포함 상한을 넉넉히 잡음).

## 2. A. 도메인

### 2.1 확장자 비교

| | .com | .app | .kr / .co.kr |
|---|---|---|---|
| Cloudflare 판매 | O [공식] | O(Google Registry) [공식] | **X**(지원 목록·최근 추가 목록에 없음) [공식] |
| 가격(Cloudflare, 원가) | 2026-11-01 Verisign 도매가 인상(US$10.26→10.97) 뒤 약 **US$11.17/년** [2차: 도매가 인상은 moneypress 인용, 판매가는 추정] | 첫해 US$8.20, **갱신 US$14.20** [2차: Porkbun 비교표, 2026-11-18 확인] | — |
| 가비아 가격 | 25,000원+부가세 = **27,500원/년**(등록·연장 같음, 2026-11-01부터) [공식] | — | 22,000원+부가세 = **24,200원/년** [공식]. 첫해 행사가 17,600원 [2차] |
| 앞으로 가격 | .com은 2030년까지 해마다 약 7% 오를 전망 [2차: Porkbun KB] | 레지스트리 정책 따름 | 업체 공지에 따름 |
| 등록 자격 | 제한 없음 | 제한 없음, **HTTPS 강제(HSTS preload)** | **신청인·등록인 모두 국내 주소 필요**, .co.kr은 개인 가능 [공식 KRNIC] |
| WHOIS 개인정보 | Cloudflare는 무료로 가림이 기본값 [공식] | 같음 | 개인 등록자는 **주소·전화만** 공개 여부를 고를 수 있다(관리세칙 제5조, 2026-09-30 시행본) [공식]. 이름은 공개 항목으로 본다(준칙 제25조) — 해석은 등록대행자에게 재확인 |
| DNSSEC | Cloudflare에서 켜기 가능 [공식] | 같음 | .kr 존은 서명됨 [2차: dns.ninja]. 가비아의 DS 등록 방법은 [미확인] |
| 이용자 인상 | 가장 익숙함 | 낯설 수 있음 | "한국 서비스" 느낌 |

판단:
- 이 앱 사용자는 주소를 직접 치지 않는다. 카톡으로 받은 링크를 누르거나 앱 안에서 방침을 연다. 그래서 .kr의 "한국 느낌" 이점은 작다.
- 개인 등록이라 **WHOIS에 실명이 공개되지 않는 쪽**(.com + Cloudflare)이 유리하다.
- .app은 첫해만 싸고 갱신가가 .com보다 비싸다.
- 사업자를 낸 뒤 .kr을 추가로 사서 .com으로 넘겨 주는 방식은 나중에도 할 수 있다(지금 필요 없음).

### 2.2 등록 업체 후보 3곳

| | Cloudflare Registrar | Porkbun | 가비아 |
|---|---|---|---|
| .com 연간(갱신) | 원가(레지스트리+ICANN, 마진 없음) [공식] 약 US$11.2 | US$11.08(인상 반영 전) [2차] | 27,500원 [공식] |
| .app 첫해/갱신 | $8.20 / $14.20 [2차] | $8.75 / $14.93 [2차] | — |
| .kr | 불가 | 지원 확인 못함 [미확인] | 가능 24,200원 [공식] |
| WHOIS 가림 | 무료·기본 [공식] | 무료 [2차] | .kr은 주소·전화만 선택 가능 |
| DNS | **Cloudflare 네임서버를 반드시 써야 함**(다른 NS를 쓰려면 이전해야 함) [공식] | 자유 | 자유 |
| DNSSEC | 지원 [공식] | 지원 [2차] | .kr 지원 여부·방법 [미확인] |
| 메일 받기(포워딩) | Cloudflare Email Routing 무료로 `privacy@도메인` → 개인 Gmail 전달 가능 | 무료 포워딩 [2차] | 유료 메일 상품 위주 [미확인] |
| 결제 | 해외결제 카드·PayPal(계정 기본 결제수단 사용) [공식] | 해외결제 카드 | 국내 카드·계좌이체 |
| 한국어 | 검색 화면 한국어 있음, 지원은 영어 | 영어 | 한국어 |

→ **1순위 Cloudflare Registrar(.com)**. 단점은 DNS가 Cloudflare에 묶인다는 것이다. 하지만 DNS만 쓰고 프록시(주황 구름)를 끄면 §3.3의 KT 경로 문제와 무관하다.

## 3. B. 정적 호스팅

### 3.1 비교표

| | GitHub Pages | Cloudflare Pages | Netlify | Vercel |
|---|---|---|---|---|
| 무료 한도 | 사이트 1GB, 대역폭 월 100GB(소프트), 빌드 시간당 10회(Actions 배포는 예외) [공식] | 빌드 월 500회, 파일 2만 개, 파일당 25MiB, 정적 대역폭 제한 명시 없음 [공식] | **크레딧 월 300**: 배포 1회 15, 대역폭 1GB당 20 [공식] | 전송 100GB/월 [공식] |
| 상업적 사용 | "온라인 사업용 무료 호스팅" 금지(결제·상업 SaaS 대상). 방침·안내 페이지는 해당 없다고 판단 [공식+판단] | 허용 | 허용 [미확인 명시] | Hobby는 개인·비상업용(유료 기능 예정이면 회색 지대) [2차, 공식 Hobby 문서에 명시 문구 못 찾음] |
| 커스텀 도메인 HTTPS | 무료(Let's Encrypt), 저장소당 사이트 1개 [공식] | 무료, 프로젝트당 도메인 100개 [공식] | 무료 [공식] | 무료 |
| `/.well-known/assetlinks.json` | Jekyll이 점(.) 폴더를 빼므로 **`.nojekyll` 필요**(또는 Actions 배포) [공식 블로그]. `.well-known` 파일 200 응답 확인 [실측] | 그대로 제공. `_headers`로 Content-Type 지정 가능 [공식] | `_headers` 지원 | `vercel.json` headers |
| `.json` Content-Type | `application/json; charset=utf-8` [실측: pages.github.com/versions.json] | 기본 application/json, `_headers`로 고정 가능 | 같음 | 같음 |
| 리다이렉트 없이 제공 | O(파일 경로 그대로) | O(단, `.html`은 확장자 없는 주소로 308 리다이렉트하는 "pretty URL" 동작이 있음 — json은 무관) | O | O |
| 한국 응답 [실측, 이 맥 회선 1개] | Fastly **ICN(서울)** 캐시, TTFB 0.028s | ICN, TTFB 0.05~0.19s | aws-icn, 0.033s | icn1, 0.077s |
| 접속 기록(개인정보) | "방문자 IP를 보안 목적으로 기록·저장" [공식]. GitHub은 미국 등 여러 나라에서 처리 [공식] | Cloudflare가 IP를 처리(전 세계 PoP) | 미국 | 미국 |
| staging 분리 | 저장소 1개 = 사이트 1개 → **staging용 두 번째 저장소** | 프로젝트 2개, 또는 브랜치별 도메인 | 사이트 2개 | 프로젝트 2개 |
| 비공개 저장소 | 무료 플랜은 공개 저장소만 Pages 가능(비공개는 유료 플랜) [2차, 일반적으로 알려진 내용] | 저장소 없이 `wrangler` 직접 업로드 가능 | 가능 | 가능 |

### 3.2 assetlinks 요건(공식 원문)
Android 문서 기준 [공식]:
- `https://도메인/.well-known/assetlinks.json` 위치에 둔다.
- content-type은 `application/json`이다.
- HTTPS로 제공한다.
- **301·302 리다이렉트가 없어야 한다.**
- 앱 링크 호스트마다 각각 둔다.
- Android 15+는 백그라운드 재검증이 있어 변경이 퍼지는 데 최대 7일이 걸린다.

→ staging 서브도메인에는 staging 템플릿(`.staging` 패키지)을, 본 도메인에는 production 템플릿을 따로 둔다. 지금 구조가 이 요건과 맞다.

### 3.3 한국 접속: Cloudflare 무료 프록시의 KT 문제
- Cloudflare 커뮤니티에 **KT(AS4766) 이용자가 무료 플랜 사이트에 접속할 때 SEA·LAX·DFW·런던으로 돌아 약 900ms+패킷 손실**이 났다는 글이 2025~2026년에 여러 번 올라왔다. SKB·LGU+는 35~40ms로 정상이었다고 한다 [2차, 포럼]. Cloudflare 공식 해결 발표는 못 찾았다.
- `/c` 페이지는 카톡에서 링크를 누른 어르신 폰이 여는 첫 화면이다. KT 이용자 비중이 크므로 이 위험은 피하는 것이 맞다.
- GitHub Pages는 Fastly 서울 PoP에서 응답했다 [실측]. 단 **회선 1개 측정**이므로 출시 전 KT·SKT·LGU+ 모바일에서 각 1회 확인한다(QA).

### 3.4 추천
**1순위: GitHub Pages + 사이트 전용 공개 저장소 2개(production, staging) + Cloudflare DNS(DNS only).**
- 이유: 무료이고, 서울 응답 [실측], JSON 타입·.well-known 확인 [실측], KT 프록시 경로 위험이 없다.
- 공개 저장소여도 게시 내용은 원래 공개 페이지이므로 문제없다. 모노레포는 비공개로 둔다(REPO.md의 "site/를 별도 호스팅에 올릴 때" 분리 신호에 해당).
- 단점: 방문자 IP를 GitHub(미국 등)이 보안 목적으로 기록한다 → 방침에 한 줄 적는다(§6). 저장소가 2개 필요하다.

**2순위: Cloudflare Pages(프로젝트 2개, wrangler 직접 업로드).** 공개 저장소가 싫거나 헤더를 세밀하게 다뤄야 할 때 쓴다. KT 경로 문제를 감수해야 한다.

Netlify(크레딧제로 바뀌어 한도 예측이 어려움)와 Vercel(Hobby 비상업 조건)은 제외한다.

## 4. C. 트랜잭션 메일(SMTP)

### 4.1 비교표

| | **Amazon SES(서울)** | Resend | Postmark | SendGrid | Brevo | NHN Cloud Email | 네이버 클라우드 |
|---|---|---|---|---|---|---|---|
| Supabase 공식 문서 목록 | **O** [공식] | O(공식 연동도 있음) | O | O | O | X(일반 SMTP로 가능) | X |
| SMTP | `email-smtp.ap-northeast-2.amazonaws.com` 587/465, TLS 필수, 리전별 자격 증명 [공식] | `smtp.resend.com` 465, 사용자 `resend`, 비번=API 키 [공식] | O | O | O | `smtp-mail.nhncloudservice.com` 587/465, 사용자=AppKey(`AppKey#auth`로 인증 메일 구분), 비번=SecretKey [공식] | SENS 메일은 REST API 위주, SMTP는 [미확인] |
| 무료 | 신규 AWS 고객 크레딧 최대 US$200(6개월 플랜) [공식] | **월 3,000통, 하루 100통**, 도메인 3개 [공식] | 월 100통 [공식] | **영구 무료 없음**(2025 폐지, 60일 체험) [2차] | 하루 300통 [2차] | [미확인] | 무료 구간 있음 [공식, 양 미확인] |
| 유료 | **1,000통당 US$0.10** [공식] | Pro 월 $20(5만 통), 하루 제한 없음 [공식] | 월 $15(1만 통) [공식] | Essentials 월 $19.95 [2차] | Starter 월 $9 [2차] | **통당 0.4~0.5원** [2차: 판매 대행 요금표] | [미확인] |
| 우리 규모(월 1.5천~9천) 월 비용 | **$0.15~0.90** | 하루 100 이하면 0, 넘으면 $20 | $15 | $19.95 | 하루 300 이하면 0 | 약 750~4,500원 | — |
| 데이터 위치 | **서울 리전**(AWS는 고객이 고른 리전에 콘텐츠 저장) | 발송 리전은 도쿄 선택 가능, **계정·로그는 모두 미국 저장** [공식] | 미국 [미확인 상세] | 미국 | EU [2차] | 국내 | 국내 |
| 계약 상대(한국 계정) | **Amazon Web Services Korea 유한회사**(강남구 테헤란로 231) [공식] | Resend, Inc.(미국) | ActiveCampaign(미국) | Twilio(미국) | Brevo(프랑스) | NHN Cloud(한국) | 네이버클라우드(한국) |
| SPF·DKIM·DMARC | SPF(MAIL FROM 서브도메인)·Easy DKIM·DMARC [공식] | 모두 [공식] | 모두 | 모두 | 모두 | 모두 [공식] | 모두, DKIM 2048비트 [공식] |
| 처음 쓸 때 장벽 | **샌드박스 해제 신청**(웹사이트 URL 필요, 첫 답변 96시간 이내, 추가 질문이 오면 더 걸림) [공식] | 도메인 인증 후 바로 | 계정 승인 | 결제 | 계정 승인 [2차] | 가입·프로젝트 생성 | 가입 |
| 한국어 | 콘솔 한국어, 지원은 유료 플랜 | 영어 | 영어 | 영어 | 일부 | **한국어** | **한국어** |

### 4.2 한국 메일함 도달률 — 정직한 결론
- 네이버·다음·카카오메일에 업체별로 얼마나 잘 도착하는지 비교한 **공식·공개 자료는 없다**. 검색한 후기도 일반론뿐이었다.
- 확실한 것은 인증 요건이다.
  - Gmail은 2024-02부터 인증 없는 메일을 거부하거나 스팸으로 보낸다. 하루 5,000통 이상 대량 발신자는 SPF·DKIM·DMARC가 모두 필요하다 [공식: Google 발신자 가이드라인, NCP·NHN 문서].
  - 네이버 클라우드는 Gmail로 보낼 때 세 인증이 모두 없으면 자체적으로 실패 처리한다 [공식].
- → 어느 업체를 고르든 **SPF·DKIM·DMARC 세 가지를 모두 설정**하고, §4.4의 실수신 시험으로 판단한다.

### 4.3 추천과 이유
**1순위: Amazon SES 서울.**
1. Supabase 공식 지원 목록에 있다.
2. Supabase production(서울)과 같은 리전이고 계약 상대가 AWS Korea다. 방침 6절에 **국외 이전 행을 추가하지 않고 위탁 1행만** 더하면 된다(법률 확인 표시 유지).
3. 우리 규모에서 비용이 사실상 0이다(연 1.6만 원 이하).
4. 하루 한도 걱정이 없다(해제 후 기본 한도는 계정마다 다름).

- 위험: 샌드박스 해제가 거절되거나 늦어질 수 있다. 신청서에 웹사이트 URL이 필요하므로 **도메인·방침 페이지가 먼저 떠 있어야 한다**.
- 대응: 해제가 G-CLOSED 1주 전까지 안 되면 Resend로 바꾼다(설정 15분, 방침에 국외 이전 1행 추가).

**대안 A: Resend.** 설정이 가장 쉽다. 하루 100통 이하면 무료다. 데이터가 미국에 저장되므로 국외 이전 고지가 필요하다. 하루 100통을 넘는 날이 생기면 월 $20이다.

**대안 B: NHN Cloud Email.** 국내 회사·국내 처리에 한국어 지원이 된다. 통당 0.5원이라 연 1~5만 원이다. Supabase 문서 목록에 없어 연동 사례가 적다. 개인 가입 가능 여부·최소 과금은 [미확인]이다.

제외: SendGrid(무료 폐지, 비쌈), Postmark(평판은 좋지만 월 $15에 미국 저장), Brevo(무료 승인 절차와 EU 이전), 네이버 클라우드(SMTP 미확인).

### 4.4 출시 전 실수신 시험(팀, 30분)
staging에서 이메일 OTP를 각 2회씩 요청해 다음을 기록한다.
- 대상: 네이버·다음(한메일)·카카오메일·Gmail·iCloud(가능하면).
- 기록: 받은편지함/스팸함 여부, 도착 시간(초), Gmail "원본 보기"의 `spf=pass dkim=pass dmarc=pass`.
- 판단: 한 곳이라도 스팸함에 들어가면 → DMARC 정책·발신 주소·본문(링크 없음 확인)을 점검한 뒤 다시 시험한다. 그래도 같으면 대안 업체로 바꾼다.

## 5. 할 일 나누기

### 5.1 사용자(결제·계정·DNS 클릭)
1. **도메인 이름 고르기**: Cloudflare 대시보드 > Domain Registration > Register에서 .com 후보 2~3개의 가능 여부를 본다(KIPRIS 상표 결과 Q-08과 같이 본다).
2. **Cloudflare 가입 + 해외결제 카드 등록 → 구입**(1년, 자동 갱신 켬). WHOIS 가림이 켜져 있는지 확인한다.
3. **GitHub 계정에서 공개 저장소 2개 만들기**(예: `<이름>-site`, `<이름>-site-staging`). 팀이 넣을 내용을 푸시할 권한을 준다(또는 팀이 준비한 명령을 사용자가 실행).
4. **Cloudflare DNS 레코드 입력**(팀이 표로 줌, 모두 "DNS only" 회색 구름):
   - 루트: GitHub Pages A 4개 + AAAA 4개(또는 `www` CNAME)
   - `staging`: CNAME → `<계정>.github.io`
   - SES용: DKIM CNAME 3개, MAIL FROM 서브도메인 MX·TXT(SPF), `_dmarc` TXT
   - (선택) Email Routing: `privacy@` → 개인 Gmail
5. **DNSSEC 켜기**(Cloudflare DNS > Settings, 원클릭).
6. **AWS 가입(계정 국가 한국) → SES 서울 리전 → 도메인 인증 → "Request production access"**(Transactional, 웹사이트 URL=방침 주소). 96시간 안에 첫 답변이 온다.
7. SES에서 **SMTP 자격 증명 생성** → Supabase production 대시보드 Auth > SMTP에 입력한다(비번은 사용자만 보관). staging도 같은 방식으로 하거나 같은 자격 증명을 쓴다.
8. Play Console 앱 서명 SHA-256을 팀에 전달한다(assetlinks에 넣을 값).

### 5.2 팀(문서·설정 초안·검증)
1. 게시용 산출물 정리: `site/`에서 **`drafts/` 제외**, 템플릿 → `assetlinks.json` 생성(환경별), `.nojekyll` 추가, `CNAME` 파일, 루트 `index.html`·`delete-account.html`·`c/index.html`을 넣는다.
2. 배포 절차서: `git subtree split` 또는 복사 스크립트 → 각 공개 저장소 푸시, Pages 설정(Enforce HTTPS)을 적는다.
3. 검증 명령:
   - `curl -sI https://<도메인>/.well-known/assetlinks.json` → 200·`application/json`·리다이렉트 없음
   - Google Digital Asset Links API 확인
   - 실기기 `adb shell pm get-app-links` → `verified`
4. **링크 경로 주의**: 매니페스트는 `path="/c"` 정확 일치다. 공유 링크를 `/c/`로 바꾸면 앱이 안 열린다. 브라우저 쪽 `/c` → `/c/` 301은 무해하다(조각 유지).
5. `app/env/{staging,production}.env`의 `APP_LINK_HOST` 값 반영 PR(도메인 확정 후).
6. Supabase SMTP 값 표(host·port 587·user·sender name "가화만사성"·발신 주소 `no-reply@auth.<도메인>` 권장 — Supabase 문서는 인증 메일을 별도 서브도메인으로 보내라고 권함 [공식]).
7. Supabase Auth Rate Limits: 커스텀 SMTP를 저장하면 기본 **시간당 30통**이다 [공식]. 하루 수백 통·몰림에 맞춰 시간당 100~200으로 조정할지 판단한다(SV-14 체크리스트에 추가).
8. §4.4 실수신 시험, 3개 통신사 모바일로 `/c` 열기 시험(QA).
9. 방침 6절 반영(아래 §6, 법률 검토 표시 유지).

## 6. 개인정보 처리방침 문구 초안(6절에 추가, 법률 확인 전 게시 금지)

**처리 위탁 표에 추가(1순위 SES 기준)**

| 맡는 곳 | 맡기는 일 | 처리 위치 |
|---|---|---|
| Amazon Web Services Korea 유한회사 — Amazon SES | 로그인 인증번호 메일 보내기 | 대한민국 서울(AWS 서울 리전) |

> 인증번호 메일을 보내려고 이메일 주소와 메일 내용(인증번호)을 Amazon Web Services Korea 유한회사에 맡깁니다. 메일 발송 기록(받는 주소, 보낸 시각, 전달 결과)은 서울 리전에 남으며, <span class="todo">[운영자 입력 필요: SES 발송 기록 보관 기간 확인 후 기재]</span> 뒤 지워집니다.

**정적 안내 페이지(호스팅) — 접속 기록 한 줄(1순위 GitHub Pages 기준)**

> 이 안내 페이지(개인정보 처리방침, 계정 삭제 안내, 초대 안내)는 GitHub, Inc.(미국)의 GitHub Pages에 올려 두었습니다. 페이지를 열면 GitHub가 보안을 위해 방문자의 IP 주소를 기록합니다. 초대 번호는 주소의 '#' 뒤에 있어 GitHub로 보내지지 않습니다.

<span class="check">불확실: GitHub Pages 접속 IP 기록을 운영자의 '처리 위탁·국외 이전'으로 볼지, 호스팅 업체 자체 처리로 볼지 법률 확인 필요. 국외 이전으로 본다면 아래 상세 표 행을 추가한다.</span>

| 받는 곳(연락처) | 나라 | 항목 | 방법·시기 | 목적·보유 기간 |
|---|---|---|---|---|
| GitHub, Inc.(88 Colin P Kelly Jr St, San Francisco, CA, USA · <span class="todo">[운영자 입력 필요: 개인정보 문의처]</span>) | 미국 등 GitHub 처리 국가 | 안내 페이지 방문자의 IP 주소 | 페이지를 열 때 인터넷으로 보냄 | 보안 / GitHub 기준 |

**대안 A(Resend)를 쓰게 되면 국외 이전 상세 표에 추가**

| 받는 곳(연락처) | 나라 | 항목 | 방법·시기 | 목적·보유 기간 |
|---|---|---|---|---|
| Resend, Inc. <span class="todo">[운영자 입력 필요: 주소·개인정보 문의 메일]</span> | 미국(계정·발송 기록 저장), 일본(발송 서버, 도쿄 리전 선택 시) | 이메일 주소, 인증번호 메일 내용, 발송 기록 | 인증번호를 요청할 때마다 인터넷으로 보냄 | 인증번호 메일 보내기 / 발송 기록 30일(무료 플랜 보관 기간) |

## 7. 비용 요약(연)

| 항목 | 1순위 | 최소 | 최대(가정 상한) |
|---|---|---|---|
| 도메인 .com(Cloudflare) | US$11.2 | 약 16,000원 | 약 16,000원(해마다 약 7% 인상 가능) |
| 호스팅(GitHub Pages ×2) | 0 | 0 | 0 |
| SES 서울 | $0.10/1천 통 | 월 1,500통 → 연 약 2,600원 | 월 9,000통 → 연 약 15,700원 |
| **합계** | | **약 1.9만 원** | **약 3.2만 원** |
| 참고: 대안 Resend 유료 | | | 연 $240 ≈ 35만 원 |
| 참고: 가비아 .kr | | | 연 24,200원 |

## 8. 남은 확인(결제 전)
- [ ] Cloudflare 결제 화면의 .com 실제 금액(인상 반영가)
- [ ] SES 발송 기록 보관 기간(방침 자리표시)
- [ ] NHN Cloud 개인 가입·최소 과금(대안 B를 고려할 때만)
- [ ] 3개 통신사 모바일 `/c` 응답(QA)
- [ ] .kr 이름 공개 범위 해석(.kr을 고를 때만, 등록대행자 문의)

## 출처
도메인
- Cloudflare TLD 지원 목록: https://www.cloudflare.com/tld-policies/
- Cloudflare Registrar FAQ(원가 판매·네임서버 필수): https://developers.cloudflare.com/registrar/faq/
- Cloudflare WHOIS 가림: https://developers.cloudflare.com/registrar/account-options/whois-redaction/
- Porkbun .app 가격 비교(Cloudflare 포함, 2026-11-18): https://porkbun.com/about/domain-cost-calculator/app.txt
- Porkbun .com 인상 전망: https://kb.porkbun.com/article/201-why-did-com-prices-go-up-and-how-high-will-they-go
- .com 도매가 인상·업체별 가격(2026-10): https://moneypress.kr/com-domain-price-comparison/
- 가비아 가격 인상 공지(2026-11-01): https://www.gabia.com/gabia_notice/view.php?seq_no=45623
- KRNIC .kr 등록 자격: https://krnic.or.kr/jsp/resources/domainInfo/krDomainInfo.jsp
- KRNIC 도메인 관리세칙(제5조 공개 여부 선택): https://krnic.kisa.or.kr/jsp/infoboard/law/domBylawsReg.jsp
- .kr DNSSEC 상태: https://dns.ninja/en/dns-lookup/kr

호스팅
- GitHub Pages 한도·금지 용도: https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits
- GitHub Pages 소개(방문자 IP 기록): https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages
- GitHub 개인정보 처리방침: https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement
- Jekyll 우회(.nojekyll): https://github.blog/news-insights/the-library/bypassing-jekyll-on-github-pages/
- Cloudflare Pages 한도: https://developers.cloudflare.com/pages/platform/limits/
- Cloudflare Pages `_headers`: https://developers.cloudflare.com/pages/configuration/headers/
- Cloudflare Workers 정적 자산 이전 안내: https://developers.cloudflare.com/workers/static-assets/migrate-from-pages/
- KT 경로 문제(포럼): https://community.cloudflare.com/t/south-korea-kt-as4766-our-zones-ips-104-26-x-172-67-x-route-to-sea-lax-wh/980196 , https://community.cloudflare.com/t/high-latency-from-korea-telecom-dinocue-com-served-from-london-and-amsterdam/968346 , https://community.cloudflare.com/t/south-korea-mobile-traffic-via-dfw-lax-high-latency-and-routing-review/978613
- Netlify 가격: https://www.netlify.com/pricing/
- Vercel Hobby: https://vercel.com/docs/plans/hobby , 공정 사용: https://vercel.com/docs/limits/fair-use-guidelines
- Android assetlinks 게시 요건: https://developer.android.com/training/app-links/configure-assetlinks
- Android 앱 링크 검증: https://developer.android.com/training/app-links/verify-android-applinks
- 실측(2026-11-18, 이 맥): `curl -sI https://pages.github.com/versions.json`(application/json, cache-icn), `curl -w` 응답 시간 4개 업체

메일
- Supabase 커스텀 SMTP: https://supabase.com/docs/guides/auth/auth-smtp
- Resend 가격: https://resend.com/pricing , 리전·데이터 저장: https://resend.com/docs/dashboard/domains/regions , Supabase 연동: https://resend.com/docs/send-with-supabase-smtp
- Amazon SES 가격: https://aws.amazon.com/ses/pricing/
- SES 엔드포인트(서울 SMTP): https://docs.aws.amazon.com/general/latest/gr/ses.html
- SES 샌드박스 해제: https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html
- AWS 계약 당사자(한국=AWS Korea): https://aws.amazon.com/legal/aws-contracting-party/
- AWS 데이터 프라이버시 FAQ(리전 저장): https://aws.amazon.com/compliance/data-privacy-faq/
- Postmark 가격: https://postmarkapp.com/pricing
- SendGrid 무료 폐지(2차): https://dreamlit.ai/blog/best-sendgrid-alternatives
- Brevo 무료 한도(2차): https://dreamlit.ai/blog/brevo-review
- NHN Cloud Email 개요: https://docs.nhncloud.com/en/Notification/Email/en/Overview/ , SMTP 가이드: https://docs.nhncloud.com/ko/Notification/Email/ko/smtp-guide/ , 요금(판매 대행, 2차): https://www.hostcenter.co.kr/Solution/Notification
- 네이버 클라우드 메일 문제 해결(Gmail 3종 인증 필수): https://guide.ncloud-docs.com/docs/sens-troubleshoot-mail
- Google 발신자 가이드라인: https://support.google.com/a/answer/81126
