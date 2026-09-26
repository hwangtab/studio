# AEO·GEO 전략 — AI 추천의 입구별 설계 (2026-09-26)

> **방법**: `seo-preflight` → 저장소 AEO/GEO 구현 전수 감사(llms·robots·JSON-LD·측정·git 이력) → 웹 리서치 5갈래
> (ChatGPT·Copilot·Perplexity·Claude / Google AIO·AI Mode·Gemini / 웹 표준 / 실증 연구·측정 / 한국 시장)
> → 판단을 좌우하는 주장은 원문을 다시 열어 교차 확인 → 프로덕션·외부 플랫폼 실측(robots 응답, 카카오맵 검색,
> Wikidata API, Vercel 런타임 로그, kosmart 리다이렉트).
> **선행 문서**: `docs/proposals/seo-geo-aeo-inquiry-growth-2026-09-04.md`(온사이트 완료·병목은 사이트 밖),
> `docs/geo-visibility/README.md`(월간 인용 측정), `docs/p3-external-channels-runbook.md`(네이버 AI 봇 차단 실측).
> **이 문서가 뒤집는 것**: 9/4 제안서 P1-4(마켓플레이스)는 운영자 결정(9/25)으로 폐기된 상태 그대로 둔다.
> 9/8 runbook의 "AI 인용을 노리는 작업은 studionol.co.kr 본체에서만 효과가 난다"는 **절반만 맞다** — §1-3.
>
> 태그: [공식] 운영사 1차 문서·발표 · [연구] 제3자 데이터(대부분 상관·미국 표본) · [실측] 이번에 직접 확인 · [추정] 해석

---

## 0. 한 줄 결론

> **한국에서 AI 추천의 입구는 다섯 개이고, 입구마다 읽는 데이터가 다르다.** 사이트 본체(llms.txt·스키마·본문)가
> 먹이는 입구는 외산 AI의 웹 검색 경로 하나뿐인데, 거기는 이미 잘 된다(검색이 열리면 ChatGPT 인용 75~100%).
> 남은 입구 넷 — **네이버 AI(브리핑·AI탭·플레이스 에이전트), 카톡 안의 ChatGPT(카카오맵 호출), 구글(GBP·Maps),
> Copilot(Bing)** — 은 전부 **플랫폼 장소 DB·리뷰·다른 색인**을 읽는다. 그 DB는 대체로 맞지만 **리뷰가 0건**이고,
> 카카오맵만 사이트와 다른 번호(kosmart 대표번호)를 싣고 있다.
>
> **2026-09-26 정정**: 처음 판 결론의 "틀린 사실 둘"은 둘 다 과장이었다. 카카오맵 번호는 운영자도 받는 번호라
> 문의가 새지 않고(D1), 구글 "폐업" 중복은 이미 하나로 합쳐져 있었다(D2) — 아래 §2 각 행.
>
> 그래서 이번 라운드의 순서는 **① 플랫폼 DB의 사실 오류 제거 → ② 리뷰 → ③ 한국 입구까지 재는 측정 → ④ 제3자 언급**이다.
> llms.txt·스키마 추가 투자는 멈춘다 — Google이 공식적으로 "필요 없다"고 했고, 로그 연구와 우리 로그가 같은 말을 한다.

---

## 1. 이번 조사로 바뀐 전제

### 1-1. 입구별로 읽는 데이터

