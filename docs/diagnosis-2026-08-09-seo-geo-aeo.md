# Studio NOL — SEO · GEO · AEO 통합 진단 및 개선 설계 (2026-08-09)

> **방법**: 5개 도메인 병렬 감사 — ①테크니컬 SEO ②AEO·구조화 데이터 ③GEO·AI 검색 ④콘텐츠·키워드 전략 ⑤네이버·로컬
> **검증 기준**: `origin/main` (감사는 `content-batches` 체크아웃에서 수행됐으나 주요 발견 8건을 origin/main에서 전수 재검증 — 전부 잔존 확인)
> **데이터**: GSC 90일 `docs/gsc-raw/` (2026-04-24 ~ 07-22) · GA4 `docs/ga4-raw/` (2026-08-04 갱신) · 코드 실측
> **선행 문서**: `docs/diagnosis-2026-07-25.md` (문의·매출 관점), `docs/tail-noindex-assessment-2026-07.md`, `docs/p3-external-channels-runbook.md`

---

## 0. 한 줄 결론

> **엔진은 이미 최상급이고, 병목은 전부 "배선"에 있다.**
> 1,760편이 정보 쿼리를 장악했고 구조화 데이터·llms.txt·hreflang은 상위 1% 구현이다.
> 그런데 **거래 의도 쿼리("믹싱 의뢰"·"마스터링 의뢰"·"음원 발매 대행"·"녹음실 가격")의 노출은 문자 그대로 0**이고,
> 그걸 받으라고 만든 LP(`/recording`·`/mixing-mastering`)는 1,760편으로부터 내부링크를 **한 건도** 못 받고 있으며,
> 모든 채널이 수렴하는 `/ko/pricing`은 H1에 숫자가 하나도 없어 ChatGPT 유입이 13초 만에 85% 이탈한다.
> 이번 라운드는 **새로 만드는 게 아니라, 만들어 둔 것들을 연결하는 라운드다.**

---

## 1. 이미 최상급인 것 — 재작업 금지 목록

감사 5건이 공통으로 확인한, **손대면 손해인** 자산이다.

| 영역 | 실측 근거 |
|---|---|
| **사이트맵 hreflang 무결성** | alternate href 1,149개 **전부** `<loc>`에 존재(dangling 0), 중복 `<loc>` 0, `uz_Latn_UZ` 언더스코어 0 |
| **"등재 ⇔ 색인 가능" 불변식** | `lib/sitemap/routes.js:75-96` · `thinContent.js:23-39` · `components/seo/metadataUrls.ts:146-180`이 사이트맵·hreflang·robots를 **같은 JSON 단일 소스**로 묶어 구조적 강제 |
| **리다이렉트 홉** | Googlebot UA 실측 전부 **1홉** (`/`→`/ko`, `www`→apex, 484개 지역 슬러그→허브 포함) |
| **robots.txt 그룹 복제** | RFC 9309의 "명명된 UA는 `*` 그룹을 완전히 무시" 규칙을 정확히 구현 — 대부분의 사이트가 틀리는 부분 |
| **`faq:` frontmatter 커버리지** | ko 스토리 **1,576 / 1,576 (100%)** → FAQPage 스키마 자동 발행. LLM 인용의 최대 자산 |
| **표·리스트 밀도** | 표 68% · 불릿 97% — 즉답 소재는 이미 다 있다 |
| **이미지 alt** | 마크다운 이미지 1,765개 중 빈 alt **0개** |
| **`/ko/practice-room`** | 5,682 노출 / 295 클릭 / CTR **5.19%** / 525세션 / 카카오 리드 **32건(CR 6.1%)** — 사이트 최대 전환 자산 |
| **`/en/contact` 즉답 블록** | `contact.tsx:133-181` en 전용 가격·교통·응대 블록 + 카카오 직링크. ChatGPT 최다 랜딩(58세션)에 이미 대응 완료 |
| **SEO 테스트** | 6스위트 51건 전부 통과 |

**특히 `/ko/practice-room` vs `practice-room-monthly1`은 통합하지 말 것.** 두 URL이 pos 4.5 / 7.4로 동시 점유해 "음악작업실 월세"에서 34클릭·CTR 9.3%를 만든다. 사이트에서 유일하게 건강한 LP+스토리 이중 점유 패턴이다.

---

## 2. 구조적 진단 5

### 진단 1 — 🔴 거래 의도 쿼리에 사이트가 존재하지 않는다

`docs/gsc-raw/page-query.csv` 실측:

| 쿼리 | 노출 | 클릭 | 수신 페이지 |
|---|---:|---:|---|
| **녹음실 가격** | **0** | 0 | 없음 |
| **믹싱 의뢰** | **0** | 0 | 없음 |
| **마스터링 의뢰** | **0** | 0 | 없음 |
| **음원 발매 대행** | **0** | 0 | 없음 |
| **성우 섭외** | **0** | 0 | 없음 |
| **작곡 의뢰 / 편곡 의뢰 / 음원 유통 대행 / 내레이션** | **0** | 0 | 없음 |
| 녹음실 (24변형) | 643 | 21 | `studio-compare1` pos 12.0 (2페이지 스토리) |
| 녹음 스튜디오 (5변형) | 225 | 4 | `studio-compare1` pos 15.9 (클릭 0) |
| 마스터링 비용 | 127 | 9 | `recording-price1` — 유일하게 작동 |

상업 의도 쿼리 전체(대여·가격·비용·견적·의뢰·대행·섭외·추천·월세·예약·업체·신청·문의): **276쿼리 / 10,970 노출 / 272 클릭 / CTR 2.48%** — 사이트 평균 1.44%의 **1.7배**.

그 안에서 결정적 분할:

- **서비스 LP가 받은 상업 쿼리: CTR 5.73%**
- **스토리가 받은 상업 쿼리: CTR 2.01%**
- **그런데 상업 노출의 87%를 스토리가 받고 있다.**

