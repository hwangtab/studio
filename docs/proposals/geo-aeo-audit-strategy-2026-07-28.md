# Studio NOL GEO/AEO 전수 감사 및 전략 (2026-07-28)

> 목적: 음반제작·녹음·믹싱·마스터링·레슨 **문의 증대** 관점에서 AI 검색엔진(ChatGPT·Perplexity·Gemini·Claude·AI Overviews)이 스튜디오 놀을 추천·인용하게 만들기.
> 방법론: toprank geo-optimizer(Princeton KDD 2024 / AutoGEO ICLR 2026 기반) 4필러 감사 + GA4 90일 실측 + 외부 검색 지형 스팟체크(10쿼리) + 코드베이스 전수 인벤토리.

---

## GEO Score: 69/100 — "기반 견고, 고레버리지 신호 2~3개 결핍"

| 필러 | 점수 | 판정 |
|---|---|---|
| 증거 밀도 (35) | 24 | 콘텐츠 코퍼스 우수, 1인칭 원본 데이터·인용문 부족 |
| 구조·포지션 (25) | 20 | 스키마 최상급, 믹싱/마스터링 전용 페이지 부재·가시적 수정일 미표기 |
| 권위 신호 (25) | **11** | **최대 약점 — 오프사이트 엔티티 전무** |
| AI 크롤러빌리티 (15) | 14 | 사실상 완비 |

베토 항목(자동 60점 캡): 해당 없음. 조작·차단·저자 미상 없음.

---

## 1. 현황 전수 체크 결과

### A. AI 크롤러빌리티 — 사실상 완비 (14/15)

- **robots.txt**: GPTBot·OAI-SearchBot·ChatGPT-User·ClaudeBot·anthropic-ai·PerplexityBot·Perplexity-User·Google-Extended·Bytespider·Amazonbot·cohere-ai·CCBot·Applebot(-Extended)·Meta 계열까지 **전부 명시 허용**. 차단 없음.
- **llms.txt 생태계**: `/llms.txt`(46KB — 서비스·가격 전체·오시는길·장비·21개 지역·큐레이션 가이드 13종·저자 E-E-A-T 근거·영/중 Quick Facts) + `/llms-full.txt` + 로케일 변형(`-ko/-en/-zh`). `pages/api/llms.ts`에서 가격 SSOT(`data/pricing.ts`) 보간으로 드리프트 차단.
- **렌더링**: 전 서비스/콘텐츠 페이지 SSG/ISR — JS 미실행 크롤러에도 완전한 HTML.
- 잔여 갭: `dateModified`가 frontmatter가 아닌 **파일 mtime 파생**(`lib/stories.ts:330`) — Vercel 빌드마다 전 스토리가 "오늘 수정됨"으로 찍힘(실측: 감사 당일 03:37 타임스탬프). 균일한 가짜 freshness는 엔진이 결국 할인하며 정확성도 훼손.

### B. 구조·스키마 — 최상급이나 커버리지 구멍 1개 (20/25)