| 입구 | 한국 규모 | 무엇을 읽나 | 우리 상태 |
|---|---|---|---|
| **네이버 AI 브리핑·AI탭·플레이스 에이전트** | 브리핑이 통합검색 쿼리의 20%+(2025-12, 2026 말 40% 목표)·월 3,000만 명 [공식]. AI탭 6/26 정식·MAU 1,000만 [공식·보도]. 플레이스 에이전트 9/17 지도 앱 출시 [보도] | 인용 콘텐츠의 70%가 네이버 UGC(방법론 비공개) [공식 발언]. **로컬은 스마트플레이스 사장님 입력 정보 + 방문자 리뷰 + 블로그**. AI탭의 예약 슬롯은 **네이버 예약으로만** 넘어간다 [공식]. 웹문서도 인용되며 "상위 노출 글이 잘 인용된다"(네이버 FAQ) [공식] | 플레이스 정보·가격 텍스트는 9/7~25 정비 완료. **방문자 리뷰 0건** |
| **카톡 안의 ChatGPT** (ChatGPT for Kakao) | 누적 가입 1,300만(2026-08 컨콜) [보도] | 장소 질문에 **Kakao Tools가 카카오맵을 호출**해 위치·정보를 준다 [공식, 원문 확인] | [실측] 카카오맵에 "스튜디오 놀 불광점"으로 존재하나 **전화 02-764-3114**(kosmart 대표번호, 운영자도 받는다). 운영자 관리 흔적 없음(runbook 미체크) |
| **ChatGPT·Perplexity·Claude 단독 앱** (외산 웹 검색) | ChatGPT MAU 2,367만·Claude 344만·Perplexity 147만(와이즈앱 2026-07) [통계] | ChatGPT: 제3자 검색 공급자(Bing 포함) + 자체 인덱스 [공식·연구]. Claude: **Brave Search**(인용의 79%가 Brave 상위 10위) [공식·연구]. Perplexity: 자체 인덱스 [공식]. **네이버·카카오의 블로그·지도는 전부 AI 검색봇 차단** [실측 — map/blog/kin.naver, map.kakao, place.map.kakao] | **잘 된다.** 검색이 열린 ChatGPT 답변에서 인용 75%(1회차)·3/3(2회차), Perplexity 14/20, 지역형 1위. AI 봇 26종 명시 허용·전부 200 응답 [실측] |
| **구글 AI Overviews·AI Mode·Gemini 앱** | Gemini MAU 947만 [통계]. AI Mode 한국어 2025-09 [공식] | 구글 색인(Googlebot) + **Business Profile·Maps** [공식]. Gemini 앱 grounding은 `Google-Extended`로 통제 [공식]. 에이전트 예약·대리 전화는 **미국 한정** [공식] | GBP 인증 완료(8/24), 정보 정확·경고 없음, **리뷰 0건**(9/26 관리 화면 확인). Gemini는 믹싱 질문에 웹을 안 연다(0/6) |
| **Copilot** | 작음 | Bing 색인 [공식] | IndexNow CI 배선 완료. **Bing Webmaster Tools 미등록** — AI 인용 대시보드를 못 본다 |

**읽는 법.** 외산 AI 단독 앱이 스튜디오에 대해 직접 읽을 수 있는 1차 출처는 사실상 studionol.co.kr과 구글
쪽뿐이다. 네이버·카카오 안의 AI는 반대로 자기 DB만 읽는다. 사이트 작업과 플랫폼 작업은 서로를 대신하지 못한다.

### 1-2. Google의 공식 입장 — "여전히 SEO다" [공식, 원문 확인]

`developers.google.com/search/docs/fundamentals/ai-optimization-guide`(2026-05-15 발행, 07-10 갱신):

- 해야 할 것 셋: **non-commodity 콘텐츠**(흔한 상식이 아닌 전문가·경험자의 고유한 관점), 기존 SEO 기술 기본기,
  **Business Profile·Merchant Center 정보**.
- 필요 없다고 명시한 것: "new machine readable files, AI text files, markup, or Markdown"(=llms.txt),
  콘텐츠를 잘게 쪼개기, AI 전용 schema, 인위적 언급 확보. Sullivan은 청킹에 "We don't want you to do that"(2026-01).
- Search Console **생성형 AI 실적 보고서**가 2026-08-31 전 세계로 열렸다 — AI Overviews·AI Mode **노출수만**, 클릭 없음 [공식, 원문 확인].
- FAQ 리치 결과는 2026-05-07부터 미표시 [보도]. 마크업은 남겨도 해는 없다.

### 1-3. 9/8 runbook 정정 — "AI 인용은 사이트 본체에서만"은 절반만 맞다

9/8 결론("네이버 블로그·플레이스는 GEO 수단이 아니다")은 **외산 AI의 웹 검색 경로**에 대해서는 여전히 맞다
(robots 차단은 오늘 다시 확인했다). 그러나 그 뒤에 두 입구가 커졌다.

- **카톡 안의 ChatGPT는 카카오맵을 도구로 호출한다.** "ChatGPT에서 우리가 어떻게 보이느냐"의 상당 부분이
  사이트가 아니라 카카오맵 등록 정보로 결정될 수 있다.
- **네이버 AI탭·플레이스 에이전트는 플레이스 데이터와 리뷰로 추천하고 네이버 예약으로 넘긴다.** 플레이스
  정비는 "사람이 읽는 것"만이 아니라 **네이버 AI가 읽는 것**이다.

### 1-4. llms.txt는 거의 읽히지 않는다