즉 **같은 쿼리에서 LP는 스토리의 2.85배로 클릭을 만드는데, 물량은 스토리가 다 먹고 있다.** 1,760편이 이 갭을 전혀 메우지 못했다는 것이 이번 감사의 핵심 발견이다.

### 진단 2 — 🔴 LP는 만들었는데 배선을 안 했다 (최대 레버)

`/ko/recording`(07-25 신설)과 `/ko/mixing-mastering`(신설)이 존재한다. 그런데:

```
origin/main:components/StoryCTA.tsx:48   primaryLink: getLink('/pricing')
origin/main:components/StoryCTA.tsx:50   secondaryLink: getLink('/contact')
origin/main:components/StoryCTA.tsx:135  primaryLink: getLink('/contact')
```

**StoryCTA는 `/recording`도 `/mixing-mastering`도 어디에서도 링크하지 않는다.** 1,760편 전편에 붙는 CTA 시스템의 목적지가 여전히 `/pricing`과 `/contact`뿐이다.

커밋 `9546332e18`(홈·스토리 배선)이 손댄 것은 `InlineServiceCallout` + `data/home.ts` + **스토리 3편**(`karaoke-vs-studio1`, `recording-price1`, `seoul1`)이다. 체계적 배선은 아직 없다.

결과: 신설 LP 2개가 **콘텐츠 엔진 전체로부터 내부링크 자산을 0건 수령** 중이다. 색인·권위 축적이 지연되어 LP 신설 효과 자체가 나오지 않는다.

CTA 타입 분포(1,760편): `practice` 1,101 / `production` 367 / `recording` 258 / `lesson` 34.
→ **recording 258편 + production 367편 = 625편의 CTA가 잘못된 곳을 가리키고 있다.**

### 진단 3 — 🔴 모든 채널의 수렴점 `/ko/pricing`이 답을 안 한다

| 위치 | 내용 |
|---|---|
| `pricing.seo.title` | "**연습실 월 36만원·녹음 10만원·축가 패키지 35만원** \| 스튜디오 놀" |
| `pricing.hero.title` (H1) | "**합리적인 가격, 투명한 서비스**" ← **숫자 0개** |
| `pricing.tsx:132` | 히어로 `min-h-[60vh]` — 첫 숫자는 모바일 기준 약 700~750px 아래 |

**실측 결과**: ChatGPT 유입 7세션, **이탈률 85.7%, 체류 13초.**

13초는 "스크롤하다 나감"이 아니라 **"숫자 없네" 하고 즉시 뒤로가기**의 시간이다. title이 약속한 것과 도착지 H1이 어긋난다.

여기에 `pricing.tsx:54-67`의 `pricingQuickAnswers`가 그대로 FAQPage 스키마로 발행되는데, 답변이 이렇다:

- Q "가격은 어떻게 책정되나요?" → A "…**아래 가격표에서 서비스별 단가를 확인할 수 있습니다.**" ← 답이 아님
- Q "예약/문의는 어떻게 하나요?" → A "카카오톡 상담 또는 문의하기 페이지에서 가능합니다." ← URL·전화번호 없음

**LLM이 통째로 가져가도 인용거리가 안 나온다.** `diagnosis-2026-07-25.md:119` 레버 1-④가 이미 H1 재작성을 지시했으나 **요약표만 구현되고 H1은 미이행 상태**다.

그리고 진단 2에 따라 **recording 타입 258편의 CTA가 바로 이 페이지로 향한다.** 병목이 곱해진다.

### 진단 4 — 🟡 GEO: llms 인덱스가 "이미 인용되는 글"을 스스로 숨기고 있다

GA4가 정답지를 줬는데 코드가 그걸 안 쓴다.

`pages/api/llms-full.ts:120` → `lib/stories.ts:313`의 date-desc 정렬을 그대로 사용. ko 스토리 날짜는 **95.5%가 2026-04 단일 월에 집중**(대량 백필)이라 정렬이 사실상 무작위다.

| slug | ChatGPT 세션 | date-desc 순위 | llms-full-ko 내 위치 |
|---|---:|---:|---|
| `distribution1` | **18 (1위)** | #1084 | ~525 KB |
| `mr-guide1` | 12 (체류 260초, 최장) | #1283 | ~620 KB |
| `streaming-platforms1` | 10 | #916 | ~445 KB |
| `copyright-cover1` | 10 | #1053 | ~510 KB |
| `recording-price1` | 9 | #888 | ~430 KB |
| `revenue1` | 9 | #1362 | ~660 KB |
| `voiceactor1` | 9 | #1508 | ~730 KB |

`/llms-full-ko.txt` 실측 **765KB(약 19만 토큰)**. 앞에서부터 읽다 컨텍스트 한도로 자르는 클라이언트는 **인용 실적이 검증된 8편을 하나도 못 본다.**

추가로 `CURATED_GUIDES`(`llms.ts:246-273`)에 `mr-guide1`·`recording-price1`·`voiceactor1`이 **누락**돼 있다. `Recent Stories`도 date-desc 상위 50이라 이 3편은 **llms.txt 어디에도 등장하지 않는다.**

그리고 `llms.ts:374`·`llms-full.ts:133`의 `X-Robots-Tag: noindex`가 rewrite 경로 `/llms.txt`에도 나간다. AI Overviews·Gemini 그라운딩은 Search 색인에서 출발하므로 **gemini.google.com(41세션) 경로에서 llms.txt는 원천 도달 불가**다. 얻는 것(SERP에 text/plain 노출 리스크 ≈ 0) 대비 잃는 것이 크다.

> **주의 — llms.txt 스토리 50편 제한은 늘리지 말 것.** 현재 40KB ≈ 1만 토큰으로 이미 브라우징 에이전트 한계선이다. 고쳐야 할 건 개수가 아니라 **어느 50편이냐**다.