- JSON-LD 30여 종 @type 운영: 전 페이지 Organization+EntertainmentBusiness+WebSite+BreadcrumbList+**FAQPage**, 페이지별 Service/Course/HowTo/Product/OfferCatalog/MusicRecording/Person(#person-hwang 단일 @id 통합). FAQ는 홈 13문항 포함 사이트 전역 60문항+.
- 가격 투명성: 전 서비스 KRW 공개 + Offer/priceValidUntil(+12개월). AI 에이전트가 파싱 가능한 형태로 llms.txt에도 전문 노출.
- **갭 1 — 믹싱/마스터링 전용 페이지 부재**: recording·lesson·practice-room·voice-acting·release-project는 전용 페이지가 있는데 믹싱·마스터링만 `pricing.tsx` 섹션+스토리(94건)로만 존재. "믹싱 마스터링 업체 추천" 류 상업 쿼리에 내밀 랜딩이 없음.
- **갭 2 — 가시적 "최종 업데이트" 미표기**: modifiedDate가 JSON-LD에만 있고 화면 미노출.
- 갭 3(소소): 믹싱 강좌 23편의 비-ko 번역본 category가 `lesson`으로 오기재(원본은 `강좌`) — llms-full 카테고리 라인 오염.

### C. 증거 밀도·콘텐츠 — 이미 인용받는 수준 (24/35)

- **스토리 1,584개 슬러그**(ko 1,576 + native-only 8), 구매의도 허브 6종, 믹싱 강좌 23편+pillar, 포트폴리오 70+.
- **실측 인용 증거**: ChatGPT가 90일간 60개 이상의 서로 다른 스토리로 유입을 보냄(distribution1·mr-guide1·copyright-cover1·recording-price1 등). 콘텐츠가 인용 가능한 수준임은 실증됨.
- 부족: 1인칭 원본 데이터(자체 리서치/통계) 0건, 외부 전문가 인용문 희소. Princeton 기준 인용문 +41%·통계 +30% 레버 미사용.

### D. 권위·엔티티 — 최대 약점 (11/25)

| 항목 | 상태 |
|---|---|
| Wikidata (황경하/Studio NOL) | **없음** (초안도 미작성) |
| 위키백과·나무위키 | **없음** |
| Person sameAs | ggac.kr·Bugs **2개뿐** |
| 본인 아티스트 페이지 연결 | **분열** — Apple Music에 황경하 아티스트 페이지(〈눈녹듯〉2024 = 자사 포트폴리오와 동일 작품) 존재하나 미연결. 멜론·지니·Spotify도 미연결 |
| 언론 제3자 검증 | 한겨레21·ize 보도 이력 있으나 사이트·스키마 어디에도 링크 미노출 |
| 네이버 블로그 | **21편 작성 완료, 미발행** (`docs/naver-blog/`, 2026-05-31 작성) |
| 실명 바이라인 | 스토리 1,584건 중 가시 바이라인 실명(황경하)은 41건(2.6%) — JSON-LD는 전부 Person 승격되나 화면은 조직명 |
| 브랜드 충돌 | "Studio NOL" 쿼리 상위를 야놀자 "NOL 티켓"이 점령. "스튜디오 놀"도 홈이 아닌 스토리가 5위권 |

### E. 실측 성과 (GA4 90일, 봇 제외)

| 소스 | 세션 | 전환(qualified lead) |
|---|---|---|
| ChatGPT | 503 (71%) | 12 |
| Perplexity | 97 | 2 |
| Gemini | 41 | 1 |
| Copilot | 39 | 1 |
| NotebookLM | 22 | 0 |
| Claude | 6 | 0 |
| **LLM 합계** | **~710** | **16 → CVR ≈ 2.25%** |
| (비교) Google organic | 11,330 | 67 → CVR 0.59% |

- **LLM 유입 전환율이 구글 오가닉의 약 3.8배.** AI 추천 → 문의 파이프라인은 이미 작동 중이며, 병목은 전환율이 아니라 **유입량(=AI 인용 빈도)**.
- 특이 신호: ChatGPT발 최대 랜딩이 `/en/contact`(58세션) — 영어권 사용자에게 ChatGPT가 스튜디오 놀 문의 페이지를 직접 추천 중. 외국인 뮤지션 니치가 실재.
- chatgpt.com(ai-assistant) 이탈률 4.3% — 극도로 적합한 트래픽.

### F. 외부 검색 지형 (10쿼리 스팟체크)

| 쿼리 | 노출 | 지배 소스 |
|---|---|---|
| 스튜디오 놀 녹음실 | 5위(스토리) | 아워플레이스·브런치·경쟁사 |
| Studio NOL 서울 | 9위 | **야놀자 NOL 티켓** |
| 서울 녹음실 추천 | 6위(studio-compare1) | 숨고·브런치 |
| 믹싱 마스터링 업체 추천 | **미노출** | 크몽·숨고·큐오넷 |
| 음원 믹싱 비용 | 6위(recording-price1) — 유일하게 구체 가격표 보유 | miso.kr(얕은 글) |
| 싱글 앨범 제작 비용 | 5위(album-cost1) | 미소·숨고·브리즈뮤직 |
| 음반 제작 과정 | **미노출** | 숨고·**kosmart.co.kr/album(3위)**·브리즈뮤직·트루진 |
| 보컬 녹음 스튜디오 서울 | **3위**(최고) | 브런치·스페이스클라우드 |
| 미디 작곡 레슨 추천 | **미노출** | 탈잉 장악 |
| 프로듀싱 레슨 | **미노출** | 뮬·크몽 게시판 홍보글뿐 |

패턴: ①상업 카테고리는 마켓플레이스(크몽·숨고·탈잉)와 커뮤니티가 장악, 업체 공식 사이트는 소수만 진입. ②가격 쿼리 상위 글들은 실제로 얕음(단일 평균치) — 구체 가격표를 가진 우리가 콘텐츠 품질로는 이길 수 있는 지형. ③레슨·믹싱업체·제작과정은 구조화 콘텐츠 무주공산.

---

## 2. 전략 — 문의 카테고리별 진단

| 문의 카테고리 | 온사이트 | 외부 지형 | 처방 |
|---|---|---|---|
| 음반제작 | release-project 허브+3티어 ✅ | "제작 과정" 미노출, kosmart 3위 | 제작 과정 pillar + kosmart 상호 언급 |
| 녹음 | recording ✅ | 3~6위 (최강 카테고리) | 유지·보강 |
| 믹싱 | **전용 페이지 없음** | 업체추천 미노출 | **전용 페이지 신설(최우선)** |
| 마스터링 | **전용 페이지 없음** | 동일 | 믹싱과 통합 페이지 |
| 레슨 | lesson ✅ (Course 스키마) | 미노출, 콘텐츠 1건뿐 | 레슨 콘텐츠 클러스터 신설 |

## 3. 실행 로드맵

### Phase 1 — 0~30일: 온사이트 마감 + 엔티티 연결 (전부 자체 통제 가능)

1. **믹싱/마스터링 전용 페이지 신설** (`/[locale]/mixing-mastering`) — Service+Offer(가격 SSOT 재사용)+FAQ 6문항+HowTo(작업 프로세스)+2회 수정 포함 정책 명시. llms.txt Key Pages 등재, 기존 스토리 94건에서 내부링크. en 버전도 `lib/enIndexablePaths.json`에 추가(원격 믹싱은 영어 응대 가능 서비스).
2. **Person sameAs 확장** (`data/siteConfig.ts`) — Apple Music 아티스트 페이지(〈눈녹듯〉 본인 확인 후)·멜론·지니·Spotify·Instagram(@podopodopo)·YouTube. 분열된 아티스트 엔티티를 #person-hwang으로 통합. ChatGPT의 author entity resolution에 직결.
3. **Wikidata 항목 생성** (황경하 → Studio NOL 순) — 출처: 2017 한국대중음악상 선정위원 특별상, 한겨레21·ize 보도, Bugs·ggac 프로필. 등록은 본인 계정으로. 완료 후 sameAs에 Wikidata URI 추가. ChatGPT 상위 인용 ~48%가 위키 계열 — 단일 최대 레버.
4. **네이버 블로그 발행 개시** — 준비된 21편을 주 1편 페이스로(우선순위 07→02→01). 발행 전 `docs/naver-blog/README.md`의 사실 오류 정정 필수: "보컬레슨(월 35만원)" → 보컬·악기 레슨은 제공하지 않음, 1:1 프로듀싱(미디·믹싱·작곡) 레슨 월 35만원. 네이버 블로그는 한국어 ChatGPT·Perplexity의 핵심 인용 소스이자 플레이스 연동 지역 신호.
5. **dateModified 정합화** — mtime 대신 git 최종 커밋 시각 또는 frontmatter `lastmod`로 전환 + 스토리 화면에 "최종 업데이트: YYYY-MM-DD" 가시 표기(`<time>` 태그). 가짜 균일 freshness 제거.
6. **실명 바이라인 확대** — 상업 연관 상위 스토리(LLM 유입 상위 60건부터) author를 '황경하'로 전환해 가시 바이라인 ↔ JSON-LD 일치.
7. (소소) 믹싱 강좌 번역본 category `lesson` → 원본과 동일 taxonomy로 정정.

### Phase 2 — 30~60일: 오프사이트 권위 + 무주공산 점령

8. **레슨 콘텐츠 클러스터** — "프로듀싱 레슨" 지형은 게시판 홍보글뿐. 구조화 가이드(커리큘럼·가격 비교·독학 vs 레슨·미디 입문 로드맵) 4~6편이면 AI 인용 최상위 선점 가능. lesson.tsx의 Course 스키마와 연결.
9. **음반 제작 과정 pillar 페이지/스토리** — 브리즈뮤직·트루진이 점유한 "제작 과정" 쿼리 대응. 발매 프로젝트 실사례(포트폴리오 70+) 기반 단계별 HowTo.
10. **kosmart.co.kr 상호 언급** — "음반 제작 과정" 3위인 kosmart.co.kr/album에 협력 스튜디오로 Studio NOL 언급+링크(모조직 표기 금지 — 독립 브랜드·협력 관계로만).
11. **언론 보도 아카이브 노출** — 한겨레21·ize 등 기존 보도를 `/author` 페이지 "언론 보도" 섹션+Person citation으로 구조화. "황경하 프로듀서" 쿼리의 제3자 검증 공백 해소.
12. **1인칭 원본 데이터 발행 1건** — 예: "서울 녹음실 가격 실태 2026"(자체 조사 N곳 비교) 또는 자사 90일 작업 통계. 유일 인용 가능 소스가 되는 GEO 최강 콘텐츠 유형(통계 +30%, 인용 +28%).

### Phase 3 — 60~90일: 엔진별 미세조정 + 측정 루틴

13. **측정 루틴 상설화** — 격주: 브랜드 5 + 카테고리 5 쿼리를 ChatGPT·Perplexity·Gemini·Claude에 수동 실행, 인용 여부/순서/톤 기록. 월간: `node --env-file=.env.local scripts/ga4-fetch.mjs` → llm_referrers.csv 추이 비교(세션·소스·랜딩·qualified lead). ※ micro_* 이벤트는 GA4 key event로 지정하지 않음(리드 지표 무결성 정책).
14. **영어권 확장** — /en/contact ChatGPT 유입(90일 58세션)이 입증한 외국인 니치: en 색인 경로에 recording·mixing-mastering 추가, foreign-musicians 스토리 시리즈 증편.
15. **커뮤니티 프레즌스(Gemini·국내 지형 대응)** — 뮬(이미 유입 존재)·큐오넷에 전문가 답변 활동. 광고성 배제, 실명·전문성 기반.
16. **나무위키는 보류 유지** — 저명성 심사·삭제 리스크 대비 기대값 낮음. Wikidata+언론 보도가 쌓인 뒤 재평가.

## 4. 측정 기준선 (2026-07-28)

- LLM 유입: ~710세션/90일, qualified lead 16건, CVR 2.25%
- 엔진 점유: ChatGPT 71% / Perplexity 14% / Gemini 6% / Copilot 5%
- 카테고리 쿼리 노출: 10개 중 4개 (믹싱업체·제작과정·레슨 2종 미노출)
- 오프사이트 엔티티: Wikidata ✗ · 나무위키 ✗ · 네이버 블로그 ✗ · sameAs 2개
- 90일 목표(제안): LLM 세션 +50%(→1,060), 카테고리 노출 10개 중 7개, sameAs 6개+, Wikidata 2건 등재, 네이버 블로그 8편+ 발행