- Google Search는 쓰지 않는다 [공식, 2026-06 문서에 명시].
- Ahrefs(2026-06-15, 13.7만 도메인): 게시 사이트의 **97%가 한 달 요청 0건**, 요청 중 AI 검색봇은 1.1% [연구, 원문 확인].
  SE Ranking(30만 도메인): 인용과 무상관 [연구].
- OpenAI·Anthropic·Perplexity 크롤러 문서에 llms.txt 언급 없음 [공식, 부재 확인].
- [실측] 우리 `/llms.txt` 함수 실행은 **7일 14건**(Vercel 런타임 로그, 9/18~25, 이번 조사 요청 포함). CDN 1시간
  캐시라 실제 요청은 이보다 많을 수 있으나, 자주 읽히는 파일의 수치는 아니다.

그동안의 llms.txt 교정 작업이 헛되지는 않았다 — 같은 커밋들이 페이지 카피·스키마·FAQ의 사실 오류도 함께
잡았다. 다만 **"AI가 읽는 층"은 llms.txt가 아니라 페이지 본문과 플랫폼 DB**라는 것이 이번 조사의 결론이다.

---

## 2. 이번에 실측으로 확인한 결함

| # | 결함 | 실측 | 어디서 고치나 |
|---|---|---|---|
| D1 | 카카오맵 전화번호가 사이트와 다름(02-764-3114) — **긴급 아님** | 카카오맵 검색 `confirmid 482217521` "스튜디오 놀 불광점 · 통일로71길 2-1 · 음악 · 02-764-3114". 02-764-3114는 kosmart 번호이지만 **운영자도 받는 번호**다(2026-09-26 운영자 확인) — 문의는 새지 않는다. 남는 문제는 ①이름·주소·전화 불일치로 AI가 kosmart 스튜디오와 우리를 두 업체로 볼 여지(9/18 ChatGPT 실측) ②그 번호 문의가 oplog 채널에서 섞임 ③kosmart 사정에 따라 번호가 바뀔 위험 | 다른 콘솔 작업 때 함께: 카카오비즈니스 파트너센터(장소 관리) 또는 카카오맵 앱 정보 수정 제안 |
| ~~D2~~ | ~~구글 "폐업" 중복 리스팅 미정리~~ → **해소돼 있었다(2026-09-26 aside로 확인)** | 두 CID(5451462716481993990·17692560696856302422)가 같은 프로필을 연다 — 조회수 561회·9/8 게시물·010 번호·"소유자 제공" 동일, "폐업" 표시 없음. 옛 CID로 열면 "현재 게시가 사용 중지됨(이 유형의 장소에 대한 참여는 허용되지 않습니다)"이 뜨지만, 관리 화면에 경고가 없고 리뷰 링크(`https://g.page/r/CVZTKO82moj1EBM/review`)로 작성 창이 정상적으로 열린다 — 합쳐진 옛 주소의 표시로 본다 | 할 일 없음. **중복 신고를 하지 말 것** — 두 CID가 같은 프로필이라 운영 리스팅을 건드릴 수 있다 |
| D3 | JSON-LD `additionalType`가 **"음악 산업"(Q746359)** | Wikidata API: Q746359 = music industry, 녹음실은 **Q746369** — 숫자 한 자리 오타 | `utils/schema/business.ts:198` |
| D4 | Wikidata 등록 초안의 Q-ID 2건이 엉뚱한 항목 | Q1852944 = 위키미디어 목록 문서(녹음실 아님), Q21925567 = serigrapher(실크스크린 작가) | `docs/proposals/wikidata-draft-2026-07-28.md:36,112` → Q746369·**Q128124**(audio engineer) |
| D5 | 운영자 Person의 `sameAs`에 스튜디오 인스타·스레드가 섞임 | `buildOperatorPersonNode`가 `socialProfiles`를 펼친다. `article.ts:46-47` 주석("싣지 않는다")과 코드가 어긋남 | `utils/schema/person.ts:65-68`, `utils/schema/article.ts:48-51` |
| D6 | GA4 LLM 유입 필터가 소스 **6종 정확 일치** | `claude.ai`·`chat.openai.com`·`copilot.microsoft.com`·`www.perplexity.ai` 등이 빠진다. GA4 기본 채널 "AI Assistant"도 생겼으나 소스 목록 비공개 [공식·보도] | `scripts/ga4-fetch.mjs:218-256` → 정규식 |
| ~~D7~~ | ~~Bing Webmaster Tools 미등록~~ → **등록돼 있었다**(운영자가 이전에 등록, 저장소에 흔적이 없었을 뿐) | 2026-09-26 aside로 확인: AI Performance(베타) 메뉴 사용 가능. 기준선은 §2-1 | 할 일 없음. 월간 기준선 기록만 |
| D8 | GEO 측정 패널에 **한국 입구 둘이 없다** | `docs/geo-visibility/`는 ChatGPT·Gemini·Perplexity 3엔진만. 네이버 AI탭·카톡 ChatGPT·구글 AI Mode는 한 번도 안 쟀다 | `docs/geo-visibility/README.md`·`queries.md` |