### 진단 5 — 🔴 전환율 4배 채널(네이버)이 닫혀 있고, 여는 건 코드가 아니다

| 소스 | 세션 | 유효리드 | CR |
|---|---:|---:|---:|
| google/organic | 11,330 | 67 | 0.59% |
| **m.search.naver.com** | 729 | 17 | **2.33%** |
| AI 어시스턴트 합계 | ~500 | 13 | ~2.4% |
| **네이버 플레이스 (m.place + pcmap)** | **11** | 1 | — |

플레이스 유입이 **90일 11세션으로 사실상 0**이다. 은평구 로컬 고객의 기본 동선(네이버 검색 → 플레이스 → 예약/전화)이 퍼널에 없다.

**방향 오류가 있었다.** 커밋 `6b8ac822bb`의 "W2 네이버"가 실제로 만든 것은 ①사이트 → 네이버 지도 아웃바운드 링크 계측 ②히어로 전화 CTA 2곳이다. 전부 **사이트 → 네이버** 방향이다. 아무리 잘 계측해도 **플레이스 → 사이트** 유입은 1세션도 늘지 않는다.

플레이스 유입을 만드는 요인(카테고리 복수 등록, 가격 탭, 사진 10장+, 리뷰 수·최신성, 예약/톡톡)은 전부 스마트플레이스 콘솔 작업이고, **입력물은 저장소에 100% 준비돼 있다** — 소개글(`naver-place-optimization.md:44-54`), 가격표 7항목(`p3-external-channels-runbook.md:57-65`), **카드뉴스 21장 JPG 실물**(`naver-cards/series-1~5/`), 블로그 초안 23편.

그런데 `git log 6b8ac822bb..HEAD -- docs/naver-*` → **커밋 0건**. 같은 기간 저장소 전체는 14커밋(전부 콘텐츠 품질 심화)이 진행됐다. **전환율 4배 채널을 여는 무비용 작업 대신, 이미 열린 구글 채널을 계속 다듬는 데 리소스가 갔다.**

측정 인프라도 편향돼 있다. `docs/gsc-raw/`·`docs/ga4-raw/`는 있는데 **네이버 서치어드바이저 데이터는 0건**이다. 네이버가 개선 루프 자체에 들어가 있지 않다.

---

## 3. 개선 설계

> 원칙: **새로 만들지 않는다. 만들어 둔 것을 연결한다.** P0 전체가 코드 200줄 미만이다.

### P0 — 이번 주 (배선·차단 해제)

| # | 작업 | 파일 | 근거 |
|---|---|---|---|
| **1** | **StoryCTA 목적지 재배선** — `recording` → `/recording`, `production` 중 믹싱·마스터링 주제 → `/mixing-mastering` | `components/StoryCTA.tsx:48,50,135` + `lib/storyCtaPolicy.ts` | 진단 2. 625편의 내부링크가 처음으로 LP 도달 |
| **2** | **`/ko/pricing` H1 숫자화** — "합리적인 가격, 투명한 서비스" → 실제 단가 문자열. 히어로 `min-h-[60vh]`→`[40vh]`로 요약표를 fold 안으로 | `public/locales/*/common.json` `pricing.hero.title`, `pricing.tsx:132` | 진단 3. 유일하게 원인이 확정된 실패 지점 |
| **3** | **`pricingQuickAnswers` 실질화** — 3항을 수치 답변으로 교체(1곡 25만/시간당 10만·최소 2시간, 축가 35만 포함범위, 카카오 URL·전화번호 명시) | `pricing.tsx:54-67` | FAQPage 스키마에 "아래 표에서 확인하세요"가 실려 나가는 중 |
| **4** | **llms 인덱스 재정렬** — `CURATED_GUIDES`에 `mr-guide1`·`recording-price1`·`voiceactor1` 추가 + `llms-full` emit 직전 재정렬(GA4 검증 8편 → 큐레이션 → 지역 LP → 나머지 date-desc) | `pages/api/llms.ts:246-273`, `llms-full.ts:120` | 진단 4. ~30줄, ChatGPT·Perplexity 동시 작용 |
| **5** | **`X-Robots-Tag: noindex` 제거** | `llms.ts:374`, `llms-full.ts:133`, `next.config.mjs:134`의 `(?!llms$\|llms-full$)` | Gemini/AI Overviews 경로 복구. 배포 후 `curl -I` 양쪽 실측 |
| **6** | **사이트맵 lastmod → frontmatter** — `fm.data.lastmod → fm.data.date → (최후) mtime` | `lib/sitemap/storyMeta.js:66-82` | Vercel 얕은 클론이 mtime을 균일화 → 라이브 1,154 URL의 lastmod가 **212ms 범위에 전부 몰림**. 데이터는 `lastmod` 1,757편·`date` 1,764편에 이미 존재 |
| **7** | **지역 LP 21편 위조 후기 제거** | `content/stories/practice-room-*1.md` | 아래 별항 |
| **8** | **`pageRouteMap`·`pageImageMap`에 `/recording`·`/mixing-mastering`·`/author` 추가** | `lib/sitemap/routes.js:18-39`, `next-sitemap.config.js:43-68` | 이 4개 URL만 `<image:image>` 누락 + lastmod가 빌드 타임스탬프 폴백 |
| **9** | **`about` 전화·이메일·지도 카드 계측** — `onClick` 3줄 | `pages/[locale]/about.tsx:253,266,301` | "전화 리드 90일 6건"이라는 진단의 전제 자체가 과소집계 |

#### P0-7 상세 — 즉시 처리해야 하는 리스크