참고로 kosmart 스튜디오 페이지 2건은 **이미 301 완료**다(`kosmart.co.kr/recording`·`/practice` → studionol.co.kr, 실측).
kosmart 번호가 남은 곳은 D1 하나다(운영자도 받는 번호).

### 2-1. AI 노출 기준선 (2026-09-26, aside로 콘솔 직접 확인)

**Search Console 생성형 AI 보고서**(AI Overviews·AI Mode, 노출만, 웹 텍스트, 최근 3개월): **총 12.4만 회**, 하루
1,000~2,000회. 설정 → AI controls → "Google 검색 생성형 AI: **포함**"(옵트아웃 아님).

- 상위: `copyright-cover1` 5,846 · `songstructure1` 3,451 · `session-musician1` 2,943 · `revenue1` 2,914 ·
  `eq1` 2,637 · `headvoice1` 2,427 · `chord-progression1` 2,000 · `vocalrange1` 1,876 · `royalty1` 1,864 ·
  `distribution1` 1,846 — **전부 정보성 스토리**.
- **서비스 LP는 상위 500행 합계 12.1만 중 1,642회(1.4%)**: practice-room 1,015 · voice-acting 180 · 홈 143 ·
  /en/pricing 84 · recording 74 · mixing-mastering 45 · lesson 40 · wedding-song 31. **ko pricing·release-project·
  music-promotion·cover-video·crowdfunding-design은 상위 500행에 없다.**

**Bing AI Performance**(Microsoft Copilot과 파트너, 최근 3개월): **인용 3,900회, 인용 페이지 평균 27**. 인용된
페이지 185개가 전부 스토리 중심이고, grounding 쿼리 상위도 "기타 설정"·"가사 잘 쓰는 법"·"마스터링 뜻"·
"오토튠 사용법"·"국내 음원 유통사" 같은 지식형이다.

**읽는 법.** 구글·Copilot 모두 AI 답변에서 우리를 꽤 쓰지만 **지식형 질문의 출처로** 쓴다. 업체를 고르는
질문(녹음실·믹싱 의뢰·발매 대행)에서 서비스 LP가 인용되는 일은 드물다 — 9/4 제안서의 "상업 쿼리 노출 최대
페이지 중 LP 8%"와 같은 구조가 AI 답변에서도 반복된다. 다음 회차에 볼 것은 총 노출보다 **LP 비중 1.4%가
움직이는지**다. 스토리에서 LP로 가는 동선(StoryCTA·인라인 오퍼)이 AI 경유 방문에서도 작동하는지는 GA4 LLM
랜딩 기준 리드(`lead-verdict`)로 본다.

---

## 3. 무엇이 실제로 효과가 있나 — 근거 강도

업계 데이터는 대부분 미국·영어·소프트웨어/이커머스 표본의 상관분석이다. 한국 소규모 서비스업으로 옮기는 것
자체가 추정이라는 전제로 읽는다.

| 강도 | 레버 | 근거 |
|---|---|---|
| **강** | 기반 검색 색인에서의 가시성(구글·Bing·Brave·네이버) | C-SEO Bench(NeurIPS 2025): 대화형 기법 대부분 무효, 전통 SEO가 우세. Google "still SEO". 네이버 FAQ "상위 노출 글이 인용된다". Claude 인용의 79%가 Brave 상위 10위 |
| **강** | 제3자 웹·YouTube에서의 브랜드 언급 **폭** | Ahrefs 7.5만 브랜드: 웹 언급 0.664, YouTube 언급 ~0.737(백링크 0.218). Chen 외(2025): AI 검색은 earned media 편향. 모두 상관 |
| **강(로컬)** | 리뷰 평점·리스팅 정확도 | SOCi(미국 35만 지점): ChatGPT 추천 지점 평균 4.3점, 약 3.4점 이하는 사실상 배제(2차 보도로만 확인). 네이버 플레이스 AI 브리핑은 방문자 리뷰를 요약한다 [공식] |
| **강(측정)** | 순위가 아니라 반복 실행 가시성 % | SparkToro(2,961회): 같은 브랜드 목록이 나올 확률 <1%, 가시성 %는 안정적 |
| 약·논쟁 | 통계·인용문 추가 | GEO 논문 실험실 +22~41%, 경쟁 조건에서 사라짐(C-SEO Bench), 장기 효과 증거 없음(2026-07 서베이) |
| 약·논쟁 | 첫 문단 즉답, 질문형 헤딩·FAQ, 표 | 연구끼리 모순(Indig 2배 vs SE Ranking 열세). 표는 "이미 뽑힌 출처에 인용이 몰리는" 효과지 뽑힐 확률은 아님(CITECHOICE) |
| 약·논쟁 | 신선도 | ChatGPT만 선호, AIO는 아님(Ahrefs 1,700만 URL). 날짜만 바꾸기 금지 |
| 약·논쟁 | Wikidata·저자 바이라인 | 인과 데이터 없음 |
| **신화** | llms.txt | §1-4 |
| **신화** | 스키마 추가로 AI 인용 증가 | Ahrefs DiD(1,885 vs 4,000페이지): AIO −4.6%, AI Mode·ChatGPT 유의차 없음. LLM은 JSON-LD를 구조가 아니라 텍스트로 읽는다(Williams-Cook 실험) |
| **신화** | 콘텐츠 청킹·AI 문체 재작성, "ChatGPT 순위" 추적, 숨긴 텍스트 | Google이 명시적으로 반대 / 비일관성 연구 / 스팸 정책 위반·일부 모델은 인젝션 감지 시 브랜드 추천 54%→0% |

---

## 4. 실행안

우선순위 기준은 9/4와 같다 — "리드 기대치 ÷ 소요 시간", 잠긴 실험 페이지와 충돌하지 않는 것만.
**P0는 측정 없이도 정당하다** — 틀린 번호로 새는 문의는 효과를 잴 필요 없이 막아야 하는 손실이다.

### P0 — 이번 주: 플랫폼 DB·기계층의 사실 오류 제거

| # | 작업 | 방법 | 소요 |
|---|---|---|---|
| P0-1 → **P1로 내림** | 카카오맵 번호 정합(D1) — 긴급 아님, 다른 콘솔 작업 때 | 카카오비즈니스 파트너센터에서 장소 `482217521` 관리 권한 신청 → 전화 010-4255-7893, 홈페이지 studionol.co.kr, 영업 24시간, 업종(녹음실·연습실 계열 선택지 확인), 대표 사진. 소유 인증이 막히면 카카오맵 앱 "정보 수정 제안"으로 전화번호부터. 완료 확인은 카카오맵 검색 결과의 `tel` 값 | 30분 + 검수 대기 |
| ~~P0-2~~ | ~~구글 폐업 중복 정리(D2)~~ — 해소돼 있었다. 하지 않는다 | — | — |
| **P0-3** ✅ | **스키마 3줄(D3·D5)** — #273 | `additionalType` → `Q746369` · Person `sameAs`에서 `socialProfiles` 제거(주석과 일치시킴) | 코드 10줄 미만 + 테스트 |
| **P0-4** ✅ | **Wikidata 초안 Q-ID 정정(D4)** — 이 문서와 같은 커밋 | Q1852944→Q746369, Q21925567→Q128124. 등록 자체는 P2 | 문서 2줄 |
| **P0-5** ✅ | Bing Webmaster Tools — 이미 등록, 기준선 기록 완료(§2-1) | — | — |
| **P0-6** ✅ | Search Console — AI controls "포함"(옵트아웃 아님), 생성형 AI 보고서 열림, 기준선 기록 완료(§2-1) | — | — |

### P1 — 2~4주: 한국 입구의 원재료와 측정