```
$ grep -l "월 고정 비용이 부담되지 않을까 걱정했는데" content/stories/practice-room-*1.md | wc -l
21
$ grep -h "— 싱어송라이터" content/stories/practice-room-{jichuk1,wonheung1,gusan1,ilsan1}.md
> — 싱어송라이터 K씨, 지축 입주 3개월
> — 싱어송라이터 K씨, 원흥 입주 3개월
> — 싱어송라이터 K씨, 구산 입주 3개월
> — 싱어송라이터 K씨, 일산 입주 3개월
```

**같은 "싱어송라이터 K씨"가 같은 "입주 3개월" 시점에 21개 동네에 산다.** origin/main에서도 21편 전부 잔존 확인.

- 네이버 유사문서 필터는 구글보다 공격적 — 21편 중 1편만 남기고 색인 제외되기 쉽다
- 지역명만 바꾼 조작 후기는 **표시광고법상 기만적 표시**에 해당할 수 있다
- 플레이스 리뷰 전략(P1-1)을 이 페이지들과 연결하는 순간 신뢰 자산 전체가 같은 리스크를 진다

→ 두 후기 인용 블록을 21편에서 전부 제거하거나, 실제 입주자 1인 후기를 원 지역 1편에만 남긴다. **P1-1(플레이스 개방)보다 먼저 처리할 것** — 유입을 열면 이 페이지들이 로컬 검색 착지면이 된다.

### P1 — 2~3주 (구조)

| # | 작업 | 근거 |
|---|---|---|
| **1** | **네이버 스마트플레이스 콘솔 실행** ⭐ | 아래 별항. 코드 0줄, 최대 ROI |
| **2** | **전화 전환 동선 복구** — `%%phone%%`를 `<a href="tel:">` + `lead_click_phone`으로 렌더(스토리 **86편**이 현재 비링크 평문), KakaoFab에 전화 세컨더리 추가 | 로컬 서비스업 1순위 전환 행동이 pSEO 착지면에서 죽어 있음 |
| **3** | **AEO 엔티티 정합 복구** | 아래 별항 |
| **4** | **`gsc-audit-output.csv` 재생성 + 크론 점검** | 현재 **2026-05-21 스냅샷** — 2.5개월 stale. 아래 별항 |
| **5** | **`/recording`을 `enIndexablePaths.json`에 추가** | 현재 `["/pricing","/contact","/release-project","/mixing-mastering"]`. `contact.tsx:171`과 `llms.ts:206`이 `/en/recording`을 광고하는데 **noindex** 상태 |
| **6** | **IndexNow 자동화 배선** | `scripts/indexnow-submit.mjs` + 키 파일 배포 완료, 네이버 공식 지원 엔드포인트. 그런데 `package.json`·CI·postbuild 어디에도 호출 없음 |
| **7** | **`/ko/voice-acting` 강화** | "성우 녹음실" pos 16.4, "성우 녹음 섭외/견적/외주" pos 8~28에서 클릭 0. 섭외 프로세스·견적 예시·납품 스펙 명시 |

#### P1-1 상세 — 네이버 스마트플레이스 (place ID `1527843821`)

`smartplace.naver.com` 콘솔 작업. 소요 2~3시간, 비용 0원, **입력물 전부 저장소에 준비 완료**.

- [ ] **카테고리 복수 등록** — 대표 `녹음실`, 추가 `음악연습실`·`음악학원`·`예술기획·제작`. **`음악연습실` 누락 시 최대 수요 키워드를 통째로 놓친다**
- [ ] **가격 탭 7항목** — `p3-external-channels-runbook.md:57-65` 표 그대로. 항목명 자체가 키워드 신호
- [ ] **업체 소개글** — `naver-place-optimization.md:44-54` 복붙(키워드 밀도 조정 완료본)
- [ ] **사진 최소 10장** — 순서 `p3-external-channels-runbook.md:73-79`. 대표 4장은 **텍스트 0% 실사**(AI 이미지 금지)
- [ ] **카드뉴스 21장 업로드 개시** — `naver-cards/series-1~5/` JPG 실물 준비 완료. 주 1~2회 5~10장씩(한꺼번에 금지 = 신선도 신호)
- [ ] **네이버 예약 도입** ⭐ — 예약 버튼 클릭이 플레이스 노출 점수 + 전환 단축을 동시에 올린다. **"100% 예약제"(`data/faq.ts:32`)라고 말하면서 예약 수단이 카카오 오픈채팅 하나뿐인 모순의 유일한 무개발 해법**
- [ ] **네이버 톡톡 개설** — 저장소에 톡톡 URL 0건. 개설 후 `siteConfig`에 등록
- [ ] **영업시간 확정** — 현재 3중 표기(스키마 `10:00–23:59` / UI `10:00-24:00` / 연습실 `24시간`). 사이트·플레이스·GBP 3곳 동일값 선결
- [ ] **네이버 서치어드바이저**: 사이트맵 + RSS(`/api/rss?locale=ko`) 제출, 수집요청 티어 1~3(`docs/naver-blog/naver-수집요청-우선순위.md`)
- [ ] **`docs/naver-raw/` 신설** — GSC와 대칭되는 네이버 리포트 수집처. 없으면 위 작업의 효과를 영영 측정 못 한다

> ⚠️ **블로그 23편은 발행 전 정정 필수.** `docs/naver-blog/README.md:16`에 `보컬레슨(월 35만원)`, `01-why-high-notes-fail.md:69,77`에 `#보컬레슨`·`#연신내보컬레슨`이 남아 있다. 커밋 `6939d8eac9`가 사이트에서 12커밋 들여 제거한 허위 서비스다. `lib/factGuards.ts:17`의 스캔 표면이 `content/stories`·`public/locales`·`data·pages·components`뿐이라 **`docs/`는 가드 범위 밖**이다 → `docs/naver-blog`를 스캔 표면에 추가할 것.

#### P1-3 상세 — AEO 엔티티 정합