| # | 작업 | 왜 | 방법 |
|---|---|---|---|
| **P1-1** | **리뷰 루프 가동** (9/4 P1-1, 아직 미착수) | 네이버 AI탭·플레이스 AI 브리핑·플레이스 에이전트가 **방문자 리뷰를 원재료로 요약**한다 [공식]. 방문자 리뷰 0건은 이 세 입구에 우리를 설명할 재료가 없다는 뜻이다. 구글·카카오 쪽 AI도 리뷰를 본다 | runbook "5) 리뷰 전략" 템플릿. 세션·납품·입주 1개월 시점 카톡 마무리 메시지에 **네이버 영수증 리뷰 + 구글 리뷰 링크 2개만**. 키워드 유도·대가 금지(9/4 가드레일 그대로) |
| **P1-2** | **측정 패널에 한국 입구 3개 추가(D8)** | 가장 큰 두 입구를 한 번도 안 쟀다 | 기존 60건은 그대로 두고, **업체 탐색형·지역형 10개**(Q09·Q15~Q20·L01·C01·P02)만 네이버 AI탭(+통합검색 AI 브리핑 표시 여부)·카톡 ChatGPT·구글 AI Mode에 추가로 넣는다. 칸 하나 추가: `facts_wrong`(전화·주소·가격·"보컬 레슨 한다"류 오류를 그대로 적는다). ChatGPT는 임시 채팅으로(README 잔여 문제). 업체 탐색형 10개는 **2회 반복**해 가시성 %로 본다 |
| **P1-3** | **GA4 LLM 필터를 정규식으로(D6)** | 새는 소스를 세야 LLM 리드율(9/4 기준 3.9%)이 정확해진다 | `sessionSource` 정규식 `(^\|\.)(chatgpt\.com\|chat\.openai\.com\|perplexity\.ai\|claude\.ai\|gemini\.google\.com\|copilot\.microsoft\.com\|copilot\.com\|notebooklm\.google\.com\|grok\.com\|chat\.deepseek\.com)$`. GA4 기본 "AI Assistant" 채널과 한 번 대조. 봇 판별 규칙(참여 0·이탈 100%·단일 도시, `queries.md` R02 교훈)은 그대로. `docs/wiki/entities/channel-llm-referrers.md`(6/25 이후 멈춤) 갱신 |
| **P1-4** | **네이버 예약 = AI탭의 예약 입구** — 운영자 판단 표시 | AI탭은 추천한 장소의 예약 슬롯을 **네이버 예약으로만** 넘긴다 [공식]. 녹음·믹싱 예약 상품은 노출 중이니 그대로 둔다 | **연습실 시간제는 "사이트 예약 한 곳" 원칙**(9/25, #243)을 유지하는 것이 기본값이다. 그 대가로 AI탭은 시간제 연습실을 추천까지만 하고 예약으로 못 넘긴다. 뒤집을지는 운영자 판단 — 여기서 권하지 않는다 |
| **P1-5** | **Brave 색인 확인(Claude 대용)** | Claude 인용의 79%가 Brave 상위 10위 | 서비스 LP 9종이 Brave에 색인됐는지 `site:` 확인, 빠진 것은 `search.brave.com/submit-url`. 분기 1회 |

### P2 — 분기: 제3자 언급의 폭과 대체 불가 콘텐츠

| # | 작업 | 근거·조건 |
|---|---|---|
| **P2-1** | **납품물 크레딧 한 줄** — 커버 영상·발매 음원·보도자료의 설명란·크레딧에 "Recorded/Mixed at Studio NOL (studionol.co.kr)"을 **의뢰인 동의하에** 넣는다 | 언급 폭(특히 YouTube 설명란)이 가장 강한 상관 레버다. 새 채널을 운영하지 않고, 이미 하고 있는 작업이 언급을 낳게 하는 방식이라 1인 운영과 맞는다. 강제·대가 조건 금지. 발매 파이프라인(memory `release-pipeline-core-strength`)이 곧 언급 생산 라인이다 |
| **P2-2** | **1인칭 원본 데이터** — 9/4 P2-3(oplog 실측 "수정 라운드·세션 소요시간") 유지, 발매 사례 페이지에 **숫자**(곡수·기간·모금액, 본인 동의)를 붙인다 | Google의 "non-commodity"와 네이버 가이드의 "직접 경험한 지식·실제 결과·근거"가 같은 것을 요구한다. 신규 스토리 월 0~2편 게이트(9/4 §4)를 그대로 통과해야 한다 |
| **P2-3** | **Wikidata 등록**(P0-4 정정본으로) | 근거는 약하지만 비용이 작고 초안이 완비됐다. kosmart를 모조직으로 적지 않는다(체크리스트 그대로) |
| **P2-4** | 제3자 정정 잔여 — `mixing.co.kr/21283` 소속·번호 정정 요청(9/4 P1-5) | 엔티티 혼동은 AI가 우리를 두 업체로 보게 만든다(9/18 ChatGPT가 "한국스마트협동조합 레코딩 스튜디오"를 별개 경쟁자로 올림) |

### 선택 — 유료 입구 (유기 기본기 뒤에 판단)

- **네이버 AI 브리핑 광고**(2026-07 말 정식) — AI 답변 영역의 유료 슬롯 [공식].
- **ChatGPT 광고** — 한국 셀프서비스 개통(2026-09) [보도]. OpenAI는 광고가 답변에 영향을 주지 않는다고 공식 부인했다.
  답변 안의 추천을 사는 수단이 아니다.

둘 다 목표 리드 단가를 정한 소액 테스트로만. 마켓플레이스가 소유한 수요를 가져오는 "광고·로컬 채널" 방향
(memory `no-marketplace-site-first`)과는 맞는다.

### 관망 — 조건이 바뀌면 다시 본다

| 대상 | 다시 볼 조건 |
|---|---|
| 네이버 플레이스 에이전트·플레이스 AI 브리핑의 업종 범위 | 음악 스튜디오·연습실이 포함되면 → 플레이스 부가정보(주차·장비·예약)가 곧 답변 원문이 된다 |
| 구글 AI Mode 에이전트 예약·대리 전화 | 한국 출시 시 → GBP 고급 설정의 통화 옵트아웃 여부 결정 |
| WebMCP (Chrome origin trial) | Gemini in Chrome이 실제로 소비하기 시작하면 → 예약·문의 폼에 적용 검토 |
| 카카오톡 채널(pf.kakao.com) | 크롤 허용이고 Kakao Tools가 외부 확장 예정 [공식]. 1인 운영 부담 대비 효과가 보일 때. 지금 문의 창구인 오픈채팅(`open.kakao.com`)은 모든 봇에 `Disallow: /`다 |

---

## 5. 하지 말 것 · 투자 중단

- **llms.txt 추가 큐레이션 중단.** 정본 보간 자동 생성과 사실 오류 수정은 유지하되, 사용 사례 확장 같은 손 편집은
  하지 않는다. 사실을 고치는 습관은 그대로 두고 **대상을 페이지 본문·플랫폼 DB(카카오맵·GBP·플레이스)로 옮긴다.**
- **AI 목적의 새 스키마 타입 추가.** 스키마는 화면 텍스트와 일치하는 정확성만 관리한다.
- **Accept: text/markdown·.md 미러·Content-Signal·AIPREF·NLWeb·사이트 MCP 서버·ACP·UCP.** 주요 AI가 읽지 않거나
  서비스업·한국이 대상이 아니다.
- **청킹·AI 문체 재작성.** 즉답 수술은 사람 독자 기준으로만 하고, AI를 이유로 확대하지 않는다.
- **자기 홍보 비교 글·리스티클 대량 생산.** 해당 사이트들의 구글 가시성이 −29~−49% 떨어졌다는 관찰이 있다(2026).
- **숨긴 텍스트·프롬프트 인젝션·"AI로 요약" 버튼 메모리 주입.** Microsoft가 2026-02에 공격 기법으로 분류했다.
- **네이버 블로그를 외산 AI 인용용으로 쓰기.** 차단돼 있다(9/8·오늘 재확인). 네이버 블로그는 네이버 안에서만 가치가 있다.
- **robots.txt에서 AI 봇 차단.** `Google-Extended`를 막으면 Gemini 앱 grounding에서 빠진다(검색·AIO는 무관). 학습 봇도
  지금처럼 허용 — 서비스업은 잃을 것이 적고, 지식형 질문에서 ChatGPT가 웹을 안 열 때 기댈 곳은 학습 데이터뿐이다.
- 9/4 가드레일 전부 유지: 잠긴 실험 페이지 수정 금지(프리플라이트 목록), 리뷰 대가·키워드 유도 금지, 보컬 글 레슨 오퍼 금지,
  마켓플레이스 개설 금지.

---

## 6. 측정 계획

| KPI | 기준선 | 어디서 | 주기 |
|---|---|---|---|
| **플랫폼 사실 오류 수**(전화·주소·상호·폐업 표시) | 1건(D1, 긴급 아님) → 0 | 카카오맵 검색 `tel`, 구글 지도, P1-2 `facts_wrong` 칸 | P0 직후, 이후 월간 |
| 검색 발동 시 인용률(ChatGPT·Perplexity·Gemini) | 2026-10 회차가 첫 정식 기준선(README) | `docs/geo-visibility/` | 월간 |
| **한국 입구 가시성 %**(AI탭·카톡 ChatGPT·AI Mode) | 없음 → P1-2로 시작 | 같은 폴더, 별도 분모 | 월간, 3회차부터 추세 |
| LLM 세션 / 리드 | 310 / 12(28일, 9/4) — 정규식 전환 후 재측정 | GA4 | 월간 |
| AI 경로 문의·성사 | oplog `chatgpt`·`other_ai` | `docs/oplog/quotes.csv` | 월간 |
| 리뷰 수(네이버 방문자 / 구글 / 카카오) | 0 / 미확인 / 미확인 | 각 콘솔 | 격주 |
| Bing AI Performance 인용 수 | 3,900회 / 인용 페이지 평균 27(3개월, 2026-09-26) | BWT | 월간 |
| GSC 생성형 AI 노출 | 12.4만(3개월) · **서비스 LP 비중 1.4%**(2026-09-26) | GSC | 월간 |

**판독 원칙.** 같은 프롬프트도 매번 답이 다르므로 한 달 숫자로 결론 내리지 않는다(README 기존 원칙). 모델 교체 같은
플랫폼 사건은 날짜와 함께 기록해 교란 요인으로 둔다 — ChatGPT의 Reddit 인용 비율이 한 달 만에 60%→10%로
움직인 사례가 있다. GSC에서는 **AI Mode 후속 질문이 새 쿼리로 집계**되므로("yes go on" 같은 행) 쿼리 분석에서
걸러 낸다 — 프리플라이트 "데이터 판독 함정"에 한 줄 추가할 만하다.

---

## 7. 확인하지 못한 것

- ChatGPT 단독 앱이 **한국** 로컬 카드에 어떤 데이터를 쓰는지 — 미국은 Yelp, 캐나다는 Google 데이터 흔적으로 연구가
  갈리고 한국 데이터는 없다. 우리 측정의 "지역형 1위"가 어느 경로였는지는 P1-2의 `cited_url`로 본다.
- 카톡 ChatGPT가 "연신내 녹음실" 같은 질문에 실제로 카카오맵을 호출하는지 — P1-2에서 직접 확인한다.
- 플레이스 AI 브리핑·플레이스 에이전트의 적용 업종, Bing Places의 한국 지원 여부.
- 네이버 AI 브리핑의 외부 웹문서 인용 비중 — 공식 수치 없음(한 주치 272건 표본에서 16.5%).
- 이번 조사는 세션 웹 검색 한도(200회)에 걸려 후반부 확인을 원문 페치로만 했다. 원문 403으로 2차 보도로만 확인한
  항목(SOCi 수치, Yelp–OpenAI 계약, 한국 ChatGPT 광고 개통)은 표에서 그렇게 표시했다.

---

## 부록 — 주요 출처

- Google, Optimizing your website for generative AI features — https://developers.google.com/search/docs/fundamentals/ai-optimization-guide
- Google, Generative AI performance report — https://support.google.com/webmasters/answer/16984139
- Google, 공통 크롤러(Google-Extended) — https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers
- OpenAI, 크롤러 — https://developers.openai.com/api/docs/bots · ChatGPT search 도움말 — https://help.openai.com/en/articles/9237897-chatgpt-search
- Anthropic, 크롤러 — https://support.claude.com/en/articles/8896518 · MERJ, Brave 발견 조건 — https://merj.com/blog/how-brave-search-discovers-new-pages
- Bing, AI Performance — https://blogs.bing.com/webmaster/February-2026/Introducing-AI-Performance-in-Bing-Webmaster-Tools-Public-Preview
- Kakao, ChatGPT for Kakao — https://www.kakaocorp.com/page/detail/11780
- 네이버, AI 시대 콘텐츠 작성 가이드(2026-05-26) — https://blog.naver.com/naver_search/224296857688 · AI탭 — https://blog.naver.com/naver_search/224326964802
- 네이버 서치어드바이저 콘텐츠 권장 사항 — https://searchadvisor.naver.com/guide/content-basic
- Ahrefs, llms.txt 연구 — https://ahrefs.com/blog/llmstxt-study/ · 스키마 DiD — https://ahrefs.com/blog/schema-ai-citations/ · 브랜드 상관 — https://ahrefs.com/blog/ai-overview-brand-correlation/
- SparkToro, AI 추천 비일관성 — https://sparktoro.com/blog/new-research-ais-are-highly-inconsistent-when-recommending-brands-or-products-marketers-should-take-care-when-tracking-ai-visibility/
- GEO 원논문 — https://arxiv.org/abs/2311.09735 · C-SEO Bench — https://arxiv.org/abs/2506.11097
- 와이즈앱 AI 앱 MAU(2026-07) — https://wowtale.net/2026/08/11/262725/