| 결함 | 증거 | 수정 |
|---|---|---|
| **`@id` 충돌** — `#organization`이 Organization과 LocalBusiness 두 타입으로 이중 등록, `url`이 배열이 됨 | `pages/[locale]/contact.tsx:64-65` | `@id`를 `#studio`로 바꾸고 `@type` 제거(참조만). `#studio`가 이미 telephone·email·address·geo 전부 보유 → 정보 손실 0 |
| **`#studio` 재타이핑** — `business.ts:113-116` 주석이 "multi-type은 중복 카운트되므로 단일 타입 통합"이라 결정해 놨는데 commerce가 되돌림 | `utils/schema/commerce.ts:78-83,141-145` | `provider`·`seller`에서 `@type` 제거. 영향 범위: `/practice-room` + 지역 LP 21개 + `practice-room-*` 스토리 전부 |
| **`Organization.founder` 부재** ⭐ | `utils/schema/business.ts` — `founder` grep 0건 | **홈·pricing·recording 등 커머셜 페이지에 Person 엔티티가 아예 없다.** 2017 한국대중음악상 수상 이력이 정작 "연신내 녹음실" 쿼리 도달 페이지에 하나도 안 실린다. `founder: { '@id': …/#person-hwang }` 추가 — 데이터는 `data/siteConfig.ts:17-39`에 이미 있고 배선만 하면 됨 |
| **`Course.instructor`가 익명** | `utils/schema/basics.ts:84-88` → `"name": "스튜디오 놀 엔지니어"` | `{ '@id': …/#person-hwang }`로 교체. "누가 가르치나"가 레슨 쿼리의 핵심 신뢰 신호 |
| **`Course.offers.price` 하드코딩** | `basics.ts:74` 리터럴 `350000` | `LESSON_MONTHLY_PRICE` 보간 + `priceValidUntil` 추가(다른 Offer는 전부 `getOfferPriceValidUntil()` 사용) |
| **`HowTo.tool` 하드코딩** | `basics.ts:190-193` — 조건 없이 항상 "전문 녹음 장비" | `distribution1`의 HowTo는 "DistroKid 가입·메타데이터 입력" 절차인데 "전문 녹음 장비"가 필요 도구로 발행된다. 60편 중 유통·저작권·비즈니스 주제 다수가 동일. **`factGuards`가 본문은 지키는데 JSON-LD는 검사 안 하는 구조적 공백** |
| **`VideoObject` 생성기 미사용** | `utils/schema/media.ts:111-132` 완성, 호출부 **0건** | `/cover-video`에 배선만 |
| **자체 리뷰 4건 전원 5점** | `data/reviews.ts` | 네이버는 JSON-LD 리뷰를 소비하지 않음 → **네이버 이득 0 + 구글 self-serving 수동조치 리스크**. 플레이스 리뷰가 쌓이면 `sameAs` 외부 출처로 교체 |

#### P1-4 상세 — 데이터 위생 (다른 모든 판단의 선행조건)

`docs/gsc-audit-output.csv`는 **2026-05-21 스냅샷**(커밋 `c853309e28`)이다. 이 파일의 `tier` 컬럼을 실행 근거로 쓰면 안 된다. 07-25 데이터로 재검증한 결과:

| tier | 편수 | 감사 당시 | **현재 실적** |
|---|---:|---|---|
| NOINDEX_CANDIDATE | 688 | 클릭 0 · 노출 0 | **320편(47%)이 45,696 노출 / 1,192 클릭** |
| WATCH | 266 | 클릭 0 | 32,110 노출 / 445 클릭 |
| KEEP | 517 | 1,922 클릭 | 360,628 노출 / 8,233 클릭 |

**688편 리스트를 실행하면 사이트 총 클릭의 11.4%가 사라진다.** 그 안에 `practice-room-price1`(109클릭 / pos 6.5 / GA4 리드 발생), `singapp1`(72), `streaming-platforms1`(63), `royalty1`(57), `deesser1`(카니벌 통합 정본)이 들어 있다. NOINDEX_CANDIDATE의 content_len 중앙값은 **2,979자** — thin content가 아니다.

→ `docs/tail-noindex-assessment-2026-07.md`의 "대량 noindex 금지" 결론은 **옳았고 최신 데이터로 더 강해졌다.** 실행 항목은 프룬이 아니라 **`pages/api/cron/gsc-audit.ts` 크론이 왜 07-25 데이터로 갱신되지 않았는지 점검**이다.

### P2 — 4~8주 (콘텐츠 전환)

#### P2-1 — 신규 생산 중단, 통합·심화로 전환

데이터가 신규 생산 중단을 지지한다:

- 1,749편이 클릭의 95.6%를 만들지만 리드 51건(**전환율 0.46%**). 101개 서비스·정적이 클릭 4.4%로 리드 65건 (**13배 차이**)
- 신규 글이 도달하는 지점인 포지션 11~20 구간 전체가 **1,038쌍 / 노출 4,061 / 클릭 54** — 한계수익이 이미 음수에 가깝다
- `뜻/란` 계열 정의형 쿼리 **238개 / 14,164 노출 / 클릭 20 (CTR 0.14%)**. `daw` 쿼리는 **평균순위 1.3에 CTR 0.20%** — title 문제가 아니라 SERP가 답을 끝내고 클릭을 안 준다
- 26일 추세: 클릭 2,085 → 2,160 (+3.6%), CTR 2.43% → 2.63% — **성장 평탄화**

**권고 배분: 신규 스토리 0편 / 중복 통합 약 30편 감축 / 심화는 상업 클러스터 우선.**

> **CTR 수술 주의**: 직전 커밋 `f5c5a42382`의 방법론을 잔여 20건에 반복하지 말 것. 20건 중 14건이 정의형 쿼리로, **AI Overview·강조 스니펫에 클릭이 흡수되는 구조**다. 실효 후보는 카니벌 해소로 순위가 오를 팔세토·딕션·lufs와 의도 재정렬 여지가 있는 믹스보이스뿐. 나머지는 "노출은 브랜드 노출로 계상하고 클릭을 기대하지 않는" 자산으로 재분류.

#### P2-2 — 카니벌라이제이션 12군 통합 (약 30편 → 정본 1편 + 301)

> **집계 주의**: 원본 그대로 세면 과대계상된다. `#앵커` 단편 1,502행(16,477 노출·**클릭 0**)이 별도 URL로 잡힌다. 베이스 URL 정규화 시 진짜 교차 카니벌은 **94쿼리**.

| 쿼리 | 노출 | 경쟁 페이지 | 통합 방향 |
|---|---:|---|---|
| 팔세토 | 2,102 | `practice-room-vocal-falsetto-technique1` · `falsetto1` · `vocal-falsetto1` | **`falsetto1`** 정본 |
| 두성 | 2,020 | `headvoice1` · `practice-room-vocal-head-voice1` | **`headvoice1`** 정본 |
| 딕션 | 1,944 | `practice-room-vocal-diction1` · `diction1` | 전자 정본 |
| 딜레이 | 1,068 | `mixing19`(2,046노출/11클릭) · `delay-types1`(1,595/**52**) | **`delay-types1`** — `mixing19`는 CTR 수술 대상이었으나 애초에 열위 페이지 |
| 성량 | 682 | `practice-room-vocal-power1` · `volume1` (거의 50:50) | 전자 정본 |
| 마이크 종류 | 642 | `microphone-types1` · `mic1` · `microphone1` | **3→1 단일화** |
| 디에서 | 350 | `deesser1` · `de-esser1` | **슬러그만 다른 중복글** → `deesser1` |
| 림샷/스네어 | 514 | `practice-room-drum-snare1` 외 2편 | 3편 통합 |

합계 약 **50,410 노출 / 951 클릭 / CTR 1.89%**. 통합 후 CTR이 상업쿼리 수준(2.5~3.0%)으로 회복한다고 가정 시 **+300~550 클릭/90일 (추정)**.

**`/ko/recording` vs `recording-price1`·`studio-compare1`은 통합이 아니라 역방향 배선이다.** 스토리 쪽이 이미 이기고 있다(`recording-price1` 109클릭 / pos 5.2). 두 스토리에서 LP로 상향 링크해 권위를 이전하고, "녹음실"(pos 12.0)·"녹음 스튜디오"(pos 15.9) 헤드 쿼리를 LP가 받게 한다.

#### P2-3 — 즉답 구조 배치 (상위 50편)

ko 1,576편 실측:

| 지표 | 보유 | 비율 |
|---|---:|---:|
| `faq:` frontmatter | 1,576 | **100%** 🟢 |
| 표 포함 | 1,075 | 68% 🟢 |
| 불릿 리스트 | 1,535 | 97% 🟢 |
| **질문형 H2** | 130 / 12,085 | **1.1%** 🔴 |
| **"결론부터" 리드** | 18 | **1.1%** 🔴 |
| **Key Takeaways 블록** | 10 | **0.6%** 🔴 |
| `updated:` frontmatter | **0** | **0%** 🔴 |
| 인간 저자(황경하) 명시 | 41 | 2.6% 🔴 |

**소재는 이미 다 있다. 병목은 헤딩과 리드 문장 하나다.** 새 사실을 쓰는 게 아니라 **있는 답을 위로 끌어올리는 순서 교체**다.

레퍼런스 구현이 이미 저장소에 있다 — `distribution1.md:52`("결론부터 — …DistroKid 연간 $22.99…" + Key Takeaways 5줄 + 출처 블록), `daw-choice1`, `revenue1`. ChatGPT 1위 랜딩이 `distribution1`인 건 우연이 아니다.

**Before/After (`recording-price1.md:45-49`)**

```markdown
## 음반 제작 비용 — 예산에 맞는 서비스 선택

음반 제작 비용은 서비스 범위와 품질에 따라 다양합니다. 예산과 목적에 맞는
서비스를 선택하는 것이 중요합니다.

음반 제작 비용 구조는 1950~60년대 미국 레이블 스튜디오 시스템에서 형성됐습니다. …
```
↓
```markdown
## 녹음·믹싱·마스터링 비용은 얼마인가요?

결론부터 — **보컬 녹음 25만원/곡, 싱글 마스터링 10만원/곡**(스튜디오 놀 2026,
VAT 별도). 국내 시세는 녹음 시간당 3~10만원, 믹싱 5~20만원, 마스터링 3~15만원.

> **Key Takeaways**
> - 1곡 완성 총액은 **15~40만원**이 표준. 발매급 풀 믹싱은 25~50만원.
> - **시간제보다 패키지가 싸다** — 튠·믹싱·마스터링이 묶여 재작업 비용이 안 붙는다.
> - 지방 거주자는 **온라인 믹싱 의뢰**로 이동비 없이 결제.

### 이 가격 구조는 어디서 왔나

음반 제작 비용 구조는 1950~60년대 미국 레이블 스튜디오 시스템에서 형성됐습니다. …
```

바뀌는 것: ①H2가 실제 검색 쿼리 문장 ②첫 60자 안에 숫자 직답 ③역사 문단을 H3로 강등해 스니펫 추출 경로에서 비켜냄 ④Key Takeaways가 PAA 후보를 동시 공급.

> **B군 진단 — 리드 뒤 즉시 역사 문단이 나오는 패턴이 지배적이다.** `mr-guide1.md:38-42`("MR 문화는 1971년 이노우에 다이스케가…"), `loudness1.md:52-56`, `copyright-cover1.md:47`, `eq1.md:51-55`가 모두 동일 구조. 특히 `mr-guide1`은 **체류 260초로 전체 최장인데 리드가 인용 불가**다.

#### P2-4 — 리드 0 고트래픽 스토리 오퍼 재매칭

리드 0 스토리 랜딩 **442페이지 / 9,142세션**. 상위 15편 중 **9편이 `production` CTA → `/contact`**로 수렴한다. 즉 "믹싱·마스터링·발매를 배우러 온 독자 전원에게 동일한 일반 문의 링크"다.

| 페이지 | 세션 | 체류 | 현재 CTA | 매칭해야 할 오퍼 |
|---|---:|---:|---|---|
| `copyright-cover1` | 261 | 143s | production→`/contact` | 커버곡 합법 발매 대행 |
| `daw-choice1` | 254 | 178s | recording→`/pricing` | 음악작업실 월세 |
| `eq1` | 227 | 158s | production→`/contact` | **믹싱 의뢰** |
| `revenue1` | 171 | 141s | production→`/contact` | **음원 발매 대행** |
| `loudness1` | 154 | 134s | production→`/contact` | **마스터링 의뢰**(LUFS 무료 진단 훅) |
| `mixing-complete-guide` | 96 | **211s** | production→`/contact` | **믹싱 의뢰 — 최우선** |
| `drum-mixing1` | 93 | **215s** | production→`/contact` | 드럼 녹음+믹싱 패키지 |
| `headvoice1` | 97 | 111s | lesson→`/lesson` | **오퍼 교체 필수** — 보컬 레슨 미제공 |

4종 CTA(recording/lesson/practice/production) 체계는 1,760편을 감당하기엔 해상도가 부족하다. P0-1이 목적지를 고치고, P2-4가 **타입 해상도를 높인다.**

#### P2-5 — 지역 LP 정리

21편이 동일 10섹션 템플릿의 토큰 치환 복제다. 고유한 부분은 ①동선 표 ②멘토 산문 두 곳뿐 — 시설·장비 리스트, 손익분기점 표, 입주 조건 6줄은 21편이 글자 단위로 같다.

| | 클릭 | 노출 |
|---|---:|---:|
| 21개 지역 LP 합계 | **159** | 2,170 |
| `/ko/practice-room` 허브 1페이지 | **295** | 5,682 |

**21페이지가 허브 1페이지의 54%를 만든다.** 개별로는 `practice-room-daejo1` = **0클릭 / 44노출** — 스튜디오가 실제 위치한 대조동, 플레이스 주소와 직결되는 최고 가치 슬러그가 0클릭이다.

→ 상위 6편(`ilsan1` 26 · `seodaemun1` 24 · `yeonsinnae1` 15 · `goyang1` 11 · `sangam1` 9 · `bulgwang1` 9)만 고유 콘텐츠로 심화, 하위 10편은 허브로 301 통합. **`daejo1`은 통합이 아니라 최우선 재작성.**

#### P2-6 — 기타 테크니컬

- **카테고리 허브 페이지네이션 SSG화** (`/stories/page/N`) — `instrument` 495편 중 허브가 링크하는 건 50편. `Pagination.tsx:74-86`이 `<button onClick>`이라 크롤 가능한 링크 0개. `?page=2`가 반환하는 HTML은 1페이지와 동일한데 `rel=next`가 **자기 자신을 지목**한다. SSG화하면 이 3건이 한 번에 해소
- **빈 카테고리 허브 사이트맵 배제** — `/ko/stories/category/event`는 스토리 링크 **1개**. 스토리·포트폴리오엔 thin 게이트가 있는데 카테고리 허브만 무조건 등재(`next-sitemap.config.js:155-164`)
- **대문자 로케일 404** — `/KO/pricing` → 308 `/ko/KO/pricing` → 404 (`middleware.ts:164-166`이 소문자만 비교). 같은 유형을 `isRoutePatternPath`로 이미 한 번 고친 이력이 있음. 2줄
- **`/api/rss` HEAD 405** — robots가 `Allow: /api/rss`로 명시 허용하는데 HEAD 프리플라이트가 실패
- **404 canonical 제거** — `pages/404.tsx:36`이 `/404`(그 자체로 404)를 canonical로 선언
- **주소·우편번호 SSOT 편입** — 전화번호는 `factTokens`+`factGuards`로 잠겨 있는데 주소는 `data/faq.ts` 7곳 + `emailContent.ts` + `llms*.ts` 3곳에 하드코딩. 우편번호 `03424`는 `business.ts`에만. NAP 불일치는 로컬 SEO 최대 실수
- **네이버 플레이스 ID 기록** — `sameAs`가 단축 URL `naver.me/5gFZhS3X`(307 리다이렉터). 실제 엔티티는 `map.naver.com/p/entry/place/**1527843821**`인데 저장소에 ID가 없어 리뷰·예약 딥링크를 붙일 수 없다
- **contact 지도 임베드 방향 전환** — `ContactInfoCard.tsx:109-118`이 구글맵 iframe. ko 로케일은 네이버 지도 우선으로

---

## 4. 채널별 전략

| 채널 | 실측 | 무엇을 다르게 할 것인가 |
|---|---|---|
| **ChatGPT** (~503세션 / 12리드 / 2.4%) | 랜딩이 **가이드 스토리에 집중**, 상업 페이지는 `/en/contact` 58 · `/ko/pricing` 7 | 유입은 "정보 소비자"이지 "구매자"가 아니다. **스토리 → 상업 페이지 브릿지를 글 맨 끝이 아니라 리드 직후 블록쿼트로** 올릴 것(P0-1·P2-4). `/ko/pricing` H1 숫자화(P0-2) |
| **Perplexity** (~97세션) | 출처 카드에 **저자·발행일을 노출**한다 | **저자·날짜 신호가 유일하게 중요한 채널.** 현재 1,535편이 저자 "스튜디오 놀"(조직) + 날짜 2026-04-06. GA4 검증 8편 + 큐레이션 13편의 `author`를 `황경하`로, `updated:` 필드 도입 |
| **Gemini** (~41세션) | Google 색인 기반 | **P0-5의 직접 수혜자.** 추가로 Gemini는 FAQPage·HowTo 의존도가 높은데 `howTo:` 보유가 60/1,576(3.8%)뿐 — 절차형 스토리 확대가 Gemini 전용 레버 |
| **Copilot / Bing** | copilot 39세션 1리드 / **bing organic 307세션 CR 0%** | **Bing organic을 개선 대상으로 삼지 말 것** — 307세션 회수 없음. Copilot 경로만 노린다: IndexNow 자동화(P1-6)로 색인 신선도 유지 |
| **NotebookLM** (22세션 / 0리드) | robots.txt로 제어 불가한 user-triggered fetcher | **최적화 대상 아님.** 다만 "학습 자료로 인용되는 수준"이라는 신호 — `출처` 블록(현재 10/1,576편)을 늘리면 재인용이 는다 |
| **신흥** (manus·polymeta·odiasearch 각 1~3) | 표본 무의미 | **아무 조치도 하지 말 것.** 대부분 GPTBot/CCBot 산출물 재활용이라 ChatGPT 최적화가 자동 커버 |
| **네이버** (729세션 CR 2.33% / 플레이스 11세션) | 전환율 4배, 유입 방치 | P1-1 전량 |

> **크롤러 토큰 보강은 우선순위에서 뺐다.** `*` 그룹이 이미 전면 Allow이므로 실질 효과 0이다. 다음 `next-sitemap.config.js` 수정 때 곁다리로 `Claude-User`·`Claude-SearchBot`·`MistralAI-User`·`DuckAssistBot`·`Google-CloudVertexBot`·`GoogleOther`·`bedrockbot`·`Meta-ExternalFetcher`·`cohere-training-data-crawler`·`Bravebot`·`kagi-fetcher`·`AI2Bot` 정도만 `NAMED_BOTS`(`next-sitemap.config.js:98-113`)에 추가하면 충분하다. `public/robots.txt`는 postbuild가 삭제·재생성하므로 직접 고치지 말 것.

---

## 5. 예상 효과 (추정)

| 항목 | 클릭 증분 (90일) | 리드 증분 (90일) |
|---|---|---|
| P0-1 LP 배선 + P2-2 카니벌 통합 | +300~550 (추정) | 소폭 |
| P0-2·3 pricing 복구 | — | 전 채널 수렴점 개선 |
| P1-1 네이버 플레이스 개방 | — | **+15~30 (추정)** — 플레이스 11→200+세션, CR 2.33% 가정 |
| P2-4 오퍼 재매칭 | — | **+25~45 (추정)** — 상업 트래픽 일부에 LP 전환율 적용 |

현재 유효 리드 122건/90일(월 ~40건) 기준 **+30~60% 추정**. 모든 수치는 가정 기반 추정이며 실측 검증이 필요하다.

---

## 6. 측정 계획

1. **선행조건**: `gsc-audit-output.csv` 재생성(P1-4) — 없으면 P2 대상 선정 근거가 없다
2. **`docs/naver-raw/` 신설** — 네이버가 개선 루프에 들어오는 유일한 방법
3. **`/ko/recording`·`/ko/mixing-mastering` 효과 판정은 8월 중순 이후**. 현재 GSC 원천이 07-22까지이고 LP는 07-25 커밋이라 **원리적으로 데이터에 없다**. `page-all.csv`에 행 자체가 없는 것은 실패가 아니라 미측정이다
4. **배포 후 즉시 확인**: `curl -I https://studionol.co.kr/llms.txt` 와 `/api/llms` 헤더가 의도대로 갈리는지(P0-5), 사이트맵 lastmod가 실제 날짜로 분산되는지(P0-6)
5. **전화 리드는 P1-2 이후 재기준선** — 현재 "90일 6건"은 과소집계이므로 개선 전후 비교가 불가

---

## 부록 A — 감사 방법

5개 도메인 에이전트를 병렬 실행. 각 에이전트는 코드·CSV를 직접 읽고 줄 번호를 인용하도록 지시했으며, 코드 수정은 금지했다. 감사는 `content-batches`(origin/main 대비 95커밋 behind) 체크아웃에서 수행됐으므로, 주요 발견 8건을 `git show origin/main:<path>`로 전수 재검증했다.

**origin/main 재검증 결과 — 전부 잔존 확인**: 사이트맵 lastmod mtime 기반 · llms `X-Robots-Tag: noindex` · `contact.tsx` `@id` 충돌 · pricing H1 "합리적인 가격, 투명한 서비스" · `Organization.founder` 부재 · `HowTo.tool` 하드코딩 · 지역 LP 위조 후기 21편 · StoryCTA가 `/pricing`·`/contact`만 링크.

**감사 이후 갱신된 것 2건**: `/ko/mixing-mastering` LP 신설(+ `enIndexablePaths`에 등재됨) · GA4 raw 2026-08-04 갱신.

## 부록 B — 미확인 항목

- PSI / Core Web Vitals 실측 (CLAUDE.md의 Liquid Glass 배포 게이트는 `899bd87f2d`에서 실측 완료 기록됨 — 별도 확인 필요)
- GSC 최신 색인 커버리지 수치
- `pages/api/cron/gsc-audit.ts` 크론의 실제 실행 이력
- 대문자 로케일 URL의 실제 트래픽 볼륨
- Bing Webmaster Tools 쿼리 데이터 (저장소에 없음 — CR 0% 가설 검증 불가)
- 네이버 서치어드바이저 등록·제출 상태 (소유확인 메타 `_document.tsx:32`는 배포 확인됨)
